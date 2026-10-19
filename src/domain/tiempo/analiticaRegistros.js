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
        const eventoId = registro.eventoId ?? null
        const clave = eventoId ?? "__sin_evento__"
        if (!grupos.has(clave)) grupos.set(clave, { eventoId, registros: [] })
        grupos.get(clave).registros.push(registro)
    }

    return [...grupos.values()].map(grupo => {
        const evento = grupo.eventoId === null
            ? null
            : eventos.find(elemento => elemento.id === grupo.eventoId)
        const registroConEvento = grupo.registros.find(registro => registro.eventoId === grupo.eventoId)
        return {
            eventoId: grupo.eventoId,
            nombre: grupo.eventoId === null
                ? "Sin evento vinculado"
                : evento?.nombre ?? registroConEvento?.nombre ?? "Evento no disponible",
            color: evento?.color ?? registroConEvento?.colorEvento ?? null,
            segundos: calcularTiempoRegistradoEnPeriodo(grupo.registros, inicio, fin, ahora)
        }
    })
        .filter(grupo => grupo.segundos > 0)
        .sort((a, b) => b.segundos - a.segundos || a.nombre.localeCompare(b.nombre, "es"))
}

export function agruparTiempoPorCategoria(registros, eventos, categorias, inicio, fin, ahora = new Date()) {
    if (!Array.isArray(registros) || !Array.isArray(eventos) || !Array.isArray(categorias)) return []
    const grupos = new Map()
    for (const registro of registros) {
        const evento = eventos.find(elemento => elemento.id === registro.eventoId)
        const categoria = categorias.find(elemento => elemento.id === evento?.categoriaId)
        const categoriaId = categoria?.id ?? null
        const clave = categoriaId ?? "__sin_categoria__"
        if (!grupos.has(clave)) grupos.set(clave, { categoriaId, registros: [] })
        grupos.get(clave).registros.push(registro)
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
            const categoriaId = eventoPorId.get(registro.eventoId)?.categoriaId
            return categoriaSeleccionada === "__sin_categoria__"
                ? !categorias.some(categoria => categoria.id === categoriaId)
                : categoriaId === categoriaSeleccionada
        })
        : registros
    const agrupamiento = opciones.agruparPor === "categoria" ? "categoria" : "evento"
    return {
        totalSegundos: calcularTiempoRegistradoEnPeriodo(registrosFiltrados, inicio, fin, ahora),
        porEvento: agrupamiento === "evento" ? agruparTiempoPorEvento(registrosFiltrados, eventos, inicio, fin, ahora) : [],
        porCategoria: agrupamiento === "categoria" ? agruparTiempoPorCategoria(registrosFiltrados, eventos, categorias, inicio, fin, ahora) : []
    }
}
