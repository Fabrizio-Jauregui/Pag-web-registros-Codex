import { compararPlanesPorSeguimiento } from "./planes.js"

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
    const esAplicacion = typeof seleccionado.idAplicacionPlantilla === "string"
        && seleccionado.idAplicacionPlantilla.trim() !== ""
    const esCronometro = seleccionado.modoSeguimientoPlanificacion === "cronometro"
    const planesDia = planes.filter(plan => mismoDiaLocal(plan.inicio, dia))
    const alcanceCompleto = esAplicacion
        ? planes.filter(plan => plan.idAplicacionPlantilla === seleccionado.idAplicacionPlantilla)
        : planesDia
    if (seleccionado.tipoPlanificacion === "focus") {
        return { ok: false, error: "Iniciá esta sesión Focus desde su bloque planificado; el seguimiento normal no puede registrar sus descansos y concentración." }
    }
    if (!esCronometro && alcanceCompleto.some(plan => plan.tipoPlanificacion === "focus")) {
        return { ok: false, error: "Esta planificación incluye una sesión Focus. Iníciala desde su bloque en el calendario para conservar sus períodos de concentración y descanso." }
    }
    const planesAlcance = esCronometro
        ? alcanceCompleto.filter(plan => plan.tipoPlanificacion !== "focus")
        : alcanceCompleto
    const ordenados = [...planesAlcance].sort(esCronometro
        ? (a, b) => (a.ordenSeguimiento ?? 0) - (b.ordenSeguimiento ?? 0) || a.id.localeCompare(b.id)
        : esAplicacion
        ? (a, b) => a.inicio.getTime() - b.inicio.getTime()
            || a.fin.getTime() - b.fin.getTime() || a.id.localeCompare(b.id)
        : compararPlanesPorSeguimiento)
    let indiceSeleccionado = esCronometro ? 0 : ordenados.findIndex(plan => plan.id === idPlanSeleccionado)
    if (esAplicacion && indiceSeleccionado > 0) {
        let inicioGrupoSeleccionado = ordenados[indiceSeleccionado].inicio.getTime()
        let cambio = true
        while (cambio) {
            cambio = false
            for (let indice = indiceSeleccionado - 1; indice >= 0; indice -= 1) {
                if (ordenados[indice].fin.getTime() > inicioGrupoSeleccionado) {
                    indiceSeleccionado = indice
                    inicioGrupoSeleccionado = ordenados[indice].inicio.getTime()
                    cambio = true
                }
            }
        }
    }
    const diaSinPlantillas = ordenados.slice(indiceSeleccionado)
        .find(plan => plan.eventoId && !eventos.some(evento => evento.id === plan.eventoId))
    if (diaSinPlantillas) {
        return { ok: false, error: "No se pudo cargar una plantilla de evento vinculada a la secuencia." }
    }
    const planesSecuencia = ordenados.slice(indiceSeleccionado)
    const secuencia = planesSecuencia.map(plan => {
        const evento = eventos.find(item => item.id === plan.eventoId)
        return {
            planId: plan.id,
            nombre: evento?.nombre ?? plan.nombre,
            evento: evento ? { id: evento.id, nombre: evento.nombre, color: evento.color } : null,
            inicioPrevisto: plan.inicio.toISOString(),
            finPrevisto: esCronometro ? null : plan.fin.toISOString(),
            duracionMs: esCronometro ? null : plan.fin.getTime() - plan.inicio.getTime(),
            ...(esAplicacion ? { idAplicacionPlantilla: seleccionado.idAplicacionPlantilla } : {}),
            ...(esCronometro ? { grupo: plan.grupoCronometro ?? 0, inicioOffsetMs: 0 } : {})
        }
    })

    if (esAplicacion && !esCronometro) {
        const grupos = []
        let grupo = null
        for (const item of secuencia) {
            const inicio = Date.parse(item.inicioPrevisto)
            const fin = Date.parse(item.finPrevisto)
            if (!grupo || inicio >= grupo.fin) {
                grupo = { items: [], inicio, fin }
                grupos.push(grupo)
            } else {
                grupo.fin = Math.max(grupo.fin, fin)
            }
            grupo.items.push(item)
        }
        const ordenes = new Map(planesSecuencia.map(plan => [plan.id, plan.ordenSeguimiento]))
        const hayOrdenExplicito = planesSecuencia.some(plan => Number.isInteger(plan.ordenSeguimiento))
        if (hayOrdenExplicito) {
            grupos.sort((a, b) => {
                const ordenA = Math.min(...a.items.map(item => ordenes.get(item.planId) ?? Number.MAX_SAFE_INTEGER))
                const ordenB = Math.min(...b.items.map(item => ordenes.get(item.planId) ?? Number.MAX_SAFE_INTEGER))
                return ordenA - ordenB || a.inicio - b.inicio
            })
        }
        const grupoSeleccionado = grupos.findIndex(item => item.items.some(elemento => elemento.planId === idPlanSeleccionado))
        if (grupoSeleccionado > 0) grupos.unshift(...grupos.splice(grupoSeleccionado, 1))
        let offsetGrupo = 0
        grupos.forEach((grupoActual, indiceGrupo) => {
            grupoActual.items.forEach(item => {
                item.grupo = indiceGrupo
                item.inicioOffsetMs = offsetGrupo + Date.parse(item.inicioPrevisto) - grupoActual.inicio
            })
            offsetGrupo += grupoActual.fin - grupoActual.inicio
        })
        secuencia.splice(0, secuencia.length, ...grupos.flatMap(item => item.items))
    }

    if (!esCronometro && secuencia.some(item => !Number.isFinite(item.duracionMs)
        || item.duracionMs < DURACION_MINIMA_REGISTRO_MS
        || item.duracionMs > DURACION_MAXIMA_REGISTRO_MS)) {
        return {
            ok: false,
            error: "Todos los eventos de la secuencia deben durar entre un segundo y 24 horas para poder registrarse."
        }
    }

    return { ok: true, secuencia, idAplicacionPlantilla: esAplicacion ? seleccionado.idAplicacionPlantilla : null, tipoSeguimiento: esCronometro ? "cronometro" : "duracion" }
}

