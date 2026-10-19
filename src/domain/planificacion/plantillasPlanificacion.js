import { crearPlan } from "./planes.js"
import { desplazarDia, formatearFechaISO, normalizarFechaLocal } from "../tiempo/FechaCalendario.js"

function identidad(generarId, mensaje) {
    try {
        const id = generarId()
        return typeof id === "string" && id.trim() ? id : { error: mensaje }
    } catch {
        return { error: mensaje }
    }
}

export function validarActividadPlantilla(actividad) {
    if (!actividad || typeof actividad !== "object" || Array.isArray(actividad)) return "Una actividad de la plantilla no tiene un formato válido."
    if (typeof actividad.nombre !== "string" || !actividad.nombre.trim()) return "Escribí el nombre de cada actividad."
    if (actividad.nombre.trim().length > 80) return "El nombre de una actividad no puede superar los 80 caracteres."
    if (actividad.eventoId !== null && (typeof actividad.eventoId !== "string" || !actividad.eventoId.trim())) return "La plantilla de evento vinculada no es válida."
    if (typeof actividad.inicioSegundos !== "number" || !Number.isInteger(actividad.inicioSegundos) || actividad.inicioSegundos < 0 || actividad.inicioSegundos >= 86400) return "Elegí una hora de inicio válida."
    if (typeof actividad.finSegundos !== "number" || !Number.isInteger(actividad.finSegundos) || actividad.finSegundos < 0 || actividad.finSegundos >= 86400) return "Elegí una hora de fin válida."
    if (actividad.finDia !== 0 && actividad.finDia !== 1) return "Indicá si la actividad termina ese día o al día siguiente."
    if (actividad.finDia * 86400 + actividad.finSegundos <= actividad.inicioSegundos) return "La hora de fin debe ser posterior al inicio; si termina al día siguiente, marcá esa opción."
    return null
}

function validarActividadPorDuracion(actividad) {
    if (!actividad || typeof actividad !== "object" || Array.isArray(actividad)) return "Una actividad de la plantilla no tiene un formato válido."
    if (typeof actividad.nombre !== "string" || !actividad.nombre.trim()) return "Escribí el nombre de cada actividad."
    if (actividad.nombre.trim().length > 80) return "El nombre de una actividad no puede superar los 80 caracteres."
    if (actividad.eventoId !== null && (typeof actividad.eventoId !== "string" || !actividad.eventoId.trim())) return "La plantilla de evento vinculada no es válida."
    if (!Number.isInteger(actividad.duracionSegundos) || actividad.duracionSegundos <= 0 || actividad.duracionSegundos > 86400) return "La duración de cada actividad debe ser mayor que cero y no superar 24 horas."
    return null
}

function validarActividadRelativa(actividad, permitirSecuenciaExtendida) {
    const error = validarActividadPorDuracion(actividad)
    if (error) return error
    if (!Number.isInteger(actividad.inicioDesplazamientoSegundos) || actividad.inicioDesplazamientoSegundos < 0 || actividad.inicioDesplazamientoSegundos >= 86400) return "Elegí un inicio relativo válido para cada actividad."
    if (!permitirSecuenciaExtendida && actividad.inicioDesplazamientoSegundos + actividad.duracionSegundos > 86400) return "La secuencia completa no puede superar 24 horas desde su inicio."
    return null
}

