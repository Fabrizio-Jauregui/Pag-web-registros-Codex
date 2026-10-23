export const COLOR_PLAN_PREDETERMINADO = "#0F766E"

export function validarPlan(plan) {
    if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
        return "El plan no tiene un formato válido."
    }
    if (typeof plan.nombre !== "string" || plan.nombre.trim() === "") {
        return "Escribí el nombre de la actividad planificada."
    }
    if (plan.nombre.trim().length > 80) {
        return "El nombre no puede superar los 80 caracteres."
    }
    if (plan.eventoId !== null && (typeof plan.eventoId !== "string" || plan.eventoId.trim() === "")) {
        return "La plantilla vinculada no es válida."
    }
    if (plan.colorEvento !== null && !/^#[\da-fA-F]{6}$/.test(plan.colorEvento)) {
        return "El color del plan no es válido."
    }
    if (plan.ordenSeguimiento !== undefined
        && (!Number.isInteger(plan.ordenSeguimiento) || plan.ordenSeguimiento < 0)) {
        return "El orden de seguimiento del plan no es válido."
    }
    if (!(plan.inicio instanceof Date) || !Number.isFinite(plan.inicio.getTime())) {
        return "Elegí una fecha y hora de inicio válidas."
    }
    if (plan.tipoPlanificacion === "focus") {
        const bloques = plan.configuracionFocus?.bloques
        if (typeof plan.configuracionFocus?.nombre !== "string" || !plan.configuracionFocus.nombre.trim()
            || !Array.isArray(bloques) || bloques.length === 0 || bloques.some(bloque => (
                typeof bloque?.nombre !== "string" || !bloque.nombre.trim()
                || !["concentracion", "descanso"].includes(bloque.tipo)
                || !Number.isInteger(bloque.minutos) || bloque.minutos < 1
                || bloque.minutos > (bloque.tipo === "concentracion" ? 180 : 60)
            ))) {
            return "La sesión Focus planificada no tiene bloques válidos."
        }
        const duracion = bloques.reduce((total, bloque) => total + bloque.minutos * 60 * 1000, 0)
        if (duracion <= 0 || duracion > 24 * 60 * 60 * 1000 || !(plan.fin instanceof Date)
            || plan.fin.getTime() - plan.inicio.getTime() !== duracion) {
            return "El horario de la sesión Focus debe coincidir con la duración de sus bloques."
        }
    }
    if (plan.modoSeguimientoPlanificacion === "cronometro") {
        if (plan.fin !== null) return "Los eventos de cronómetro no tienen una hora de fin planificada."
        return null
    }
    if (!(plan.fin instanceof Date) || !Number.isFinite(plan.fin.getTime())) {
        return "Elegí una fecha y hora de fin válidas."
    }
    if (plan.fin <= plan.inicio) {
        return "La hora de fin debe ser posterior al inicio. Si termina otro día, elegí esa fecha explícitamente."
    }
    return null
}

export function validarColeccionPlanes(planes) {
    if (!Array.isArray(planes)) return false
    const ids = new Set()
    return planes.every(plan => {
        if (
            typeof plan?.id !== "string" || plan.id.trim() === "" || ids.has(plan.id)
            || validarPlan(plan) !== null
        ) return false
        ids.add(plan.id)
        return true
    })
}

export function validarCompatibilidadPlanesFocus(planes, idsModificados) {
    const ids = idsModificados instanceof Set ? idsModificados : new Set(idsModificados ?? [])
    for (const focus of planes.filter(plan => plan.tipoPlanificacion === "focus")) {
        let desplazamiento = 0
        for (const bloque of focus.configuracionFocus?.bloques ?? []) {
            const duracion = bloque.minutos * 60000
            if (bloque.tipo === "concentracion") {
                const inicio = focus.inicio.getTime() + desplazamiento
                const fin = inicio + duracion
                for (const otro of planes) {
                    if (otro.id === focus.id || (!ids.has(focus.id) && !ids.has(otro.id)) || !otro.fin) continue
                    if (otro.inicio.getTime() < fin && otro.fin.getTime() > inicio) {
                        return `"${otro.nombre}" coincide con un período de concentración de "${focus.nombre}". Reubicá el plan; los descansos de Focus sí admiten actividades.`
                    }
                }
            }
            desplazamiento += duracion
        }
    }
    return null
}