export function validarEstadoSeguimiento(estado) {
    const instanteValido = valor => typeof valor === "string" && Number.isFinite(Date.parse(valor))
    if (!estado || typeof estado !== "object" || Array.isArray(estado)
        || typeof estado.id !== "string" || estado.id.trim() === ""
        || !["En curso", "Pausado"].includes(estado.estado)
        || !Array.isArray(estado.secuencia) || estado.secuencia.length === 0
        || !Number.isInteger(estado.indiceActual)
        || estado.indiceActual < 0 || estado.indiceActual >= estado.secuencia.length
        || typeof estado.registroId !== "string" || estado.registroId.trim() === "") return false

    if (estado.tipoSeguimiento !== undefined && !["cronometro", "duracion"].includes(estado.tipoSeguimiento)) return false
    const esCronometro = estado.tipoSeguimiento === "cronometro"

    if (estado.modoAvance !== undefined && !["automatico", "manual"].includes(estado.modoAvance)) return false
    if (estado.idAplicacionPlantilla !== undefined && estado.idAplicacionPlantilla !== null
        && typeof estado.idAplicacionPlantilla !== "string") return false
    if (estado.registrosActivos !== undefined && (!Array.isArray(estado.registrosActivos)
        || !estado.registrosActivos.every(item => item && typeof item.planId === "string"
            && typeof item.registroId === "string" && (esCronometro ? item.finBloque === null : instanteValido(item.finBloque))
            && (item.inicioReal === undefined || item.inicioReal === null || instanteValido(item.inicioReal))))) return false
    if (estado.finalizados !== undefined && (!Array.isArray(estado.finalizados)
        || !estado.finalizados.every(id => typeof id === "string"))) return false
    if (estado.inicioSeguimiento !== undefined && !instanteValido(estado.inicioSeguimiento)) return false

    if (!instanteValido(estado.inicio)) return false
    if (estado.estado === "En curso" && !(esCronometro && estado.finBloque === null) && !instanteValido(estado.finBloque)) return false
    if (estado.estado === "Pausado" && (estado.finBloque !== null
        || !Number.isFinite(estado.restanteMs) || estado.restanteMs < 0)) return false

    const eventosOmitidos = estado.eventosOmitidos ?? []
    if (!Array.isArray(eventosOmitidos)) return false
    const idsOmitidos = new Set()
    const idsActivos = new Set((estado.registrosActivos ?? []).map(item => item.planId))
    for (const planId of eventosOmitidos) {
        const indiceOmitido = estado.secuencia.findIndex(item => item?.planId === planId)
        const fueraDePosicion = estado.idAplicacionPlantilla
            ? idsActivos.has(planId)
            : indiceOmitido >= estado.indiceActual
        if (typeof planId !== "string" || indiceOmitido < 0 || fueraDePosicion
            || idsOmitidos.has(planId)) return false
        idsOmitidos.add(planId)
    }

    return estado.secuencia.every(item => item && typeof item.planId === "string"
        && item.planId.trim() !== "" && typeof item.nombre === "string" && item.nombre.trim() !== ""
        && (esCronometro ? item.duracionMs === null : Number.isFinite(item.duracionMs) && item.duracionMs >= DURACION_MINIMA_REGISTRO_MS
            && item.duracionMs <= DURACION_MAXIMA_REGISTRO_MS)
        && instanteValido(item.inicioPrevisto) && (esCronometro ? item.finPrevisto === null : instanteValido(item.finPrevisto))
        && (item.grupo === undefined || Number.isInteger(item.grupo) && item.grupo >= 0)
        && (item.inicioOffsetMs === undefined || Number.isFinite(item.inicioOffsetMs) && item.inicioOffsetMs >= 0)
        && (item.evento === null || (typeof item.evento?.id === "string"
            && typeof item.evento?.nombre === "string" && typeof item.evento?.color === "string")))
}
