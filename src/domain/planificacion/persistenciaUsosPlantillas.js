import { formatearFechaISO, leerFechaISO } from "../tiempo/FechaCalendario.js"

export const CLAVE_USOS_PLANTILLAS_PLANIFICACION = "focus.usos-plantillas-planes.v1"

function esUsoValido(uso) {
    return uso && typeof uso === "object" && !Array.isArray(uso)
        && typeof uso.plantillaId === "string" && uso.plantillaId.trim() !== ""
        && typeof uso.fecha === "string" && leerFechaISO(uso.fecha) !== null
        && formatearFechaISO(leerFechaISO(uso.fecha)) === uso.fecha
        && typeof uso.idAplicacionPlantilla === "string" && uso.idAplicacionPlantilla.trim() !== ""
        && typeof uso.usadaEn === "string" && Number.isFinite(Date.parse(uso.usadaEn))
}

export function cargarUsosPlantillasPlanificacion(almacenamiento = null) {
    try {
        const contenido = (almacenamiento ?? globalThis.localStorage).getItem(CLAVE_USOS_PLANTILLAS_PLANIFICACION)
        if (contenido === null) return { ok: true, usos: [] }
        const usos = JSON.parse(contenido)
        if (!Array.isArray(usos) || usos.some(uso => !esUsoValido(uso))) {
            return { ok: false, usos: [], error: "Los usos guardados de las plantillas de planificación tienen datos inválidos." }
        }
        return { ok: true, usos }
    } catch {
        return { ok: false, usos: [], error: "No se pudieron leer los usos de plantillas guardados en este navegador." }
    }
}

export function guardarUsosPlantillasPlanificacion(usos, almacenamiento = null) {
    if (!Array.isArray(usos) || usos.some(uso => !esUsoValido(uso))) {
        return { ok: false, error: "No se guardaron los cambios porque los usos de plantillas tienen datos inválidos." }
    }
    const claves = usos.map(uso => `${uso.plantillaId}\u0000${uso.fecha}`)
    if (new Set(claves).size !== claves.length) {
        return { ok: false, error: "La plantilla ya tiene un uso guardado para esa fecha." }
    }
    try {
        (almacenamiento ?? globalThis.localStorage).setItem(CLAVE_USOS_PLANTILLAS_PLANIFICACION, JSON.stringify(usos))
        return { ok: true }
    } catch {
        return { ok: false, error: "No se pudo guardar el uso de la plantilla en este navegador." }
    }
}

export function eliminarUsosPlantillasPlanificacionCorruptos(almacenamiento = null) {
    try {
        (almacenamiento ?? globalThis.localStorage).removeItem(CLAVE_USOS_PLANTILLAS_PLANIFICACION)
        return { ok: true }
    } catch {
        return { ok: false, error: "No se pudieron eliminar los usos de plantillas corruptos." }
    }
}

export function plantillaUsadaEnFecha(usos, plantillaId, fecha) {
    const fechaISO = typeof fecha === "string" ? fecha : formatearFechaISO(fecha)
    return Array.isArray(usos) && usos.some(uso => uso.plantillaId === plantillaId && uso.fecha === fechaISO)
}