export function crearPlan({ nombre, evento = null, inicio, fin, ordenSeguimiento }, generarId = () => globalThis.crypto.randomUUID()) {
    const plan = {
        id: "pendiente",
        nombre: evento?.nombre ?? nombre,
        eventoId: evento?.id ?? null,
        colorEvento: evento?.color ?? COLOR_PLAN_PREDETERMINADO,
        inicio,
        fin,
        ...(Number.isInteger(ordenSeguimiento) ? { ordenSeguimiento } : {})
    }
    const error = validarPlan(plan)
    if (error) return { ok: false, error }

    let id
    try {
        id = generarId()
    } catch {
        return { ok: false, error: "No se pudo crear la identidad del plan." }
    }
    if (typeof id !== "string" || id.trim() === "") {
        return { ok: false, error: "No se pudo crear la identidad del plan." }
    }
    return { ok: true, plan: { ...plan, id, nombre: plan.nombre.trim() } }
}

export function compararPlanesPorSeguimiento(a, b) {
    const aTieneOrden = Number.isInteger(a?.ordenSeguimiento)
    const bTieneOrden = Number.isInteger(b?.ordenSeguimiento)
    if (aTieneOrden && bTieneOrden && a.ordenSeguimiento !== b.ordenSeguimiento) {
        return a.ordenSeguimiento - b.ordenSeguimiento
    }
    if (aTieneOrden !== bTieneOrden) return aTieneOrden ? -1 : 1
    return a.inicio.getTime() - b.inicio.getTime()
        || (a.fin?.getTime() ?? a.inicio.getTime()) - (b.fin?.getTime() ?? b.inicio.getTime())
        || a.id.localeCompare(b.id)
}

export function actualizarPlan(planes, id, cambios) {
    const actual = planes.find(plan => plan.id === id)
    if (!actual) return { ok: false, error: "No se encontró el plan que querés editar." }
    const inicio = cambios.inicio
    const duracionFocus = actual.tipoPlanificacion === "focus"
        ? actual.configuracionFocus.bloques.reduce((total, bloque) => total + bloque.minutos * 60 * 1000, 0)
        : null
    const plan = {
        ...actual,
        nombre: actual.tipoPlanificacion === "focus" ? cambios.nombre : cambios.evento?.nombre ?? cambios.nombre,
        eventoId: actual.tipoPlanificacion === "focus" ? null : cambios.evento?.id ?? null,
        colorEvento: actual.tipoPlanificacion === "focus" ? actual.colorEvento : cambios.evento?.color ?? COLOR_PLAN_PREDETERMINADO,
        inicio,
        fin: duracionFocus === null ? cambios.fin : new Date(inicio.getTime() + duracionFocus),
        ...(actual.tipoPlanificacion === "focus" ? { configuracionFocus: { ...actual.configuracionFocus, nombre: cambios.nombre?.trim() } } : {})
    }
    const error = validarPlan(plan)
    if (error) return { ok: false, error }
    return {
        ok: true,
        planes: planes.map(elemento => elemento.id === id ? { ...plan, nombre: plan.nombre.trim() } : elemento)
    }
}

export function eliminarPlan(planes, id) {
    if (!planes.some(plan => plan.id === id)) {
        return { ok: false, error: "No se encontró el plan que querés eliminar." }
    }
    return { ok: true, planes: planes.filter(plan => plan.id !== id) }
}

export function eliminarAplicacionPlan(planes, idAplicacion) {
    if (typeof idAplicacion !== "string" || idAplicacion.trim() === "") {
        return { ok: false, error: "No se encontró la aplicación de planificación que querés eliminar." }
    }
    const restantes = planes.filter(plan => plan.idAplicacionPlantilla !== idAplicacion)
    const cantidadEliminada = planes.length - restantes.length
    if (cantidadEliminada === 0) {
        return { ok: false, error: "No se encontró la aplicación de planificación que querés eliminar." }
    }
    return { ok: true, planes: restantes, cantidadEliminada }
}
