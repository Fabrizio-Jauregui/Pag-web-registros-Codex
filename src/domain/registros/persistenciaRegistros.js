import {
    aplicarLimitesVencidos,
    validarColeccionRegistros
} from "./registros.js"

export const CLAVE_REGISTROS = "focus.registros.v1"

function convertirFecha(fecha) {
    if (fecha === null) {
        return null
    }

    if (typeof fecha !== "string") {
        return null
    }

    const valor = new Date(fecha)

    return Number.isFinite(valor.getTime()) && valor.toISOString() === fecha
        ? valor
        : null
}

function deserializarRegistros(datos) {
    if (!Array.isArray(datos)) {
        return null
    }

    const registros = []

    for (const registro of datos) {
        if (
            registro === null
            || typeof registro !== "object"
            || !Array.isArray(registro.segmentos)
        ) {
            return null
        }

        const segmentos = registro.segmentos.map(segmento => {
            if (segmento === null || typeof segmento !== "object") {
                return null
            }

            const inicio = convertirFecha(segmento.inicio)
            const fin = segmento.fin === null ? null : convertirFecha(segmento.fin)

            if (inicio === null || (segmento.fin !== null && fin === null)) {
                return null
            }

            return { tipo: segmento.tipo, inicio, fin }
        })

        if (segmentos.some(segmento => segmento === null)) {
            return null
        }

        registros.push({
            id: registro.id,
            nombre: registro.nombre,
            eventoId: registro.eventoId === undefined ? null : registro.eventoId,
            colorEvento: registro.colorEvento === undefined ? null : registro.colorEvento,
            ...(registro.tareaId === undefined ? {} : { tareaId: registro.tareaId }),
            ...(registro.tareaNombre === undefined ? {} : { tareaNombre: registro.tareaNombre }),
            ...(registro.planId === undefined ? {} : { planId: registro.planId }),
            ...(registro.origenFocus === undefined ? {} : { origenFocus: registro.origenFocus }),
            estado: registro.estado,
            motivoCancelacion: registro.motivoCancelacion,
            segmentos
        })
    }

    return registros
}

function analizarRegistros(datos, ahora) {
    if (!Array.isArray(datos)) return { registros: [], problemas: [{ indice: null, titulo: "Colección de registros", detalle: "El contenido guardado no es una lista de registros.", bruto: null }] }
    const registros = []
    const problemas = []
    const ids = new Set()
    datos.forEach((bruto, indice) => {
        const convertidos = deserializarRegistros([bruto])
        const registro = convertidos?.[0]
        let detalle = ""
        if (!registro) detalle = "Faltan datos o hay fechas de segmentos inválidas."
        else if (typeof registro.id !== "string" || !registro.id.trim()) detalle = "El registro no tiene un identificador válido."
        else if (ids.has(registro.id)) detalle = "El identificador del registro está repetido."
        else if (Boolean(registro.eventoId) === Boolean(registro.tareaId)) detalle = "Debe tener exactamente un origen: una plantilla de evento o una tarea."
        else if (!validarColeccionRegistros([registro], ahora, { permitirLimiteExcedido: true })) detalle = "El registro tiene datos inválidos, un estado incorrecto o intervalos inconsistentes."
        if (detalle) problemas.push({ indice, titulo: registro?.nombre || `Registro ${indice + 1}`, detalle, bruto })
        else { registros.push(registro); ids.add(registro.id) }
    })
    return { registros, problemas }
}

function serializarRegistros(registros) {
    return JSON.stringify(registros.map(registro => ({
        ...registro,
        segmentos: registro.segmentos.map(segmento => ({
            ...segmento,
            inicio: segmento.inicio.toISOString(),
            fin: segmento.fin?.toISOString() ?? null
        }))
    })))
}

export function cargarRegistros(almacenamiento = null, ahora = new Date()) {
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        const contenido = almacen.getItem(CLAVE_REGISTROS)

        if (contenido === null) {
            return { ok: true, registros: [] }
        }

        let datos

        try {
            datos = JSON.parse(contenido)
        } catch {
            return {
                ok: false,
                error: "Los registros guardados no tienen un formato JSON válido. No se modificaron los datos.",
                problemas: [{ indice: null, titulo: "Colección de registros", detalle: "El contenido no es JSON válido; solo se puede quitar la colección completa." }]
            }
        }

        const analisis = analizarRegistros(datos, ahora)
        const registros = analisis.registros
        if (analisis.problemas.some(problema => problema.indice === null)) {
            return { ok: false, error: analisis.problemas[0].detalle, problemas: analisis.problemas }
        }

        const recuperacion = aplicarLimitesVencidos(registros, ahora)

        if (!recuperacion.ok) {
            return recuperacion
        }

        if (!recuperacion.cambioPorLimite) {
            return { ok: true, registros, ...(analisis.problemas.length ? { problemas: analisis.problemas } : {}) }
        }

        const guardado = guardarRegistros(recuperacion.registros, almacen, ahora)

        return {
            ok: true,
            registros: recuperacion.registros,
            ...(analisis.problemas.length ? { problemas: analisis.problemas } : {}),
            mensaje: recuperacion.mensaje,
            advertencia: guardado.ok ? "" : guardado.error
        }
    } catch {
        return {
            ok: false,
            error: "No se pudieron leer los registros guardados en este navegador."
        }
    }
}

export function guardarRegistros(registros, almacenamiento = null, ahora = new Date()) {
    if (!validarColeccionRegistros(registros, ahora)) {
        return {
            ok: false,
            error: "No se guardaron los cambios porque los registros tienen intervalos inválidos."
        }
    }

    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        let invalidos = []
        try {
            const contenido = almacen.getItem(CLAVE_REGISTROS)
            const originales = JSON.parse(contenido ?? "[]")
            if (!Array.isArray(originales)) return { ok: false, error: "El contenido de registros no se puede modificar hasta eliminar la colección corrupta." }
            invalidos = analizarRegistros(originales, ahora).problemas.map(problema => problema.bruto)
        } catch { return { ok: false, error: "El contenido de registros no se puede modificar hasta eliminar la colección corrupta." } }
        almacen.setItem(CLAVE_REGISTROS, JSON.stringify([
            ...JSON.parse(serializarRegistros(registros)),
            ...invalidos
        ]))
        return { ok: true }
    } catch {
        return {
            ok: false,
            error: "No se pudieron guardar los registros en este navegador. Verificá el espacio disponible y los permisos de almacenamiento."
        }
    }
}

export function eliminarRegistroInvalido(indice, almacenamiento = null) {
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        const originales = JSON.parse(almacen.getItem(CLAVE_REGISTROS) ?? "null")
        if (!Array.isArray(originales) || !Number.isInteger(indice) || indice < 0 || indice >= originales.length) return { ok: false, error: "No se encontró ese registro inválido." }
        originales.splice(indice, 1)
        almacen.setItem(CLAVE_REGISTROS, JSON.stringify(originales))
        return { ok: true }
    } catch { return { ok: false, error: "No se pudo eliminar el registro inválido." } }
}
