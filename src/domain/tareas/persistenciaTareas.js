import { DESTINOS_TAREA, ESTADOS_OBJETIVO, ESTADOS_TAREA } from "./tareas.js"

export const CLAVE_TAREAS = "focus.tareas.v1"

function validarColeccion(tareas) {
    if (!Array.isArray(tareas)) return false
    const ids = new Set()
    const validas = tareas.every(tarea => {
        if (!tarea || typeof tarea !== "object" || Array.isArray(tarea)
            || typeof tarea.id !== "string" || !tarea.id.trim() || ids.has(tarea.id)
            || typeof tarea.nombre !== "string" || !tarea.nombre.trim() || tarea.nombre.trim().length > 120
            || typeof tarea.creadaEn !== "string" || !Number.isFinite(Date.parse(tarea.creadaEn))
            || typeof tarea.actualizadaEn !== "string" || !Number.isFinite(Date.parse(tarea.actualizadaEn))) return false
        if (tarea.tipo === "objetivo") {
            if (!ESTADOS_OBJETIVO.includes(tarea.estado)) return false
        } else if ((tarea.tipo !== undefined && tarea.tipo !== "tarea")
            || !ESTADOS_TAREA.includes(tarea.estado)
            || (tarea.destino !== undefined && !DESTINOS_TAREA.includes(tarea.destino))
            || (tarea.ordenFocus !== undefined && tarea.ordenFocus !== null
                && (!Number.isInteger(tarea.ordenFocus) || tarea.ordenFocus < 1))
            || (tarea.ordenArbol !== undefined && (!Number.isInteger(tarea.ordenArbol) || tarea.ordenArbol < 1))
            || (tarea.objetivoId !== undefined && tarea.objetivoId !== null && typeof tarea.objetivoId !== "string")
            || (tarea.padreId !== undefined && tarea.padreId !== null && typeof tarea.padreId !== "string")) return false
        ids.add(tarea.id)
        return true
    })
    if (!validas) return false
    const porId = new Map(tareas.map(tarea => [tarea.id, tarea]))
    return tareas.every(tarea => {
        if (tarea.tipo === "objetivo") return true
        const objetivoId = tarea.objetivoId ?? null
        if (objetivoId && porId.get(objetivoId)?.tipo !== "objetivo") return false
        const padreId = tarea.padreId ?? objetivoId
        if (!padreId) return true
        const padre = porId.get(padreId)
        if (!padre) return false
        const objetivoPadre = padre.tipo === "objetivo" ? padre.id : padre.objetivoId ?? null
        if (objetivoId !== objetivoPadre) return false
        const visitados = new Set([tarea.id])
        let cursor = padre
        while (cursor && cursor.tipo !== "objetivo") {
            if (visitados.has(cursor.id)) return false
            visitados.add(cursor.id)
            cursor = porId.get(cursor.padreId) ?? null
        }
        return Boolean(cursor && cursor.id === objetivoId)
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
        const normalizadas = tareas.map((tarea, indice) => tarea.tipo === "objetivo"
            ? tarea
            : {
                ...tarea,
                tipo: "tarea",
                objetivoId: tarea.objetivoId ?? null,
                padreId: tarea.padreId ?? tarea.objetivoId ?? null,
                ordenArbol: tarea.ordenArbol ?? indice + 1,
                destino: tarea.destino ?? "backlog",
                estado: (tarea.destino ?? "backlog") === "backlog" && tarea.estado === "En curso" ? "Pendiente" : tarea.estado,
                ordenFocus: tarea.destino === "focus" ? tarea.ordenFocus ?? null : null
            })
        let siguienteOrden = 1
        const cola = normalizadas.filter(tarea => tarea.tipo !== "objetivo" && tarea.destino === "focus"
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
