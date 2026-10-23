export const ESTADOS_TAREA = ["Boceto", "Pendiente", "En curso", "Completada", "Cancelada"]
export const DESTINOS_TAREA = ["backlog", "focus"]
export const ESTADOS_OBJETIVO = ["Activo", "Completado", "Cancelado"]

function marcaTiempo(ahora) {
    return obtenerMarcaTiempo(ahora)
}

export function crearObjetivo(nombre, generarId = () => globalThis.crypto.randomUUID(), ahora = () => new Date()) {
    if (typeof nombre !== "string" || !nombre.trim()) return { ok: false, error: "El nombre del objetivo es obligatorio." }
    if (nombre.trim().length > 120) return { ok: false, error: "El nombre no puede superar los 120 caracteres." }
    let id
    try { id = generarId() } catch { return { ok: false, error: "No se pudo crear la identidad del objetivo." } }
    if (typeof id !== "string" || !id.trim()) return { ok: false, error: "No se pudo crear la identidad del objetivo." }
    const instante = marcaTiempo(ahora)
    if (!instante) return { ok: false, error: "No se pudo registrar la fecha de creación del objetivo." }
    return { ok: true, objetivo: { id, tipo: "objetivo", nombre: nombre.trim(), estado: "Activo", creadaEn: instante, actualizadaEn: instante } }
}

export function actualizarObjetivo(tareas, id, cambios, ahora = () => new Date()) {
    const indice = tareas.findIndex(item => item.id === id && item.tipo === "objetivo")
    if (indice < 0) return { ok: false, error: "No se encontró el objetivo que querés editar." }
    const nombre = cambios?.nombre ?? tareas[indice].nombre
    if (typeof nombre !== "string" || !nombre.trim()) return { ok: false, error: "El nombre del objetivo es obligatorio." }
    if (nombre.trim().length > 120) return { ok: false, error: "El nombre no puede superar los 120 caracteres." }
    const actualizadaEn = obtenerMarcaTiempo(ahora)
    if (!actualizadaEn) return { ok: false, error: "No se pudo registrar la fecha de actualización del objetivo." }
    return { ok: true, tareas: tareas.map(item => item.id === id ? { ...item, nombre: nombre.trim(), actualizadaEn } : item) }
}

export function descendientesDe(tareas, id) {
    const resultado = []
    const pendientes = [id]
    while (pendientes.length) {
        const padreId = pendientes.pop()
        for (const tarea of tareas) {
            if (tarea.tipo !== "objetivo" && tarea.padreId === padreId) {
                resultado.push(tarea)
                pendientes.push(tarea.id)
            }
        }
    }
    return resultado
}

export function obtenerRutaTarea(tareas, objetivos, id) {
    const porId = new Map(tareas.map(tarea => [tarea.id, tarea]))
    const objetivosPorId = new Map(objetivos.map(objetivo => [objetivo.id, objetivo]))
    const ruta = []
    const vistos = new Set()
    let actual = porId.get(id)
    while (actual && !vistos.has(actual.id)) {
        vistos.add(actual.id)
        ruta.unshift(actual.nombre)
        actual = porId.get(actual.padreId)
    }
    const objetivo = objetivosPorId.get(porId.get(id)?.objetivoId)
    if (objetivo) ruta.unshift(objetivo.nombre)
    return ruta.join(" › ")
}

export function puedeAsignarPadre(tareas, id, padreId) {
    if (!padreId) return { ok: true }
    const padre = tareas.find(item => item.id === padreId)
    if (!padre || padre.id === id || descendientesDe(tareas, id).some(item => item.id === padreId)) {
        return { ok: false, error: "La tarea no puede quedar anidada bajo esa ubicación." }
    }
    return { ok: true }
}

export function cambiarEstadoRama(tareas, id, estado, alcance = "solo", tareaActivaId = null, ahora = () => new Date(), desdeFocus = false) {
    if (!["Completada", "Cancelada"].includes(estado)) return { ok: false, error: "Elegí completar o cancelar la tarea." }
    if (!["solo", "rama"].includes(alcance)) return { ok: false, error: "Elegí el alcance del cambio." }
    const nodo = tareas.find(item => item.id === id)
    if (!nodo) return { ok: false, error: "No se encontró la tarea que querés actualizar." }
    const esObjetivo = nodo.tipo === "objetivo"
    const estadoFinal = esObjetivo ? (estado === "Completada" ? "Completado" : "Cancelado") : estado
    const descendientes = descendientesDe(tareas, id)
    const afectados = alcance === "rama" ? [nodo, ...descendientes] : [nodo]
    if (afectados.some(item => item.id === tareaActivaId && !(desdeFocus && alcance === "solo" && estado === "Completada")
        || item.estado === "En curso" && !(desdeFocus && alcance === "solo" && item.id === tareaActivaId && estado === "Completada"))) {
        return { ok: false, error: "Primero resolvé la tarea activa desde los controles de la sesión Focus." }
    }
    const instante = marcaTiempo(ahora)
    if (!instante) return { ok: false, error: "No se pudo registrar la fecha de actualización de la tarea." }
    return {
        ok: true,
        tareas: tareas.map(item => {
            if (item.id === id) return { ...item, estado: estadoFinal, ...(esObjetivo ? {} : { ordenFocus: null }), actualizadaEn: instante }
            if (alcance !== "rama" || !descendientes.some(descendiente => descendiente.id === item.id)
                || item.tipo === "objetivo" || ["Completada", "Cancelada"].includes(item.estado)) return item
            return { ...item, estado, ordenFocus: null, actualizadaEn: instante }
        })
    }
}

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

