function esFechaValida(fecha) {
    return fecha instanceof Date && Number.isFinite(fecha.getTime())
}

export function normalizarFechaLocal(fecha) {
    if (!esFechaValida(fecha)) {
        return null
    }

    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
}

export function obtenerFechaLocalHoy(ahora = new Date()) {
    return normalizarFechaLocal(ahora)
}

export function desplazarDia(fecha, cantidad) {
    const fechaNormalizada = normalizarFechaLocal(fecha)

    if (fechaNormalizada === null || !Number.isInteger(cantidad)) {
        return null
    }

    return new Date(
        fechaNormalizada.getFullYear(),
        fechaNormalizada.getMonth(),
        fechaNormalizada.getDate() + cantidad
    )
}

export function obtenerInicioSemana(fecha) {
    const fechaNormalizada = normalizarFechaLocal(fecha)

    if (fechaNormalizada === null) {
        return null
    }

    const diasDesdeLunes = (fechaNormalizada.getDay() + 6) % 7
    return desplazarDia(fechaNormalizada, -diasDesdeLunes)
}

export function obtenerDiasSemana(fecha) {
    const inicioSemana = obtenerInicioSemana(fecha)

    if (inicioSemana === null) {
        return null
    }

    return Array.from({ length: 7 }, (_, indice) => desplazarDia(inicioSemana, indice))
}

export function formatearFechaISO(fecha) {
    const fechaNormalizada = normalizarFechaLocal(fecha)

    if (fechaNormalizada === null) {
        return ""
    }

    const anio = String(fechaNormalizada.getFullYear()).padStart(4, "0")
    const mes = String(fechaNormalizada.getMonth() + 1).padStart(2, "0")
    const dia = String(fechaNormalizada.getDate()).padStart(2, "0")

    return `${anio}-${mes}-${dia}`
}

export function leerFechaISO(valor) {
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)

    if (coincidencia === null) {
        return null
    }

    const [, anio, mes, dia] = coincidencia
    const fecha = new Date(Number(anio), Number(mes) - 1, Number(dia))

    if (formatearFechaISO(fecha) !== valor) {
        return null
    }

    return fecha
}
