function fechaConDesplazamiento(fecha, dias, minutos, segundos) {
    if (!(fecha instanceof Date) || !Number.isFinite(fecha.getTime())) {
        return null
    }

    const resultado = new Date(fecha)

    if (dias !== 0) {
        resultado.setDate(resultado.getDate() + dias)
    }

    if (minutos !== 0) {
        resultado.setMinutes(resultado.getMinutes() + minutos)
    }
    if (segundos !== 0) {
        resultado.setSeconds(resultado.getSeconds() + segundos)
    }

    return Number.isFinite(resultado.getTime()) ? resultado : null
}

function desplazamientoValido(dias, minutos, segundos) {
    return Number.isInteger(dias) && Number.isInteger(minutos) && Number.isInteger(segundos)
}

export function desplazarSegmentosRegistro(registro, { dias = 0, minutos = 0, segundos = 0 } = {}) {
    if (
        !registro
        || !Array.isArray(registro.segmentos)
        || registro.segmentos.length === 0
        || !desplazamientoValido(dias, minutos, segundos)
        || (dias === 0 && minutos === 0 && segundos === 0)
    ) {
        return null
    }

    const segmentos = registro.segmentos.map(segmento => {
        const inicio = fechaConDesplazamiento(segmento.inicio, dias, minutos, segundos)
        const fin = segmento.fin === null
            ? null
            : fechaConDesplazamiento(segmento.fin, dias, minutos, segundos)

        return inicio === null || (segmento.fin !== null && fin === null)
            ? null
            : { ...segmento, inicio, fin }
    })

    return segmentos.some(segmento => segmento === null)
        ? null
        : segmentos
}

export function ajustarExtremoSegmentosRegistro(
    registro,
    { extremo, dias = 0, minutos = 0, segundos = 0 } = {}
) {
    if (
        !registro
        || !Array.isArray(registro.segmentos)
        || registro.segmentos.length === 0
        || !["inicio", "fin"].includes(extremo)
        || !desplazamientoValido(dias, minutos, segundos)
        || (dias === 0 && minutos === 0 && segundos === 0)
    ) {
        return null
    }

    const segmentos = registro.segmentos.map(segmento => ({ ...segmento }))
    const indice = extremo === "inicio" ? 0 : segmentos.length - 1
    const campo = extremo
    const fecha = fechaConDesplazamiento(segmentos[indice][campo], dias, minutos, segundos)

    if (fecha === null) {
        return null
    }

    segmentos[indice][campo] = fecha
    return segmentos
}
