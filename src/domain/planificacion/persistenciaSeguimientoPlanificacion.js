import { validarEstadoSeguimiento } from "./seguimientoPlanificacion.js"

export const CLAVE_SEGUIMIENTO_PLANIFICACION = "focus.seguimiento-planificacion.v1"

export function cargarSeguimientoPlanificacion(almacenamiento = null) {
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        const contenido = almacen.getItem(CLAVE_SEGUIMIENTO_PLANIFICACION)
        if (contenido === null) return { ok: true, estado: null }
        const estado = JSON.parse(contenido)
        if (estado === null || validarEstadoSeguimiento(estado)) return { ok: true, estado }
        return { ok: false, estado: null, error: "El seguimiento guardado tiene datos inválidos." }
    } catch {
        return { ok: false, estado: null, error: "No se pudo leer el seguimiento guardado." }
    }
}

export function guardarSeguimientoPlanificacion(estado, almacenamiento = null) {
    if (estado !== null && !validarEstadoSeguimiento(estado)) {
        return { ok: false, error: "El seguimiento contiene datos inválidos." }
    }
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        if (estado === null) almacen.removeItem(CLAVE_SEGUIMIENTO_PLANIFICACION)
        else almacen.setItem(CLAVE_SEGUIMIENTO_PLANIFICACION, JSON.stringify(estado))
        return { ok: true }
    } catch {
        return { ok: false, error: "No se pudo guardar el seguimiento en este navegador." }
    }
}
