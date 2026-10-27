import {
    calcularTiempoEfectivo,
    calcularTiempoPausado,
    calcularTiempoTranscurrido
} from "./CalculosDuracion.js"

export function ordenarRegistrosPorInicio(registros) {
    return [...registros].sort((a, b) => (
        b.segmentos[0].inicio.getTime() - a.segmentos[0].inicio.getTime()
    ))
}

export function obtenerResumenRegistro(registro, ahora = new Date()) {
    const efectivo = calcularTiempoEfectivo(registro.segmentos, ahora)
    const pausado = calcularTiempoPausado(registro.segmentos, ahora)
    const transcurrido = calcularTiempoTranscurrido(registro.segmentos, ahora)
    return {
        efectivo,
        pausado,
        transcurrido,
        sinClasificar: Math.max(0, (transcurrido ?? 0) - efectivo - pausado)
    }
}

export function formatearInstante(instante, opciones) {
    return new Intl.DateTimeFormat("es-AR", opciones).format(instante)
}
