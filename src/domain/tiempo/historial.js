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
    return {
        efectivo: calcularTiempoEfectivo(registro.segmentos, ahora),
        pausado: calcularTiempoPausado(registro.segmentos, ahora),
        transcurrido: calcularTiempoTranscurrido(registro.segmentos, ahora)
    }
}

export function formatearInstante(instante, opciones) {
    return new Intl.DateTimeFormat("es-AR", opciones).format(instante)
}
