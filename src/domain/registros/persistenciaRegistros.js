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
            estado: registro.estado,
            motivoCancelacion: registro.motivoCancelacion,
            segmentos
        })
    }

    return registros
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
                error: "Los registros guardados no tienen un formato JSON válido. No se modificaron los datos."
            }
        }

        const registros = deserializarRegistros(datos)

        if (
            registros === null
            || !validarColeccionRegistros(registros, ahora, { permitirLimiteExcedido: true })
        ) {
            return {
                ok: false,
                error: "Los registros guardados tienen datos o intervalos inválidos. No se modificaron los datos."
            }
        }

        const recuperacion = aplicarLimitesVencidos(registros, ahora)

        if (!recuperacion.ok) {
            return recuperacion
        }

        if (!recuperacion.cambioPorLimite) {
            return { ok: true, registros }
        }

        const guardado = guardarRegistros(recuperacion.registros, almacen, ahora)

        return {
            ok: true,
            registros: recuperacion.registros,
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
        almacen.setItem(CLAVE_REGISTROS, serializarRegistros(registros))
        return { ok: true }
    } catch {
        return {
            ok: false,
            error: "No se pudieron guardar los registros en este navegador. Verificá el espacio disponible y los permisos de almacenamiento."
        }
    }
}
