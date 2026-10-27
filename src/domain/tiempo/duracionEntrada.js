const MAX_DURACION_SEGUNDOS = 24 * 60 * 60

export function parsearDuracionEntrada(valor, { permitirNegativa = false, maxSegundos = MAX_DURACION_SEGUNDOS } = {}) {
    if (typeof valor !== "string") return null
    const texto = valor.trim().toLocaleLowerCase("es")
    if (!texto) return null

    const prefijoSigno = texto.match(/^([+-])\s*/)
    const signo = prefijoSigno?.[1] === "-" ? -1 : 1
    if (signo < 0 && !permitirNegativa) return null
    const cuerpo = prefijoSigno ? texto.slice(prefijoSigno[0].length) : texto
    let total

    const formatoConDosPuntos = cuerpo.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/)
    if (formatoConDosPuntos) {
        const primero = Number(formatoConDosPuntos[1])
        const segundo = Number(formatoConDosPuntos[2])
        const tercero = formatoConDosPuntos[3] === undefined ? null : Number(formatoConDosPuntos[3])
        if (segundo > 59 || (tercero !== null && tercero > 59)) return null
        total = tercero === null
            ? primero * 60 + segundo
            : primero * 3600 + segundo * 60 + tercero
    } else if (/^\d+$/.test(cuerpo)) {
        // Un número sin unidad se interpreta como minutos, que es lo habitual al planificar.
        total = Number(cuerpo) * 60
    } else {
        const expresionUnidad = /(\d+)\s*(horas?|h|minutos?|min|m|segundos?|seg|s)/g
        let coincidencia
        let posicion = 0
        let cantidad = 0
        let valido = true

        while ((coincidencia = expresionUnidad.exec(cuerpo)) !== null) {
            if (cuerpo.slice(posicion, coincidencia.index).trim() !== "") {
                valido = false
                break
            }
            const numero = Number(coincidencia[1])
            const unidad = coincidencia[2]
            cantidad += numero * (unidad === "h" || unidad.startsWith("hora")
                ? 3600
                : unidad === "s" || unidad.startsWith("seg") ? 1 : 60)
            posicion = expresionUnidad.lastIndex
        }

        if (!valido || cantidad === 0 && !/\d/.test(cuerpo) || cuerpo.slice(posicion).trim() !== "") return null
        total = cantidad
    }

    if (!Number.isSafeInteger(total) || total > maxSegundos) return null
    return total * signo
}

export function formatearDuracionEntrada(segundos) {
    if (!Number.isFinite(segundos)) return ""
    const signo = segundos < 0 ? "−" : ""
    let restante = Math.floor(Math.abs(segundos))
    const horas = Math.floor(restante / 3600)
    restante %= 3600
    const minutos = Math.floor(restante / 60)
    const segundosRestantes = restante % 60
    const partes = []

    if (horas) partes.push(`${horas} h`)
    if (minutos) partes.push(`${minutos} min`)
    if (segundosRestantes || partes.length === 0) partes.push(`${segundosRestantes} s`)
    return signo + partes.join(" ")
}
