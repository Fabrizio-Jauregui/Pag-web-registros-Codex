export const CLAVE_PLANTILLAS_FOCUS = "focus.plantillas-sesion.v1"
export const CLAVE_HISTORIAL_FOCUS = "focus.historial-sesion.v1"
export const CLAVE_SESION_ACTIVA_FOCUS = "focus.sesion-activa.v1"

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
    return resultado.ok
        ? { ok: true, plantillas: resultado.valor.filter(esPlantillaValida) }
        : { ok: false, plantillas: [], error: "No se pudieron leer las plantillas de Focus guardadas." }
}

export function guardarPlantillasFocus(plantillas, almacenamiento = null) {
    if (!Array.isArray(plantillas) || !plantillas.every(esPlantillaValida)) {
        return { ok: false, error: "Las plantillas de Focus contienen datos inválidos." }
    }
    return guardar(CLAVE_PLANTILLAS_FOCUS, plantillas, almacenamiento)
}

export function cargarHistorialFocus(almacenamiento = null) {
    const resultado = leerLista(CLAVE_HISTORIAL_FOCUS, almacenamiento)
    return resultado.ok
        ? { ok: true, sesiones: resultado.valor.filter(esSesionValida) }
        : { ok: false, sesiones: [], error: "No se pudo leer el historial de Focus guardado." }
}

export function guardarHistorialFocus(sesiones, almacenamiento = null) {
    if (!Array.isArray(sesiones) || !sesiones.every(esSesionValida)) {
        return { ok: false, error: "El historial de Focus contiene datos inválidos." }
    }
    return guardar(CLAVE_HISTORIAL_FOCUS, sesiones, almacenamiento)
}

export function cargarSesionActivaFocus(almacenamiento = null) {
    try {
        const valor = JSON.parse((almacenamiento ?? globalThis.localStorage).getItem(CLAVE_SESION_ACTIVA_FOCUS) ?? "null")
        return valor === null || esSesionActivaValida(valor)
            ? { ok: true, sesion: valor }
            : { ok: false, sesion: null, error: "La sesión Focus guardada tiene datos inválidos." }
    } catch {
        return { ok: false, sesion: null, error: "No se pudo leer la sesión Focus guardada." }
    }
}

export function guardarSesionActivaFocus(sesion, almacenamiento = null) {
    if (sesion !== null && !esSesionActivaValida(sesion)) {
        return { ok: false, error: "La sesión Focus contiene datos inválidos." }
    }
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
    return valor !== null && typeof valor === "object"
        && typeof valor.nombre === "string" && valor.nombre.trim() !== ""
        && Array.isArray(valor.bloques) && valor.bloques.length > 0 && valor.bloques.every(esBloqueValido)
        && tareaValida
        && colaValida
        && coloresValidos
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
