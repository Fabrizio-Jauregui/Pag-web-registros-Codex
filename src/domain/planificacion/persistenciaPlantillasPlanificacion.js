import { validarColeccionPlantillasPlanificacion } from "./plantillasPlanificacion.js"

export const CLAVE_PLANTILLAS_PLANIFICACION = "focus.plantillas-planes.v1"

export function cargarPlantillasPlanificacion(almacenamiento = null) {
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        const contenido = almacen.getItem(CLAVE_PLANTILLAS_PLANIFICACION)
        if (contenido === null) return { ok: true, plantillas: [] }
        let plantillas
        try { plantillas = JSON.parse(contenido) } catch {
            return { ok: false, error: "Las plantillas de planificación guardadas no tienen un formato JSON válido. No se modificaron los datos." }
        }
        if (!validarColeccionPlantillasPlanificacion(plantillas)) return { ok: false, error: "Las plantillas de planificación guardadas tienen datos inválidos. No se modificaron los datos." }
        return { ok: true, plantillas }
    } catch {
        return { ok: false, error: "No se pudieron leer las plantillas de planificación guardadas en este navegador." }
    }
}

export function guardarPlantillasPlanificacion(plantillas, almacenamiento = null) {
    if (!validarColeccionPlantillasPlanificacion(plantillas)) return { ok: false, error: "No se guardaron los cambios porque las plantillas de planificación tienen datos inválidos." }
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        almacen.setItem(CLAVE_PLANTILLAS_PLANIFICACION, JSON.stringify(plantillas))
        return { ok: true }
    } catch {
        return { ok: false, error: "No se pudieron guardar las plantillas de planificación en este navegador. Verificá el espacio disponible y los permisos de almacenamiento." }
    }
}