export function validarPlantillaPlanificacion(plantilla, { minimoActividades = 2, permitirSecuenciaExtendida = false } = {}) {
    if (!plantilla || typeof plantilla !== "object" || Array.isArray(plantilla)) return "La plantilla de planificación no tiene un formato válido."
    if (typeof plantilla.nombre !== "string" || !plantilla.nombre.trim()) return "Escribí el nombre de la plantilla."
    if (plantilla.nombre.trim().length > 80) return "El nombre de la plantilla no puede superar los 80 caracteres."
    if (!Array.isArray(plantilla.actividades) || plantilla.actividades.length < minimoActividades) return "Agregá al menos dos actividades a la plantilla."
    const modo = plantilla.modo ?? "horarios"
    if (modo !== "horarios" && modo !== "duraciones" && modo !== "relativo" && modo !== "secuencias") return "Elegí si la plantilla usa horarios, duraciones o secuencias."
    const ids = new Set()
    for (const actividad of plantilla.actividades) {
        const error = modo === "duraciones" ? validarActividadPorDuracion(actividad)
            : modo === "relativo" ? validarActividadRelativa(actividad, permitirSecuenciaExtendida)
                : modo === "secuencias" ? validarActividadPorDuracion(actividad)
                : validarActividadPlantilla(actividad)
        if (error) return error
        if (typeof actividad.id !== "string" || !actividad.id.trim() || ids.has(actividad.id)) return "Cada actividad necesita una identidad única."
        ids.add(actividad.id)
    }
    if (modo === "secuencias") {
        const errorSecuencias = validarEstructuraSecuencias(plantilla.actividades, permitirSecuenciaExtendida)
        if (errorSecuencias) return errorSecuencias
    }
    if (!permitirSecuenciaExtendida) {
        const duracionSecuencia = modo === "duraciones"
            ? plantilla.actividades.reduce((total, actividad) => total + actividad.duracionSegundos, 0)
                : modo === "relativo"
                ? Math.max(...plantilla.actividades.map(actividad => actividad.inicioDesplazamientoSegundos + actividad.duracionSegundos))
                : modo === "secuencias" ? Math.max(...obtenerActividadesSecuenciadas(plantilla.actividades).map(actividad => actividad.inicioDesplazamientoSegundos + actividad.duracionSegundos))
                    : 0
        if (duracionSecuencia > 86400) return "La secuencia completa no puede superar 24 horas desde su inicio."
    }
    return null
}

function validarEstructuraSecuencias(actividades, permitirExtendida) {
    const ids = new Set(actividades.map(actividad => actividad.id))
    const grupos = new Map()
    for (const actividad of actividades) {
        if (typeof actividad.secuenciaId !== "string" || !actividad.secuenciaId.trim() || !Number.isInteger(actividad.ordenSecuencia) || actividad.ordenSecuencia < 0) return "Cada actividad debe pertenecer a una secuencia válida."
        if (!grupos.has(actividad.secuenciaId)) grupos.set(actividad.secuenciaId, [])
        grupos.get(actividad.secuenciaId).push(actividad)
    }
    const principales = [...grupos.values()].filter(grupo => grupo[0]?.anclaActividadId == null)
    if (principales.length !== 1) return "La plantilla debe tener una única secuencia principal."
    for (const grupo of grupos.values()) {
        grupo.sort((a, b) => a.ordenSecuencia - b.ordenSecuencia)
        if (grupo.some((actividad, indice) => actividad.ordenSecuencia !== indice)) return "El orden de las actividades de una secuencia no es válido."
        const primera = grupo[0]
        if (grupo.some(actividad => actividad.anclaActividadId !== primera.anclaActividadId || actividad.desplazamientoAnclaSegundos !== primera.desplazamientoAnclaSegundos)) return "Las actividades de una misma secuencia deben compartir su anclaje."
        if (primera.anclaActividadId != null && (!ids.has(primera.anclaActividadId) || primera.anclaActividadId === primera.id)) return "Una secuencia paralela tiene una actividad de referencia inválida."
        if (!Number.isInteger(primera.desplazamientoAnclaSegundos ?? 0)) return "El desplazamiento de una secuencia debe expresarse en segundos enteros."
    }
    const errorTiempo = obtenerActividadesSecuenciadas(actividades, true)
    if (errorTiempo.error) return errorTiempo.error
    if (errorTiempo.some(actividad => actividad.inicioDesplazamientoSegundos < 0 || (!permitirExtendida && actividad.inicioDesplazamientoSegundos + actividad.duracionSegundos > 86400))) return "Las actividades deben quedar dentro de las primeras 24 horas desde el inicio de la plantilla."
    return null
}

function obtenerActividadesSecuenciadas(actividades, informarError = false) {
    const grupos = new Map()
    actividades.forEach(actividad => {
        if (!grupos.has(actividad.secuenciaId)) grupos.set(actividad.secuenciaId, [])
        grupos.get(actividad.secuenciaId).push(actividad)
    })
    for (const grupo of grupos.values()) grupo.sort((a, b) => a.ordenSecuencia - b.ordenSecuencia)
    const inicios = new Map()
    const enCurso = new Set()
    function obtenerInicio(id) {
        if (inicios.has(id)) return inicios.get(id)
        if (enCurso.has(id)) throw new Error("Las referencias entre secuencias no pueden formar ciclos.")
        enCurso.add(id)
        const actividad = actividades.find(item => item.id === id)
        if (!actividad) throw new Error("Una secuencia referencia una actividad inexistente.")
        const grupo = grupos.get(actividad.secuenciaId)
        const indice = grupo.findIndex(item => item.id === id)
        let inicio
        if (indice > 0) inicio = obtenerInicio(grupo[indice - 1].id) + grupo[indice - 1].duracionSegundos
        else inicio = actividad.anclaActividadId == null
            ? actividad.desplazamientoAnclaSegundos ?? 0
            : obtenerInicio(actividad.anclaActividadId) + (actividad.desplazamientoAnclaSegundos ?? 0)
        enCurso.delete(id)
        inicios.set(id, inicio)
        return inicio
    }
    try {
        for (const actividad of actividades) obtenerInicio(actividad.id)
        return actividades.map(actividad => ({ ...actividad, inicioDesplazamientoSegundos: inicios.get(actividad.id) }))
    } catch (error) {
        return informarError ? { error: error.message } : []
    }
}

