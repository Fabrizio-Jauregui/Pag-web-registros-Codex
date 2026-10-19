export const ESTADOS_TAREA = ["Boceto", "Pendiente", "En curso", "Completada", "Cancelada"]
export const DESTINOS_TAREA = ["backlog", "focus"]

function siguienteOrdenFocus(tareas) {
    return tareas.reduce((maximo, tarea) => (
        tarea.destino === "focus" && !["Boceto", "Completada", "Cancelada"].includes(tarea.estado)
            ? Math.max(maximo, tarea.ordenFocus ?? 0)
            : maximo
    ), 0) + 1
}

export function validarTarea(nombre, estado) {
    if (typeof nombre !== "string" || nombre.trim() === "") return "El nombre de la tarea es obligatorio."
    if (nombre.trim().length > 120) return "El nombre no puede superar los 120 caracteres."
    if (!ESTADOS_TAREA.includes(estado)) return "Seleccioná un estado válido."
    return null
}

function obtenerMarcaTiempo(ahora) {
    try {
        const fecha = ahora()
        return fecha instanceof Date && Number.isFinite(fecha.getTime()) ? fecha.toISOString() : null
    } catch { return null }
}

export function crearTarea(nombre, estado = "Pendiente", generarId = () => globalThis.crypto.randomUUID(), ahora = () => new Date(), destino = "backlog", ordenFocus = null) {
    const error = validarTarea(nombre, estado)
    if (error) return { ok: false, error }
    if (!DESTINOS_TAREA.includes(destino)) return { ok: false, error: "Seleccioná Backlog o Cola Focus como destino." }
    if (estado === "En curso") return { ok: false, error: "El estado En curso se asigna automáticamente a la tarea activa de una sesión Focus." }
    let id
    try { id = generarId() } catch { return { ok: false, error: "No se pudo crear la identidad de la tarea." } }
    if (typeof id !== "string" || !id.trim()) return { ok: false, error: "No se pudo crear la identidad de la tarea." }
    const marcaTiempo = obtenerMarcaTiempo(ahora)
    if (!marcaTiempo) return { ok: false, error: "No se pudo registrar la fecha de creación de la tarea." }
    return { ok: true, tarea: { id, nombre: nombre.trim(), estado, destino, ordenFocus: destino === "focus" ? ordenFocus : null, creadaEn: marcaTiempo, actualizadaEn: marcaTiempo } }
}

export function actualizarTarea(tareas, id, cambios, ahora = () => new Date()) {
    const indice = tareas.findIndex(tarea => tarea.id === id)
    if (indice === -1) return { ok: false, error: "No se encontró la tarea que querés editar." }
    const nombre = cambios?.nombre ?? tareas[indice].nombre
    const estado = cambios?.estado ?? tareas[indice].estado
    const error = validarTarea(nombre, estado)
    if (error) return { ok: false, error }
    const destino = cambios?.destino ?? tareas[indice].destino ?? "backlog"
    if (!DESTINOS_TAREA.includes(destino)) return { ok: false, error: "Seleccioná Backlog o Cola Focus como destino." }
    if (estado === "En curso" && tareas[indice].estado !== "En curso") {
        return { ok: false, error: "El estado En curso se asigna automáticamente a la tarea activa de una sesión Focus." }
    }
    if (estado === "En curso" && destino !== "focus") {
        return { ok: false, error: "Una tarea En curso debe estar en Cola Focus." }
    }
    if (["Completada", "Cancelada"].includes(estado) && destino !== (tareas[indice].destino ?? "backlog")) {
        return { ok: false, error: "Las tareas completadas o canceladas no se pueden mover de cola." }
    }
    const cola = tareas.filter(tarea => tarea.destino === "focus"
        && tarea.id !== id && !["Completada", "Cancelada", "Boceto"].includes(tarea.estado))
    const mantieneOrden = destino === (tareas[indice].destino ?? "backlog")
        && !["Boceto", "Completada", "Cancelada"].includes(estado)
    const ordenFocus = destino === "focus"
        ? mantieneOrden ? tareas[indice].ordenFocus ?? siguienteOrdenFocus(cola) : siguienteOrdenFocus(cola)
        : null
    const actualizadaEn = obtenerMarcaTiempo(ahora)
    if (!actualizadaEn) return { ok: false, error: "No se pudo registrar la fecha de actualización de la tarea." }
    const nuevasTareas = tareas.map(tarea => tarea.id === id
        ? { ...tarea, nombre: nombre.trim(), estado, destino, ordenFocus, actualizadaEn }
        : tarea)
    return { ok: true, tareas: nuevasTareas }
}

