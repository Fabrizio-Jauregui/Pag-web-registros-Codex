export const ALTURA_HORA_BASE = 64
export const VENTANAS_ZOOM_SEGUNDOS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800, 57600, 86400]

export const ALTURAS_ZOOM_CALENDARIO = {
    dia: [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 448, 512],
    semana: [48, 56, 64, 72, 80, 88, 96]
}

export function moverNivelZoom(niveles, actual, direccion) {
    if (
        !Array.isArray(niveles)
        || niveles.length === 0
        || !Number.isFinite(actual)
        || ![-1, 1].includes(direccion)
    ) {
        return actual
    }

    const indiceActual = niveles.indexOf(actual)

    if (indiceActual === -1) {
        return actual
    }

    const indiceSiguiente = Math.min(
        niveles.length - 1,
        Math.max(0, indiceActual + direccion)
    )

    return niveles[indiceSiguiente]
}

export function obtenerPorcentajeZoom(alturaHora) {
    if (!Number.isFinite(alturaHora) || alturaHora <= 0) {
        return null
    }

    return Math.round((alturaHora / ALTURA_HORA_BASE) * 100)
}