function materializarActividades(plantilla) {
    return plantilla.modo === "secuencias" ? obtenerActividadesSecuenciadas(plantilla.actividades) : plantilla.actividades
}

export function validarColeccionPlantillasPlanificacion(plantillas) {
    if (!Array.isArray(plantillas)) return false
    const ids = new Set()
    return plantillas.every(plantilla => {
        // Admite colecciones antiguas para que puedan abrirse y editarse; crear/aplicar requieren dos actividades.
        if (typeof plantilla?.id !== "string" || !plantilla.id.trim() || ids.has(plantilla.id) || validarPlantillaPlanificacion(plantilla, { minimoActividades: 1, permitirSecuenciaExtendida: true })) return false
        ids.add(plantilla.id)
        return true
    })
}

export function crearPlantillaPlanificacion(datos, generarId = () => globalThis.crypto.randomUUID()) {
    const plantilla = { id: "pendiente", nombre: datos?.nombre, modo: datos?.modo ?? "horarios", actividades: datos?.actividades }
    const error = validarPlantillaPlanificacion(plantilla)
    if (error) return { ok: false, error }
    const id = identidad(generarId, "No se pudo crear la identidad de la plantilla.")
    if (typeof id !== "string") return { ok: false, error: id.error }
    const actividades = []
    for (const actividad of plantilla.actividades) {
        const actividadId = actividad.id || identidad(generarId, "No se pudo crear la identidad de una actividad.")
        if (typeof actividadId !== "string") return { ok: false, error: actividadId.error }
        actividades.push({ ...actividad, id: actividadId, nombre: actividad.nombre.trim() })
    }
    return { ok: true, plantilla: { ...plantilla, id, nombre: plantilla.nombre.trim(), actividades } }
}

export function actualizarPlantillaPlanificacion(plantillas, id, cambios, generarId = () => globalThis.crypto.randomUUID()) {
    if (!plantillas.some(item => item.id === id)) return { ok: false, error: "No se encontró la plantilla de planificación que querés editar." }
    const actual = plantillas.find(item => item.id === id)
    const actividades = Array.isArray(cambios?.actividades)
        ? cambios.actividades.map((actividad, indice) => ({ ...actividad, id: actividad.id || actual.actividades[indice]?.id || identidad(generarId, "No se pudo crear la identidad de una actividad.") }))
        : cambios?.actividades
    const plantilla = { ...actual, nombre: cambios?.nombre, modo: cambios?.modo ?? actual.modo ?? "horarios", actividades }
    const error = validarPlantillaPlanificacion(plantilla)
    if (error) return { ok: false, error }
    return { ok: true, plantillas: plantillas.map(item => item.id === id ? {
        ...plantilla,
        nombre: plantilla.nombre.trim(),
        actividades: plantilla.actividades.map(actividad => ({ ...actividad, nombre: actividad.nombre.trim() }))
    } : item) }
}

export function eliminarPlantillaPlanificacion(plantillas, id) {
    if (!plantillas.some(item => item.id === id)) return { ok: false, error: "No se encontró la plantilla de planificación que querés eliminar." }
    return { ok: true, plantillas: plantillas.filter(item => item.id !== id) }
}

function fechaConSegundos(fecha, segundos, dia = 0) {
    const diasAdicionales = Math.floor(segundos / 86400)
    const segundosDelDia = segundos % 86400
    const destino = desplazarDia(fecha, dia + diasAdicionales)
    if (!destino) return null
    destino.setHours(0, 0, 0, 0)
    destino.setSeconds(segundosDelDia)
    return destino
}

export function yaAplicadaEnFecha(planes, plantillaId, fecha) {
    const dia = formatearFechaISO(fecha)
    return planes.some(plan => plan.plantillaOrigenId === plantillaId && plan.fechaAplicacion === dia)
}

