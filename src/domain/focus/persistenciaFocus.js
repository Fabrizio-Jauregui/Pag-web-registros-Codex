export const CLAVE_PLANTILLAS_FOCUS = "focus.plantillas-sesion.v1"
export const CLAVE_HISTORIAL_FOCUS = "focus.historial-sesion.v1"
export const CLAVE_SESION_ACTIVA_FOCUS = "focus.sesion-activa.v1"
export const CLAVE_CIERRE_RECUPERABLE_FOCUS = "focus.cierre-recuperable.v1"

export function cargarCierreRecuperableFocus(almacenamiento = null) {
    try {
        const valor = JSON.parse((almacenamiento ?? globalThis.localStorage).getItem(CLAVE_CIERRE_RECUPERABLE_FOCUS) ?? "null")
        return valor === null || (typeof valor.id === "string" && Number.isFinite(Date.parse(valor.venceEn))
            && valor.sesionAnterior?.id === valor.id && typeof valor.historialId === "string")
            ? { ok: true, cierre: valor }
            : { ok: false, cierre: null, error: "La finalización recuperable de Focus tiene datos inválidos." }
    } catch { return { ok: false, cierre: null, error: "No se pudo leer la finalización recuperable de Focus." } }
}

export function guardarCierreRecuperableFocus(cierre, almacenamiento = null) {
    if (cierre !== null && (typeof cierre.id !== "string" || !Number.isFinite(Date.parse(cierre.venceEn))
        || cierre.sesionAnterior?.id !== cierre.id || typeof cierre.historialId !== "string")) {
        return { ok: false, error: "La finalización recuperable de Focus contiene datos inválidos." }
    }
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        if (cierre === null) almacen.removeItem(CLAVE_CIERRE_RECUPERABLE_FOCUS)
        else almacen.setItem(CLAVE_CIERRE_RECUPERABLE_FOCUS, JSON.stringify(cierre))
        return { ok: true }
    } catch { return { ok: false, error: "No se pudo guardar la finalización recuperable de Focus." } }
}

function leerLista(clave, almacenamiento) {
    try {
        const valor = JSON.parse((almacenamiento ?? globalThis.localStorage).getItem(clave) ?? "[]")
        return Array.isArray(valor) ? { ok: true, valor } : { ok: false, valor: [] }
    } catch {
        return { ok: false, valor: [] }
    }
}

function guardar(clave, valor, almacenamiento) {
    try {
        ;(almacenamiento ?? globalThis.localStorage).setItem(clave, JSON.stringify(valor))
        return { ok: true }
    } catch {
        return { ok: false, error: "No se pudieron guardar los datos de Focus en este navegador." }
    }
}

export function cargarPlantillasFocus(almacenamiento = null) {
    const resultado = leerLista(CLAVE_PLANTILLAS_FOCUS, almacenamiento)
    if (!resultado.ok) return { ok: false, plantillas: [], problemas: [], error: "No se pudieron leer las plantillas de Focus guardadas." }
    const plantillas = []
    const problemas = []
    resultado.valor.forEach((plantilla, indice) => {
        if (esPlantillaValida(plantilla)) plantillas.push(plantilla)
        else problemas.push({ tipo: "focus-plantilla", indice, titulo: plantilla?.nombrePlantilla || `Plantilla Focus ${indice + 1}`, detalle: detalleInvalidezConfiguracionFocus(plantilla?.configuracion) })
    })
    return { ok: true, plantillas, ...(problemas.length ? { problemas } : {}) }
}

export function guardarPlantillasFocus(plantillas, almacenamiento = null) {
    if (!Array.isArray(plantillas) || !plantillas.every(esPlantillaValida)) {
        return { ok: false, error: "Las plantillas de Focus contienen datos inválidos." }
    }
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        const actuales = JSON.parse(almacen.getItem(CLAVE_PLANTILLAS_FOCUS) ?? "[]")
        if (!Array.isArray(actuales)) return { ok: false, error: "La colección de plantillas Focus está corrupta; eliminála desde la revisión de datos." }
        const invalidas = actuales.filter(plantilla => !esPlantillaValida(plantilla))
        return guardar(CLAVE_PLANTILLAS_FOCUS, [...plantillas, ...invalidas], almacen)
    } catch { return { ok: false, error: "No se pudieron conservar las plantillas Focus inválidas." } }
}

