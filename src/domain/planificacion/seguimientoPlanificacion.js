const DURACION_MINIMA_REGISTRO_MS = 1000
const DURACION_MAXIMA_REGISTRO_MS = 24 * 60 * 60 * 1000

function mismoDiaLocal(fecha, dia) {
    return fecha instanceof Date
        && fecha.getFullYear() === dia.getFullYear()
        && fecha.getMonth() === dia.getMonth()
        && fecha.getDate() === dia.getDate()
}

export function crearSecuenciaSeguimiento(planes, idPlanSeleccionado, eventos = []) {
    if (!Array.isArray(planes) || !Array.isArray(eventos)) {
        return { ok: false, error: "No se pudieron cargar los planes del día." }
    }

    const seleccionado = planes.find(plan => plan.id === idPlanSeleccionado)
    if (!seleccionado) return { ok: false, error: "No se encontró el plan seleccionado." }

    const dia = seleccionado.inicio
    const ordenados = planes
        .filter(plan => mismoDiaLocal(plan.inicio, dia))
        .sort((a, b) => a.inicio.getTime() - b.inicio.getTime()
            || a.fin.getTime() - b.fin.getTime()
            || a.id.localeCompare(b.id))
    const indiceSeleccionado = ordenados.findIndex(plan => plan.id === idPlanSeleccionado)
    const diaSinPlantillas = ordenados.slice(indiceSeleccionado)
        .find(plan => plan.eventoId && !eventos.some(evento => evento.id === plan.eventoId))
    if (diaSinPlantillas) {
        return { ok: false, error: "No se pudo cargar una plantilla de evento vinculada a la secuencia." }
    }
    const secuencia = ordenados.slice(indiceSeleccionado).map(plan => {
        const evento = eventos.find(item => item.id === plan.eventoId)
        return {
            planId: plan.id,
            nombre: evento?.nombre ?? plan.nombre,
            evento: evento ? { id: evento.id, nombre: evento.nombre, color: evento.color } : null,
            inicioPrevisto: plan.inicio.toISOString(),
            finPrevisto: plan.fin.toISOString(),
            duracionMs: plan.fin.getTime() - plan.inicio.getTime()
        }
    })

    if (secuencia.some(item => !Number.isFinite(item.duracionMs)
        || item.duracionMs < DURACION_MINIMA_REGISTRO_MS
        || item.duracionMs > DURACION_MAXIMA_REGISTRO_MS)) {
        return {
            ok: false,
            error: "Todos los eventos de la secuencia deben durar entre un segundo y 24 horas para poder registrarse."
        }
    }

    return { ok: true, secuencia }
}

export function validarEstadoSeguimiento(estado) {
    if (!estado || typeof estado !== "object" || Array.isArray(estado)
        || typeof estado.id !== "string" || estado.id.trim() === ""
        || !["En curso", "Pausado"].includes(estado.estado)
        || !Array.isArray(estado.secuencia) || estado.secuencia.length === 0
        || !Number.isInteger(estado.indiceActual)
        || estado.indiceActual < 0 || estado.indiceActual >= estado.secuencia.length
        || typeof estado.registroId !== "string" || estado.registroId.trim() === "") return false

    const instanteValido = valor => typeof valor === "string" && Number.isFinite(Date.parse(valor))
    if (!instanteValido(estado.inicio)) return false
    if (estado.estado === "En curso" && !instanteValido(estado.finBloque)) return false
    if (estado.estado === "Pausado" && (estado.finBloque !== null
        || !Number.isFinite(estado.restanteMs) || estado.restanteMs < 0)) return false

    return estado.secuencia.every(item => item && typeof item.planId === "string"
        && item.planId.trim() !== "" && typeof item.nombre === "string" && item.nombre.trim() !== ""
        && Number.isFinite(item.duracionMs) && item.duracionMs >= DURACION_MINIMA_REGISTRO_MS
        && item.duracionMs <= DURACION_MAXIMA_REGISTRO_MS
        && instanteValido(item.inicioPrevisto) && instanteValido(item.finPrevisto)
        && (item.evento === null || (typeof item.evento?.id === "string"
            && typeof item.evento?.nombre === "string" && typeof item.evento?.color === "string")))
}