export function crearTarea(nombre, estado = "Pendiente", generarId = () => globalThis.crypto.randomUUID(), ahora = () => new Date(), destino = "backlog", ordenFocus = null, ubicacion = {}) {
    const error = validarTarea(nombre, estado)
    if (error) return { ok: false, error }
    if (!DESTINOS_TAREA.includes(destino)) return { ok: false, error: "Seleccioná Backlog o Cola Focus como destino." }
    if (estado === "En curso") return { ok: false, error: "El estado En curso se asigna automáticamente a la tarea activa de una sesión Focus." }
    let id
    try { id = generarId() } catch { return { ok: false, error: "No se pudo crear la identidad de la tarea." } }
    if (typeof id !== "string" || !id.trim()) return { ok: false, error: "No se pudo crear la identidad de la tarea." }
    const marcaTiempo = obtenerMarcaTiempo(ahora)
    if (!marcaTiempo) return { ok: false, error: "No se pudo registrar la fecha de creación de la tarea." }
    const objetivoId = ubicacion.objetivoId ?? null
    const padreId = ubicacion.padreId ?? objetivoId
    return { ok: true, tarea: { id, tipo: "tarea", nombre: nombre.trim(), estado, destino, ordenFocus: destino === "focus" ? ordenFocus : null, objetivoId, padreId, ordenArbol: ubicacion.ordenArbol ?? 1, creadaEn: marcaTiempo, actualizadaEn: marcaTiempo } }
}

export function actualizarTarea(tareas, id, cambios, ahora = () => new Date()) {
    const indice = tareas.findIndex(tarea => tarea.id === id)
    if (indice === -1) return { ok: false, error: "No se encontró la tarea que querés editar." }
    const nombre = cambios?.nombre ?? tareas[indice].nombre
    const estado = cambios?.estado ?? tareas[indice].estado
    const error = validarTarea(nombre, estado)
    if (error) return { ok: false, error }
    const destino = cambios?.destino ?? tareas[indice].destino ?? "backlog"
    const padreId = cambios?.padreId === undefined ? tareas[indice].padreId ?? tareas[indice].objetivoId ?? null : cambios.padreId
    const ubicacionValida = puedeAsignarPadre(tareas, id, padreId)
    if (!ubicacionValida.ok) return ubicacionValida
    const nuevoPadre = tareas.find(item => item.id === padreId)
    const objetivoId = nuevoPadre?.tipo === "objetivo" ? nuevoPadre.id : nuevoPadre?.objetivoId ?? null
    const cambiaPadre = padreId !== (tareas[indice].padreId ?? tareas[indice].objetivoId ?? null)
    const hermanos = tareas.filter(item => item.tipo !== "objetivo" && item.id !== id
        && (item.padreId ?? item.objetivoId ?? null) === padreId)
    const ordenArbol = cambiaPadre
        ? Math.max(0, ...hermanos.map(item => item.ordenArbol ?? 0)) + 1
        : tareas[indice].ordenArbol ?? 1
    const idsRama = new Set([id, ...descendientesDe(tareas, id).map(item => item.id)])
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
    const nuevasTareas = tareas.map(tarea => {
        if (!idsRama.has(tarea.id)) return tarea
        if (tarea.id === id) return { ...tarea, nombre: nombre.trim(), estado, destino, ordenFocus, objetivoId, padreId, ordenArbol, actualizadaEn }
        return tarea.tipo === "objetivo" ? tarea : { ...tarea, objetivoId }
    })
    return { ok: true, tareas: nuevasTareas }
}

export function moverTareaEnArbol(tareas, id, direccion) {
    if (![-1, 1].includes(direccion)) return { ok: false, error: "La dirección para reordenar la tarea no es válida." }
    const tarea = tareas.find(item => item.id === id && item.tipo !== "objetivo")
    if (!tarea) return { ok: false, error: "No se encontró la tarea que querés reordenar." }
    const padreId = tarea.padreId ?? tarea.objetivoId ?? null
    const hermanos = tareas.filter(item => item.tipo !== "objetivo" && (item.padreId ?? item.objetivoId ?? null) === padreId)
        .sort((a, b) => (a.ordenArbol ?? tareas.indexOf(a)) - (b.ordenArbol ?? tareas.indexOf(b)))
    const indice = hermanos.findIndex(item => item.id === id)
    const destinoIndice = indice + direccion
    if (destinoIndice < 0 || destinoIndice >= hermanos.length) return { ok: false, error: "La tarea ya está en ese extremo de su nivel." }
    ;[hermanos[indice], hermanos[destinoIndice]] = [hermanos[destinoIndice], hermanos[indice]]
    const ordenes = new Map(hermanos.map((item, posicion) => [item.id, posicion + 1]))
    return { ok: true, tareas: tareas.map(item => ordenes.has(item.id) ? { ...item, ordenArbol: ordenes.get(item.id) } : item) }
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