export function eliminarPlantillaFocusInvalida(indice, almacenamiento = null) {
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        const plantillas = JSON.parse(almacen.getItem(CLAVE_PLANTILLAS_FOCUS) ?? "null")
        if (!Array.isArray(plantillas) || !Number.isInteger(indice) || indice < 0 || indice >= plantillas.length) return { ok: false, error: "No se encontró esa plantilla Focus inválida." }
        plantillas.splice(indice, 1)
        return guardar(CLAVE_PLANTILLAS_FOCUS, plantillas, almacen)
    } catch { return { ok: false, error: "No se pudo eliminar la plantilla Focus inválida." } }
}

export function cargarHistorialFocus(almacenamiento = null) {
    const resultado = leerLista(CLAVE_HISTORIAL_FOCUS, almacenamiento)
    if (!resultado.ok) return { ok: false, sesiones: [], problemas: [], error: "No se pudo leer el historial de Focus guardado." }
    const sesiones = []
    const problemas = []
    resultado.valor.forEach((sesion, indice) => {
        if (esSesionValida(sesion)) sesiones.push(sesion)
        else problemas.push({ tipo: "focus-historial", indice, firma: JSON.stringify(sesion), titulo: sesion?.configuracion?.nombre || `Sesión Focus ${indice + 1}`, detalle: detalleInvalidezConfiguracionFocus(sesion?.configuracion) })
    })
    return { ok: true, sesiones, ...(problemas.length ? { problemas } : {}) }
}

export function guardarHistorialFocus(sesiones, almacenamiento = null) {
    if (!Array.isArray(sesiones) || !sesiones.every(esSesionValida)) {
        return { ok: false, error: "El historial de Focus contiene datos inválidos." }
    }
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        const originales = JSON.parse(almacen.getItem(CLAVE_HISTORIAL_FOCUS) ?? "[]")
        if (!Array.isArray(originales)) return { ok: false, error: "El historial Focus está corrupto; eliminá la colección desde la revisión de datos." }
        const invalidas = originales.filter(sesion => !esSesionValida(sesion))
        return guardar(CLAVE_HISTORIAL_FOCUS, [...sesiones, ...invalidas], almacen)
    } catch { return { ok: false, error: "No se pudieron conservar las sesiones Focus inválidas." } }
}

export function eliminarSesionFocusInvalida(indice, firma = null, almacenamiento = null) {
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        const sesiones = JSON.parse(almacen.getItem(CLAVE_HISTORIAL_FOCUS) ?? "null")
        if (!Array.isArray(sesiones)) return { ok: false, error: "No se encontró esa sesión Focus inválida." }
        const indiceActual = firma ? sesiones.findIndex(sesion => JSON.stringify(sesion) === firma) : indice
        if (!Number.isInteger(indiceActual) || indiceActual < 0 || indiceActual >= sesiones.length || esSesionValida(sesiones[indiceActual])) return { ok: false, error: "No se encontró esa sesión Focus inválida." }
        sesiones.splice(indiceActual, 1)
        return guardar(CLAVE_HISTORIAL_FOCUS, sesiones, almacen)
    } catch { return { ok: false, error: "No se pudo eliminar la sesión Focus inválida." } }
}

export function cargarSesionActivaFocus(almacenamiento = null) {
    try {
        const valor = JSON.parse((almacenamiento ?? globalThis.localStorage).getItem(CLAVE_SESION_ACTIVA_FOCUS) ?? "null")
        return valor === null || esSesionActivaValida(valor)
            ? { ok: true, sesion: valor }
            : { ok: false, sesion: null, error: !esConfiguracionValida(valor?.configuracion)
                ? detalleInvalidezConfiguracionFocus(valor?.configuracion)
                : "La sesión Focus tiene fechas, bloques o estado inválidos." }
    } catch {
        return { ok: false, sesion: null, error: "No se pudo leer la sesión Focus guardada." }
    }
}

