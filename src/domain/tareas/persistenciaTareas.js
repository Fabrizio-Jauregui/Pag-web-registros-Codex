import { DESTINOS_TAREA, ESTADOS_TAREA } from "./tareas.js"

export const CLAVE_TAREAS = "focus.tareas.v1"

function validarColeccion(tareas) {
    if (!Array.isArray(tareas)) return false
    const ids = new Set()
    return tareas.every(tarea => {
        if (!tarea || typeof tarea !== "object" || Array.isArray(tarea)
            || typeof tarea.id !== "string" || !tarea.id.trim() || ids.has(tarea.id)
            || typeof tarea.nombre !== "string" || !tarea.nombre.trim() || tarea.nombre.trim().length > 120
            || !ESTADOS_TAREA.includes(tarea.estado)
            || (tarea.destino !== undefined && !DESTINOS_TAREA.includes(tarea.destino))
            || (tarea.ordenFocus !== undefined && tarea.ordenFocus !== null
                && (!Number.isInteger(tarea.ordenFocus) || tarea.ordenFocus < 1))
            || typeof tarea.creadaEn !== "string" || !Number.isFinite(Date.parse(tarea.creadaEn))
            || typeof tarea.actualizadaEn !== "string" || !Number.isFinite(Date.parse(tarea.actualizadaEn))) return false
        ids.add(tarea.id)
        return true
    })
}

export function cargarTareas(almacenamiento = null) {
    try {
        const valor = (almacenamiento ?? globalThis.localStorage).getItem(CLAVE_TAREAS)
        if (valor === null) return { ok: true, tareas: [] }
        let tareas
        try { tareas = JSON.parse(valor) } catch {
            return { ok: false, error: "Las tareas guardadas no tienen un formato JSON válido. No se modificaron los datos." }
        }
        if (!validarColeccion(tareas)) return { ok: false, error: "Las tareas guardadas tienen datos inválidos. No se modificaron los datos." }
        const normalizadas = tareas.map(tarea => ({
            ...tarea,
            destino: tarea.destino ?? "backlog",
            estado: (tarea.destino ?? "backlog") === "backlog" && tarea.estado === "En curso" ? "Pendiente" : tarea.estado,
            ordenFocus: tarea.destino === "focus" ? tarea.ordenFocus ?? null : null
        }))
        let siguienteOrden = 1
        const cola = normalizadas.filter(tarea => tarea.destino === "focus"
            && !["Completada", "Cancelada", "Boceto"].includes(tarea.estado))
            .sort((a, b) => (a.ordenFocus ?? Number.MAX_SAFE_INTEGER) - (b.ordenFocus ?? Number.MAX_SAFE_INTEGER))
        for (const tarea of cola) tarea.ordenFocus = siguienteOrden++
        return { ok: true, tareas: normalizadas }
    } catch { return { ok: false, error: "No se pudieron leer las tareas guardadas en este navegador." } }
}

export function guardarTareas(tareas, almacenamiento = null) {
    if (!validarColeccion(tareas)) return { ok: false, error: "No se guardaron los cambios porque la lista de tareas no es válida." }
    try {
        (almacenamiento ?? globalThis.localStorage).setItem(CLAVE_TAREAS, JSON.stringify(tareas))
        return { ok: true }
    } catch { return { ok: false, error: "No se pudieron guardar las tareas en este navegador. Verificá el espacio disponible y los permisos de almacenamiento." } }
}
