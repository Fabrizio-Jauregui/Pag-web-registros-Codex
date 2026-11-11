import { obtenerInicioSemana, normalizarFechaLocal } from "./FechaCalendario.js"
import { calcularTiempoRegistradoEnPeriodo } from "./CalculosDuracion.js"

export function obtenerRangoAnalitico(fecha, periodo) {
    if (!(fecha instanceof Date) || !Number.isFinite(fecha.getTime()) || !["dia", "semana"].includes(periodo)) {
        return null
    }

    const inicio = periodo === "semana" ? obtenerInicioSemana(fecha) : normalizarFechaLocal(fecha)
    if (!inicio) return null

    const fin = new Date(inicio)
    fin.setDate(fin.getDate() + (periodo === "semana" ? 7 : 1))
    return { inicio, fin }
}

export function agruparTiempoPorEvento(registros, eventos, inicio, fin, ahora = new Date()) {
    if (!Array.isArray(registros) || !Array.isArray(eventos)) return []

    const grupos = new Map()
    for (const registro of registros) {
        // Los registros de tarea tienen su propio desglose y no son actividades
        // "sin evento" en la distribución por eventos.
        if (registro.tareaId && !(registro.eventoId ?? null)) continue
        const eventoId = registro.eventoId ?? null
        const nombrePuntual = registro.origenPuntual === true ? registro.nombre : null
        const clave = nombrePuntual ? `puntual:${nombrePuntual.trim().toLocaleLowerCase("es")}` : eventoId ?? "__sin_evento__"
        if (!grupos.has(clave)) grupos.set(clave, { eventoId, nombrePuntual, registros: [] })
        grupos.get(clave).registros.push(registro)
    }

    return [...grupos.values()].map(grupo => {
        const evento = grupo.eventoId === null
            ? null
            : eventos.find(elemento => elemento.id === grupo.eventoId)
        const registroConEvento = grupo.registros.find(registro => registro.eventoId === grupo.eventoId)
        return {
            eventoId: grupo.eventoId,
            key: grupo.nombrePuntual ? `puntual:${grupo.nombrePuntual}` : grupo.eventoId ?? "sin-evento",
            nombre: grupo.nombrePuntual ?? (grupo.eventoId === null
                ? "Sin evento vinculado"
                : evento?.nombre ?? registroConEvento?.nombre ?? "Evento no disponible"),
            color: evento?.color ?? registroConEvento?.colorEvento ?? null,
            segundos: calcularTiempoRegistradoEnPeriodo(grupo.registros, inicio, fin, ahora)
        }
    })
        .filter(grupo => grupo.segundos > 0)
        .sort((a, b) => b.segundos - a.segundos || a.nombre.localeCompare(b.nombre, "es"))
}

export function agruparTiempoPorTarea(registros, inicio, fin, ahora = new Date()) {
    if (!Array.isArray(registros)) return []
    const grupos = new Map()
    for (const registro of registros) {
        const tareaId = registro.tareaId ?? null
        const clave = tareaId ?? "__sin_tarea__"
        if (!grupos.has(clave)) grupos.set(clave, { tareaId, registros: [] })
        grupos.get(clave).registros.push(registro)
    }
    return [...grupos.values()].map(grupo => {
        const registro = grupo.registros.find(item => item.tareaId === grupo.tareaId)
        return {
            tareaId: grupo.tareaId,
            nombre: grupo.tareaId === null ? "Sin tarea vinculada" : registro?.tareaNombre ?? registro?.nombre ?? "Tarea no disponible",
            color: null,
            segundos: calcularTiempoRegistradoEnPeriodo(grupo.registros, inicio, fin, ahora)
        }
    }).filter(grupo => grupo.segundos > 0)
        .sort((a, b) => b.segundos - a.segundos || a.nombre.localeCompare(b.nombre, "es"))
}

function categoriasValidasDeEvento(evento, categorias) {
    if (!evento) return []
    const categoriaIds = Array.isArray(evento.categoriaIds)
        ? evento.categoriaIds
        : evento.categoriaId ? [evento.categoriaId] : []
    return [...new Set(categoriaIds)].filter(id => categorias.some(categoria => categoria.id === id))
}

function categoriasValidasDeRegistro(registro, evento, categorias) {
    if (registro?.origenPuntual === true) {
        return [...new Set(registro.categoriaIds ?? [])].filter(id => categorias.some(categoria => categoria.id === id))
    }
    return categoriasValidasDeEvento(evento, categorias)
}

export function agruparTiempoPorCategoria(registros, eventos, categorias, inicio, fin, ahora = new Date()) {
    if (!Array.isArray(registros) || !Array.isArray(eventos) || !Array.isArray(categorias)) return []
    const grupos = new Map()
    for (const registro of registros) {
        const evento = eventos.find(elemento => elemento.id === registro.eventoId)
        const categoriaIds = categoriasValidasDeRegistro(registro, evento, categorias)
        if (categoriaIds.length === 0) categoriaIds.push(null)
        for (const categoriaId of categoriaIds) {
            const clave = categoriaId ?? "__sin_categoria__"
            if (!grupos.has(clave)) grupos.set(clave, { categoriaId, registros: [] })
            grupos.get(clave).registros.push(registro)
        }
    }
    return [...grupos.values()].map(grupo => {
        const categoria = categorias.find(elemento => elemento.id === grupo.categoriaId)
        return {
            categoriaId: grupo.categoriaId,
            nombre: categoria?.nombre ?? "Sin categoría",
            color: null,
            segundos: calcularTiempoRegistradoEnPeriodo(grupo.registros, inicio, fin, ahora)
        }
    }).filter(grupo => grupo.segundos > 0)
        .sort((a, b) => b.segundos - a.segundos || a.nombre.localeCompare(b.nombre, "es"))
}

export function calcularAnaliticaRegistros(registros, eventos, inicio, fin, ahora = new Date(), opciones = {}) {
    const categorias = Array.isArray(opciones.categorias) ? opciones.categorias : []
    const eventoPorId = new Map(eventos.map(evento => [evento.id, evento]))
    const categoriaSeleccionada = opciones.categoriaId
    const registrosFiltrados = categoriaSeleccionada
        ? registros.filter(registro => {
            const categoriaIds = categoriasValidasDeRegistro(registro, eventoPorId.get(registro.eventoId), categorias)
            return categoriaSeleccionada === "__sin_categoria__"
                ? categoriaIds.length === 0
                : categoriaIds.includes(categoriaSeleccionada)
        })
        : registros
    const agrupamiento = ["categoria", "tarea"].includes(opciones.agruparPor) ? opciones.agruparPor : "evento"
    return {
        totalSegundos: calcularTiempoRegistradoEnPeriodo(registrosFiltrados, inicio, fin, ahora),
        sumaDuracionesSegundos: registrosFiltrados.reduce((total, registro) => total
            + calcularTiempoRegistradoEnPeriodo([registro], inicio, fin, ahora), 0),
        porEvento: agrupamiento === "evento" ? agruparTiempoPorEvento(registrosFiltrados, eventos, inicio, fin, ahora) : [],
        porCategoria: agrupamiento === "categoria" ? agruparTiempoPorCategoria(registrosFiltrados, eventos, categorias, inicio, fin, ahora) : [],
        porTarea: agrupamiento === "tarea" ? agruparTiempoPorTarea(registrosFiltrados, inicio, fin, ahora) : []
    }
}