function prepararActividadesPlantilla(plantilla, fecha, eventos, opciones = {}) {
    const error = validarPlantillaPlanificacion(plantilla)
    const dia = normalizarFechaLocal(fecha)
    if (error) return { ok: false, error }
    if (!dia) return { ok: false, error: "Elegí una fecha válida para aplicar la plantilla." }
    const ahora = opciones.ahora ?? new Date()
    if (!(ahora instanceof Date) || !Number.isFinite(ahora.getTime())) return { ok: false, error: "No se pudo comprobar la hora actual. Volvé a intentar." }
    const hoy = normalizarFechaLocal(ahora)
    if (dia < hoy) return { ok: false, error: "No se puede aplicar una planificación en una fecha pasada. Elegí hoy o un día futuro." }
    const modo = plantilla.modo ?? "horarios"
    const horaInicio = opciones.horaInicioSegundos
    if ((modo === "duraciones" || modo === "relativo" || modo === "secuencias") && (!Number.isInteger(horaInicio) || horaInicio < 0 || horaInicio >= 86400)) return { ok: false, error: "Elegí una hora de inicio válida para aplicar esta secuencia." }
    const actividades = []
    let cursor = horaInicio
    for (const actividad of materializarActividades(plantilla)) {
        const evento = actividad.eventoId ? eventos.find(item => item.id === actividad.eventoId) : null
        if (actividad.eventoId && !evento) return { ok: false, error: `No se pudo aplicar "${plantilla.nombre}": el evento "${actividad.nombre}" ya no está disponible. Editá la plantilla y elegí otro evento.` }
        const inicioSegundos = modo === "duraciones" ? cursor : modo === "relativo" || modo === "secuencias" ? horaInicio + actividad.inicioDesplazamientoSegundos : actividad.inicioSegundos
        const finAbsoluto = modo === "duraciones" ? cursor + actividad.duracionSegundos : modo === "relativo" || modo === "secuencias" ? inicioSegundos + actividad.duracionSegundos : null
        const inicio = fechaConSegundos(dia, inicioSegundos)
        const fin = modo === "duraciones" || modo === "relativo" || modo === "secuencias"
            ? fechaConSegundos(dia, finAbsoluto)
            : fechaConSegundos(dia, actividad.finSegundos, actividad.finDia)
        if (!inicio || !fin || fin <= inicio) return { ok: false, error: `No se pudo crear el horario de "${actividad.nombre}" en esa fecha.` }
        if (inicio <= ahora) return { ok: false, error: `No se puede aplicar la actividad "${actividad.nombre}" a las ${inicio.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })}: ese horario ya pasó o ya está transcurriendo. Ajustá el horario o elegí una fecha futura.` }
        actividades.push({ actividad, evento, inicio, fin })
        if (modo === "duraciones") cursor = finAbsoluto
    }
    return { ok: true, dia, actividades }
}

export function previsualizarPlantillaPlanificacion(plantilla, fecha, eventos, opciones = {}) {
    const resultado = prepararActividadesPlantilla(plantilla, fecha, eventos, opciones)
    if (!resultado.ok) return resultado
    return {
        ok: true,
        actividades: resultado.actividades.map(({ actividad, evento, inicio, fin }) => ({
            nombre: evento?.nombre ?? actividad.nombre,
            eventoNombre: evento?.nombre ?? null,
            inicio,
            fin
        }))
    }
}

export function aplicarPlantillaPlanificacion(plantilla, fecha, eventos, opciones = {}, generarId = () => globalThis.crypto.randomUUID()) {
    const preparado = prepararActividadesPlantilla(plantilla, fecha, eventos, opciones)
    if (!preparado.ok) return preparado
    const idAplicacion = opciones.idAplicacion ?? identidad(generarId, "No se pudo identificar esta aplicación de plantilla.")
    if (typeof idAplicacion !== "string") return { ok: false, error: idAplicacion.error }
    const planes = []
    for (const { actividad, evento, inicio, fin } of preparado.actividades) {
        const resultado = crearPlan({ nombre: actividad.nombre, evento, inicio, fin }, generarId)
        if (!resultado.ok) return resultado
        planes.push({ ...resultado.plan, plantillaOrigenId: plantilla.id, plantillaOrigenNombre: plantilla.nombre, fechaAplicacion: formatearFechaISO(preparado.dia), idAplicacionPlantilla: idAplicacion })
    }
    return { ok: true, planes }
}