export function guardarSesionActivaFocus(sesion, almacenamiento = null) {
    if (sesion !== null && !esSesionActivaValida(sesion)) {
        return { ok: false, error: "La sesión Focus contiene datos inválidos." }
    }
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        const contenido = almacen.getItem(CLAVE_SESION_ACTIVA_FOCUS)
        if (contenido !== null) {
            let actual
            try { actual = JSON.parse(contenido) } catch { return { ok: false, error: "Hay una sesión Focus guardada corrupta. Eliminála desde la revisión del Historial antes de iniciar otra." } }
            if (actual !== null && !esSesionActivaValida(actual)) return { ok: false, error: "Hay una sesión Focus guardada inválida. Eliminála desde la revisión del Historial antes de iniciar otra." }
        }
    } catch { return { ok: false, error: "No se pudo revisar la sesión Focus guardada." } }
    return guardar(CLAVE_SESION_ACTIVA_FOCUS, sesion, almacenamiento)
}

function esBloqueValido(bloque) {
    return bloque !== null && typeof bloque === "object"
        && typeof bloque.nombre === "string" && bloque.nombre.trim() !== ""
        && ["concentracion", "descanso"].includes(bloque.tipo)
        && Number.isInteger(bloque.minutos)
        && bloque.minutos >= 1 && bloque.minutos <= (bloque.tipo === "concentracion" ? 180 : 60)
}