export function sincronizarEstadoTareasFocus(tareas, tareaActivaId, ahora = () => new Date()) {
    const tareaActiva = tareas.find(tarea => tarea.id === tareaActivaId
        && tarea.destino === "focus"
        && !["Boceto", "Completada", "Cancelada"].includes(tarea.estado))
    const idActivaValido = tareaActiva?.id ?? null
    const hayCambios = tareas.some(tarea => (
        tarea.id === idActivaValido ? tarea.estado !== "En curso" : tarea.estado === "En curso"
    ))
    if (!hayCambios) return { ok: true, tareas }
    const actualizadaEn = obtenerMarcaTiempo(ahora)
    if (!actualizadaEn) return { ok: false, error: "No se pudo registrar la fecha de actualización de la tarea." }
    return {
        ok: true,
        tareas: tareas.map(tarea => {
            const estado = tarea.id === idActivaValido ? "En curso" : tarea.estado === "En curso" ? "Pendiente" : tarea.estado
            return estado === tarea.estado ? tarea : { ...tarea, estado, actualizadaEn }
        })
    }
}

export function eliminarTarea(tareas, id) {
    if (!tareas.some(tarea => tarea.id === id)) return { ok: false, error: "No se encontró la tarea que querés eliminar." }
    return { ok: true, tareas: tareas.filter(tarea => tarea.id !== id) }
}

export function ordenarTareasFocus(tareas, idsOrdenados) {
    if (!Array.isArray(idsOrdenados)) return { ok: false, error: "El orden de Cola Focus no es válido." }
    const focus = tareas.filter(tarea => tarea.destino === "focus" && !["Completada", "Cancelada", "Boceto"].includes(tarea.estado))
    const idsEsperados = new Set(focus.map(tarea => tarea.id))
    if (idsOrdenados.length !== idsEsperados.size || idsOrdenados.some(id => !idsEsperados.has(id))
        || new Set(idsOrdenados).size !== idsOrdenados.length) {
        return { ok: false, error: "La lista reordenada no coincide con las tareas de Cola Focus." }
    }
    const ordenes = new Map(idsOrdenados.map((id, indice) => [id, indice + 1]))
    return {
        ok: true,
        tareas: tareas.map(tarea => ordenes.has(tarea.id) ? { ...tarea, ordenFocus: ordenes.get(tarea.id) } : tarea)
    }
}

export function cambiarDestinoTarea(tareas, id, destino) {
    if (!DESTINOS_TAREA.includes(destino)) return { ok: false, error: "Seleccioná Backlog o Cola Focus como destino." }
    const tarea = tareas.find(item => item.id === id)
    if (!tarea) return { ok: false, error: "No se encontró la tarea que querés mover." }
    if (["Completada", "Cancelada"].includes(tarea.estado)) return { ok: false, error: "Las tareas completadas o canceladas no se pueden mover de cola." }
    if (tarea.estado === "En curso" && destino !== "focus") return { ok: false, error: "Una tarea En curso debe permanecer en Cola Focus." }
    const focus = tareas.filter(item => item.destino === "focus" && !["Completada", "Cancelada", "Boceto"].includes(item.estado))
    const ordenFocus = destino === "focus" ? siguienteOrdenFocus(focus) : null
    return {
        ok: true,
        tareas: tareas.map(item => item.id === id ? { ...item, destino, ordenFocus } : item)
    }
}

export function moverTareaEnCola(tareas, id, direccion, tareaActivaId = null) {
    const cola = tareas.filter(tarea => tarea.destino === "focus" && !["Completada", "Cancelada", "Boceto"].includes(tarea.estado))
        .sort((a, b) => (a.ordenFocus ?? Number.MAX_SAFE_INTEGER) - (b.ordenFocus ?? Number.MAX_SAFE_INTEGER))
    const indiceActivo = cola.findIndex(tarea => tarea.id === tareaActivaId)
    const inicioMovible = indiceActivo >= 0 ? indiceActivo + 1 : 0
    const indice = cola.findIndex(tarea => tarea.id === id)
    const destinoIndice = indice + direccion
    if (indice < inicioMovible || destinoIndice < inicioMovible || destinoIndice >= cola.length) {
        return { ok: false, error: "La tarea activa queda fija y las demás solo se reordenan detrás de ella." }
    }
    ;[cola[indice], cola[destinoIndice]] = [cola[destinoIndice], cola[indice]]
    return ordenarTareasFocus(tareas, cola.map(tarea => tarea.id))
}

export function posponerTareaEnCola(tareas, id, modo = "despues-siguiente") {
    if (!["despues-siguiente", "final"].includes(modo)) return { ok: false, error: "Elegí cómo posponer la tarea." }
    const cola = tareas.filter(tarea => tarea.destino === "focus" && !["Completada", "Cancelada", "Boceto"].includes(tarea.estado))
        .sort((a, b) => (a.ordenFocus ?? Number.MAX_SAFE_INTEGER) - (b.ordenFocus ?? Number.MAX_SAFE_INTEGER))
    const indice = cola.findIndex(tarea => tarea.id === id)
    if (indice < 0) return { ok: false, error: "La tarea no está en Cola Focus." }
    if (cola.length < 2 && modo === "despues-siguiente") return { ok: false, error: "No hay otra tarea después de la cual posponerla." }
    const [pospuesta] = cola.splice(indice, 1)
    if (modo === "despues-siguiente") cola.splice(Math.min(indice, cola.length - 1) + 1, 0, pospuesta)
    else cola.push(pospuesta)
    return ordenarTareasFocus(tareas, cola.map(tarea => tarea.id))
}
