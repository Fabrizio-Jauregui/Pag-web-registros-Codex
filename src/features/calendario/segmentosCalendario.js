import { calcularLimiteRegistro } from "../../domain/tiempo/CalculosDuracion.js"
import { formatearFechaISO } from "../../domain/tiempo/FechaCalendario.js"

export function obtenerFragmentosCalendario(registros, fecha, ahora = new Date()) {
    const fechaISO = formatearFechaISO(fecha)
    const fragmentos = []

    if (!fechaISO || !Array.isArray(registros)) {
        return fragmentos
    }

    for (const registro of registros) {
        const limite = calcularLimiteRegistro(registro.segmentos[0].inicio)

        for (const [indice, segmento] of registro.segmentos.entries()) {
            const inicio = segmento.inicio
            const finAbierto = segmento.fin === null
            const fin = finAbierto
                ? new Date(Math.min(
                    Math.max(ahora.getTime(), inicio.getTime() + 1000),
                    limite?.getTime() ?? Number.POSITIVE_INFINITY
                ))
                : segmento.fin

            if (fin.getTime() <= inicio.getTime()) {
                continue
            }

            let cursor = inicio

            while (cursor < fin) {
                const inicioDia = new Date(cursor)
                inicioDia.setHours(0, 0, 0, 0)
                const siguienteDia = new Date(inicioDia)
                siguienteDia.setDate(siguienteDia.getDate() + 1)
                const finFragmento = fin < siguienteDia ? fin : siguienteDia

                if (formatearFechaISO(inicioDia) === fechaISO) {
                    const minutosInicio = cursor.getHours() * 60
                        + cursor.getMinutes()
                        + cursor.getSeconds() / 60
                    const minutosFin = finFragmento.getTime() === siguienteDia.getTime()
                        ? 1440
                        : finFragmento.getHours() * 60
                            + finFragmento.getMinutes()
                            + finFragmento.getSeconds() / 60
                            + finFragmento.getMilliseconds() / 60000

                    fragmentos.push({
                        id: `${registro.id}-${indice}-${formatearFechaISO(inicioDia)}`,
                        fechaISO: formatearFechaISO(inicioDia),
                        registro,
                        segmento,
                        indiceSegmento: indice,
                        inicio: cursor,
                        fin: finFragmento,
                        finMaximoVisible: siguienteDia,
                        minutosInicio,
                        minutosFin,
                        minutosFinParaCarriles: finAbierto && finFragmento === fin ? 1440 : minutosFin,
                        abierto: finAbierto && finFragmento === fin
                    })
                }

                cursor = finFragmento
            }
        }
    }

    return fragmentos
}

export function obtenerFragmentosPlanesCalendario(planes, fecha) {
    const fechaISO = formatearFechaISO(fecha)
    const inicioDia = new Date(fecha)
    inicioDia.setHours(0, 0, 0, 0)
    const finDia = new Date(inicioDia)
    finDia.setDate(finDia.getDate() + 1)
    if (!fechaISO || !Array.isArray(planes)) return []

    return planes.flatMap(plan => {
        const inicio = new Date(Math.max(plan.inicio.getTime(), inicioDia.getTime()))
        const fin = new Date(Math.min(plan.fin.getTime(), finDia.getTime()))
        if (fin <= inicio) return []
        const minutosInicio = inicio.getHours() * 60 + inicio.getMinutes()
            + inicio.getSeconds() / 60 + inicio.getMilliseconds() / 60000
        const minutosFin = fin.getTime() === finDia.getTime()
            ? 1440
            : fin.getHours() * 60 + fin.getMinutes() + fin.getSeconds() / 60
                + fin.getMilliseconds() / 60000
        return [{
            id: `${plan.id}-${fechaISO}`,
            fechaISO,
            plan,
            inicio,
            fin,
            minutosInicio,
            minutosFin,
            minutosFinParaCarriles: minutosFin
        }]
    })
}

export function obtenerValorFechaHoraLocal(fecha) {
    const dosDigitos = numero => String(numero).padStart(2, "0")
    const anio = String(fecha.getFullYear()).padStart(4, "0")
    const fechaHora = `${anio}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`
    const hora = `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`
    const segundos = `${dosDigitos(fecha.getSeconds())}.${String(fecha.getMilliseconds()).padStart(3, "0")}`

    return `${fechaHora}T${hora}:${segundos}`
}

export function leerValorFechaHoraLocal(valor) {
    if (typeof valor !== "string") {
        return null
    }

    const partes = valor.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/)

    if (!partes) {
        return null
    }

    const segundos = partes[2] ?? "00"
    const milisegundos = (partes[3] ?? "").padEnd(3, "0") || "000"
    const valorCompleto = `${partes[1]}:${segundos}.${milisegundos}`
    const fecha = new Date(valorCompleto)
    const normalizado = Number.isFinite(fecha.getTime())
        ? obtenerValorFechaHoraLocal(fecha)
        : null

    return normalizado === valorCompleto
        ? fecha
        : null
}