function esConfiguracionValida(valor) {
    const tareaValida = valor?.tarea === undefined || valor.tarea === null || (
        typeof valor.tarea === "object"
        && typeof valor.tarea.id === "string" && valor.tarea.id.trim() !== ""
        && typeof valor.tarea.nombre === "string" && valor.tarea.nombre.trim() !== ""
        && (valor.tarea.estado === undefined || typeof valor.tarea.estado === "string")
    )
    const coloresValidos = valor?.colores === undefined || (
        valor.colores !== null
        && typeof valor.colores === "object"
        && Object.values(valor.colores).every(color => typeof color === "string" && /^#[\da-fA-F]{6}$/.test(color))
    )
    const colaValida = valor?.usarColaFocus === undefined || typeof valor.usarColaFocus === "boolean"
    const eventoValido = valor?.evento === undefined || valor.evento === null || (
        typeof valor.evento === "object"
        && typeof valor.evento.id === "string" && valor.evento.id.trim() !== ""
        && typeof valor.evento.nombre === "string" && valor.evento.nombre.trim() !== ""
        && typeof valor.evento.color === "string" && /^#[\da-fA-F]{6}$/.test(valor.evento.color)
    )
    const tieneEvento = Boolean(valor?.evento)
    const tieneTarea = Boolean(valor?.tarea)
    const puntual = valor?.actividadPuntual
    const puntualValido = puntual === undefined || puntual === null || (
        typeof puntual.nombre === "string" && puntual.nombre.trim() !== "" && puntual.nombre.trim().length <= 80
        && Array.isArray(puntual.categoriaIds)
        && puntual.categoriaIds.every(id => typeof id === "string" && id.trim() !== "")
    )
    const tienePuntual = Boolean(puntual)
    const origenValido = Boolean(valor?.usarColaFocus) && !tieneEvento && !tieneTarea && !tienePuntual
        || Number(tieneEvento) + Number(tieneTarea) + Number(tienePuntual) === 1 && eventoValido && tareaValida && puntualValido
    return valor !== null && typeof valor === "object"
        && typeof valor.nombre === "string" && valor.nombre.trim() !== ""
        && Array.isArray(valor.bloques) && valor.bloques.length > 0 && valor.bloques.every(esBloqueValido)
        && tareaValida
        && colaValida
        && eventoValido
        && puntualValido
        && origenValido
        && coloresValidos
}

function detalleInvalidezConfiguracionFocus(configuracion) {
    if (configuracion && !configuracion.usarColaFocus && Number(Boolean(configuracion.evento)) + Number(Boolean(configuracion.tarea)) + Number(Boolean(configuracion.actividadPuntual)) !== 1) {
        return "Debe tener exactamente un origen: plantilla de evento, tarea o actividad puntual."
    }
    return "La sesión tiene fechas, bloques, colores o relaciones inválidas."
}

function esPlantillaValida(valor) {
    return valor !== null && typeof valor === "object"
        && typeof valor.id === "string" && valor.id !== ""
        && typeof valor.nombrePlantilla === "string" && valor.nombrePlantilla.trim() !== ""
        && esConfiguracionValida(valor.configuracion)
}

function esIso(valor) {
    return typeof valor === "string" && Number.isFinite(Date.parse(valor))
}

function esSesionActivaValida(valor) {
    return valor !== null && typeof valor === "object"
        && typeof valor.id === "string" && valor.id !== ""
        && esConfiguracionValida(valor.configuracion)
        && Number.isInteger(valor.indiceBloque)
        && valor.indiceBloque >= 0 && valor.indiceBloque < valor.configuracion.bloques.length
        && ["lista", "concentracion", "descanso", "tiempo-muerto", "esperando-concentracion", "pausada"].includes(valor.estado)
        && (valor.finBloque === null || esIso(valor.finBloque))
        && (valor.inicioTiempoMuerto === null || esIso(valor.inicioTiempoMuerto))
        && (valor.registroId === null || typeof valor.registroId === "string")
        && (valor.registroIds === undefined || (Array.isArray(valor.registroIds) && valor.registroIds.every(id => typeof id === "string" && id !== "")))
        && (valor.tareaActivaId === undefined || valor.tareaActivaId === null || (typeof valor.tareaActivaId === "string" && valor.tareaActivaId !== ""))
        && (valor.trabajoPendienteInicio === undefined || valor.trabajoPendienteInicio === null || esIso(valor.trabajoPendienteInicio))
        && (valor.avanzarAutomaticamente === undefined || typeof valor.avanzarAutomaticamente === "boolean")
        && (valor.reanudarEstado === null || ["concentracion", "descanso", "tiempo-muerto", "esperando-concentracion"].includes(valor.reanudarEstado))
        && Number.isFinite(valor.restanteMs) && valor.restanteMs >= 0
        && (valor.tiempoMuertoAcumuladoMs === undefined || (Number.isFinite(valor.tiempoMuertoAcumuladoMs) && valor.tiempoMuertoAcumuladoMs >= 0))
        && (valor.extras === undefined || (Array.isArray(valor.extras) && valor.extras.every(esExtraValido)))
        && esIso(valor.inicio)
}

function esExtraValido(extra) {
    return extra !== null && typeof extra === "object"
        && ["tiempo-muerto", "pausa-sesion"].includes(extra.tipo)
        && esIso(extra.inicio)
        && (extra.fin === null || esIso(extra.fin))
}

function esSesionValida(valor) {
    return valor !== null && typeof valor === "object"
        && typeof valor.id === "string" && valor.id !== ""
        && esConfiguracionValida(valor.configuracion)
        && esIso(valor.inicio) && esIso(valor.fin)
        && (valor.registroId === null || typeof valor.registroId === "string")
        && (valor.registroIds === undefined || (Array.isArray(valor.registroIds) && valor.registroIds.every(id => typeof id === "string" && id !== "")))
        && Array.isArray(valor.bloques) && valor.bloques.every(bloque => esBloqueValido(bloque)
            && (bloque.inicio === null || esIso(bloque.inicio))
            && (bloque.fin === null || esIso(bloque.fin)))
        && (valor.extras === undefined || (Array.isArray(valor.extras)
            && valor.extras.every(extra => esExtraValido(extra) && esIso(extra.fin))))
}
