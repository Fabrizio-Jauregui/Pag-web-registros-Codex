export const DURACION_MAXIMA_SEGUNDOS = 86400
export const DURACION_MAXIMA_MS = DURACION_MAXIMA_SEGUNDOS * 1000
export const DURACION_MINIMA_EFECTIVA_SEGUNDOS = 1

function esFechaValida(fecha) {
    return fecha instanceof Date && Number.isFinite(fecha.getTime())
}

export function formatearDuracion(segundos) {
    if (!Number.isFinite(segundos) || segundos < 0) {
        return "Duración inválida"
    }

    if (segundos > DURACION_MAXIMA_SEGUNDOS) {
        return "Supera el límite de 24 h"
    }

    const horas = Math.floor(segundos / 3600)
    const minutos = Math.floor((segundos % 3600) / 60)
    const segundosRestantes = segundos % 60

    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(segundosRestantes).padStart(2, "0")}`
}

export function calcularDuracionSegmento(segmento, ahora) {
    if (!esFechaValida(segmento.inicio) || !esFechaValida(ahora)) {
        return 0
    }

    const fin = segmento.fin ?? ahora

    if (!esFechaValida(fin)) {
        return 0
    }

    const duracionMs = fin.getTime() - segmento.inicio.getTime()

    if (duracionMs < 0) {
        return 0
    }

    return duracionMs
}

export function calcularTiempoEfectivo(segmentos, ahora) {
    const duracionTotalMs = segmentos.reduce((total, segmento) => {
        if (segmento.tipo !== "En curso") {
            return total
        }

        return total + calcularDuracionSegmento(segmento, ahora)
    }, 0)

    return Math.floor(duracionTotalMs / 1000)
}

export function puedeFinalizarRegistro(segmentos, ahora) {
    return calcularTiempoEfectivo(segmentos, ahora) >= DURACION_MINIMA_EFECTIVA_SEGUNDOS
}

export function calcularLimiteRegistro(inicio) {
    if (!esFechaValida(inicio)) {
        return null
    }

    return new Date(inicio.getTime() + DURACION_MAXIMA_MS)
}

export function seAlcanzoLimiteRegistro(inicio, ahora) {
    const limite = calcularLimiteRegistro(inicio)

    return limite !== null && esFechaValida(ahora) && ahora.getTime() >= limite.getTime()
}

export function calcularTiempoPausado(segmentos, ahora) {
    const duracionTotalMs = segmentos.reduce((total, segmento) => {
        if (segmento.tipo !== "Pausado") {
            return total
        }

        return total + calcularDuracionSegmento(segmento, ahora)
    }, 0)

    return Math.floor(duracionTotalMs / 1000)
}

export function calcularTiempoTranscurrido(segmentos, ahora) {
    if (segmentos.length === 0) {
        return null
    }

    const inicio = segmentos[0].inicio
    const ultimoSegmento = segmentos[segmentos.length - 1]
    const fin = ultimoSegmento.fin ?? ahora

    const duracionMs = fin.getTime() - inicio.getTime()

    if (duracionMs < 0) {
        return null
    }

    return Math.floor(duracionMs / 1000)
}

export function calcularTiempoRegistradoEnPeriodo(registros, inicioPeriodo, finPeriodo, ahora = new Date()) {
    if (!Array.isArray(registros)
        || !esFechaValida(inicioPeriodo)
        || !esFechaValida(finPeriodo)
        || !esFechaValida(ahora)
        || finPeriodo <= inicioPeriodo) {
        return 0
    }

    const intervalos = []

    for (const registro of registros) {
        for (const segmento of registro.segmentos ?? []) {
            if (segmento.tipo !== "En curso" || !esFechaValida(segmento.inicio)) {
                continue
            }

            const inicio = Math.max(segmento.inicio.getTime(), inicioPeriodo.getTime())
            const fin = Math.min((segmento.fin ?? ahora).getTime(), finPeriodo.getTime(), ahora.getTime())

            if (fin > inicio) {
                intervalos.push({ inicio, fin })
            }
        }
    }

    intervalos.sort((a, b) => a.inicio - b.inicio)
    let inicioUnido = null
    let finUnido = null
    let totalMs = 0

    for (const intervalo of intervalos) {
        if (finUnido === null || intervalo.inicio > finUnido) {
            if (finUnido !== null) {
                totalMs += finUnido - inicioUnido
            }
            inicioUnido = intervalo.inicio
            finUnido = intervalo.fin
        } else {
            finUnido = Math.max(finUnido, intervalo.fin)
        }
    }

    if (finUnido !== null) {
        totalMs += finUnido - inicioUnido
    }

    return Math.floor(totalMs / 1000)
}

export function calcularTiempoTotalDelDia(registros, fecha, ahora = new Date()) {
    if (!esFechaValida(fecha)) return 0

    const inicioDia = new Date(fecha)
    inicioDia.setHours(0, 0, 0, 0)
    const finDia = new Date(inicioDia)
    finDia.setDate(finDia.getDate() + 1)
    return calcularTiempoRegistradoEnPeriodo(registros, inicioDia, finDia, ahora)
}

export function cerrarSegmentoAbierto(segmentos, instanteFin) {
    if (!Array.isArray(segmentos) || !esFechaValida(instanteFin)) {
        return null
    }

    let finAnterior = null

    for (let indice = 0; indice < segmentos.length; indice += 1) {
        const segmento = segmentos[indice]
        const esUltimo = indice === segmentos.length - 1

        if (
            !segmento ||
            !["En curso", "Pausado"].includes(segmento.tipo) ||
            !esFechaValida(segmento.inicio) ||
            (segmento.fin !== null && !esFechaValida(segmento.fin))
        ) {
            return null
        }

        const fin = segmento.fin ?? instanteFin

        if (
            (segmento.fin === null && !esUltimo) ||
            fin.getTime() < segmento.inicio.getTime() ||
            (finAnterior !== null && segmento.inicio.getTime() < finAnterior)
        ) {
            return null
        }

        if (segmento.fin === null && fin.getTime() < instanteFin.getTime()) {
            return null
        }

        finAnterior = fin.getTime()
    }

    return segmentos.map(segmento => {
        if (segmento.fin !== null) {
            return segmento
        }

        return {
            ...segmento,
            fin: instanteFin
        }
    })
}
