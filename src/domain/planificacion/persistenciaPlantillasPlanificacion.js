import { validarColeccionPlantillasPlanificacion, validarPlantillaPlanificacion } from "./plantillasPlanificacion.js"

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
        if (!Array.isArray(plantillas)) return { ok: false, error: "Las plantillas de planificación no tienen formato de lista." }
        const validas = []
        const problemas = []
        const ids = new Set()
        plantillas.forEach((plantilla, indice) => {
            const detalle = validarPlantillaPlanificacion(plantilla)
            if (detalle || ids.has(plantilla?.id)) problemas.push({ indice, titulo: plantilla?.nombre || `Plantilla de planificación ${indice + 1}`, detalle: ids.has(plantilla?.id) ? "El identificador de la plantilla está repetido." : detalle })
            else { validas.push(plantilla); ids.add(plantilla.id) }
        })
        return { ok: true, plantillas: validas, ...(problemas.length ? { problemas } : {}) }
    } catch {
        return { ok: false, error: "No se pudieron leer las plantillas de planificación guardadas en este navegador." }
    }
}

export function guardarPlantillasPlanificacion(plantillas, almacenamiento = null) {
    if (!validarColeccionPlantillasPlanificacion(plantillas)) return { ok: false, error: "No se guardaron los cambios porque las plantillas de planificación tienen datos inválidos." }
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        let invalidas = []
        try {
            const actuales = JSON.parse(almacen.getItem(CLAVE_PLANTILLAS_PLANIFICACION) ?? "[]")
            if (!Array.isArray(actuales)) return { ok: false, error: "La colección de plantillas está corrupta; eliminála desde la revisión de datos antes de continuar." }
            const vistos = new Set()
            const idsValidosActuales = new Set()
            invalidas = actuales.filter(plantilla => {
                if (validarPlantillaPlanificacion(plantilla) || vistos.has(plantilla?.id)) return true
                vistos.add(plantilla.id)
                idsValidosActuales.add(plantilla.id)
                return false
            })
            const idsNuevos = new Set(plantillas.map(plantilla => plantilla.id))
            const idsEliminados = new Set([...idsValidosActuales].filter(id => !idsNuevos.has(id)))
            invalidas = invalidas.filter(plantilla => !idsEliminados.has(plantilla?.id))
        } catch { return { ok: false, error: "La colección de plantillas está corrupta; eliminála desde la revisión de datos antes de continuar." }
        }
        almacen.setItem(CLAVE_PLANTILLAS_PLANIFICACION, JSON.stringify([...plantillas, ...invalidas]))
        return { ok: true }
    } catch {
        return { ok: false, error: "No se pudieron guardar las plantillas de planificación en este navegador. Verificá el espacio disponible y los permisos de almacenamiento." }
    }
}

export function eliminarPlantillaPlanificacionInvalida(indice, almacenamiento = null) {
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        const plantillas = JSON.parse(almacen.getItem(CLAVE_PLANTILLAS_PLANIFICACION) ?? "null")
        if (!Array.isArray(plantillas) || !Number.isInteger(indice) || indice < 0 || indice >= plantillas.length) return { ok: false, error: "No se encontró esa plantilla inválida." }
        plantillas.splice(indice, 1)
        almacen.setItem(CLAVE_PLANTILLAS_PLANIFICACION, JSON.stringify(plantillas))
        return { ok: true }
    } catch { return { ok: false, error: "No se pudo eliminar la plantilla inválida." } }
}

export function eliminarColeccionPlantillasPlanificacionCorrupta(almacenamiento = null) {
    try { (almacenamiento ?? globalThis.localStorage).removeItem(CLAVE_PLANTILLAS_PLANIFICACION); return { ok: true } }
    catch { return { ok: false, error: "No se pudo eliminar la colección corrupta." } }
}
