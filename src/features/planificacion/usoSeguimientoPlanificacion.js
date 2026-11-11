import { useEffect, useRef, useState } from "react"

import { calcularTiempoEfectivo } from "../../domain/tiempo/CalculosDuracion.js"
import { compararPlanesPorSeguimiento } from "../../domain/planificacion/planes.js"
import {
    cargarSeguimientoPlanificacion,
    guardarSeguimientoPlanificacion
} from "../../domain/planificacion/persistenciaSeguimientoPlanificacion.js"
import { crearSecuenciaSeguimiento } from "../../domain/planificacion/seguimientoPlanificacion.js"

function crearId() {
    try { return globalThis.crypto.randomUUID() } catch { return null }
}

function usaAvancePorEtapas(sesion) {
    return Boolean(sesion?.idAplicacionPlantilla || sesion?.controlAvancePorEtapas)
}

export function useSeguimientoPlanificacion(estadoRegistro, tareas = []) {
    const [cargaInicial] = useState(cargarSeguimientoPlanificacion)
    const [estado, cambiarEstado] = useState(() => cargaInicial.estado)
    const [error, cambiarError] = useState(() => cargaInicial.error ?? "")
    const [mensaje, cambiarMensaje] = useState("")
    const [ahora, cambiarAhora] = useState(() => Date.now())
    const estadoRef = useRef(estado)
    const registroRef = useRef(estadoRegistro)
    const tareasRef = useRef(tareas)
    const procesarRef = useRef(() => {})

    useEffect(() => { registroRef.current = estadoRegistro }, [estadoRegistro])
    useEffect(() => { tareasRef.current = tareas }, [tareas])

    const idSeguimiento = estado?.id
    const registroIdActual = estado?.registroId
    const estadoSeguimiento = estado?.estado
    const planIdActual = estado?.secuencia[estado.indiceActual]?.planId

    useEffect(() => {
        if (!idSeguimiento || !estadoRegistro.datos.ok) return undefined
        const temporizador = setTimeout(() => {
            const activos = estadoRef.current?.registrosActivos
            if (estadoRef.current?.tipoSeguimiento === "cronometro" && (!activos || activos.length === 0)) return
            if (usaAvancePorEtapas(estadoRef.current) && (!activos || activos.length === 0)) return
            const registrosValidos = activos?.length
                ? activos.every(item => {
                    const registro = registroRef.current.buscar(item.registroId)
                    return registro?.planId === item.planId
                        && registro.estado === (estadoSeguimiento === "Pausado" ? "Pausado" : "En curso")
                })
                : (() => {
                    const registro = registroRef.current.buscar(registroIdActual)
                    const estadoEsperado = estadoSeguimiento === "Pausado" ? "Pausado" : "En curso"
                    return registro?.planId === planIdActual && registro.estado === estadoEsperado
                })()
            if (registrosValidos) return

            const limpieza = guardarSeguimientoPlanificacion(null)
            if (limpieza.ok) {
                estadoRef.current = null
                cambiarEstado(null)
                cambiarError("El seguimiento guardado no coincide con el registro activo y se cerró para proteger los datos.")
            } else {
                cambiarError(limpieza.error)
            }
        }, 0)
        return () => clearTimeout(temporizador)
    }, [idSeguimiento, registroIdActual, estadoSeguimiento, planIdActual, estadoRegistro.datos.ok])

    function publicar(nuevoEstado) {
        estadoRef.current = nuevoEstado
        cambiarEstado(nuevoEstado)
    }

    function guardar(nuevoEstado) {
        const resultado = guardarSeguimientoPlanificacion(nuevoEstado)
        if (!resultado.ok) cambiarError(resultado.error)
        else cambiarError("")
        return resultado.ok
    }

    function iniciarRegistroDePlan(secuencia, indice, instante) {
        const elemento = secuencia[indice]
        const tareaActual = elemento.tarea && tareasRef.current.find(item => item.id === elemento.tarea.id)
        const tarea = tareaActual ? { ...elemento.tarea, nombre: tareaActual.nombre } : elemento.tarea
        return registroRef.current.iniciarConId(
            elemento.nombre,
            elemento.evento,
            new Date(instante),
            tarea,
            { planId: elemento.planId, ...(elemento.actividadPuntual ? { actividadPuntual: elemento.actividadPuntual } : {}) }
        )
    }

    function iniciarEventosCronometro(sesion, ids, instante) {
        const activos = [...(sesion.registrosActivos ?? [])]
        const iniciados = new Set(sesion.iniciados ?? [])
        for (const planId of ids) {
            const indice = sesion.secuencia.findIndex(item => item.planId === planId)
            if (indice < 0 || iniciados.has(planId) || (sesion.eventosOmitidos ?? []).includes(planId)) continue
            const registroId = iniciarRegistroDePlan(sesion.secuencia, indice, instante)
            if (!registroId) {
                for (const activo of activos.filter(item => !sesion.registrosActivos?.some(anterior => anterior.registroId === item.registroId))) cerrarRegistroActual({ registroId: activo.registroId }, instante)
                return { ok: false, error: registroRef.current.obtenerError?.() || registroRef.current.error || "No se pudo iniciar el evento planificado." }
            }
            const item = sesion.secuencia[indice]
            activos.push({ planId, registroId, inicioReal: new Date(instante).toISOString(), elapsedMs: 0, finBloque: null, grupo: item.grupo ?? 0 })
            iniciados.add(planId)
        }
        return { ok: true, activos, iniciados: [...iniciados] }
    }

    function completarSesionCronometro(sesion, activos, finalizados, eventosOmitidos = sesion.eventosOmitidos ?? []) {
        const todosResueltos = sesion.secuencia.every(item => finalizados.includes(item.planId) || eventosOmitidos.includes(item.planId))
        if (todosResueltos && activos.length === 0) {
            if (!guardar(null)) return false
            publicar(null)
            cambiarMensaje("Terminó la planificación.")
            return true
        }
        return false
    }

    function iniciarGrupoSecuencia(sesion, grupo, instante, idsInicioForzado = []) {
        const activos = [...(sesion.registrosActivos ?? [])]
        const iniciados = new Set(sesion.iniciados ?? [])
        const inicioForzado = new Set(idsInicioForzado)
        for (let indice = 0; indice < sesion.secuencia.length; indice += 1) {
            const item = sesion.secuencia[indice]
            if (item.grupo !== grupo || iniciados.has(item.planId)
                || (sesion.eventosOmitidos ?? []).includes(item.planId)) continue
            const cuando = Date.parse(sesion.inicioSeguimiento) + item.inicioOffsetMs
            if (cuando > instante && !inicioForzado.has(item.planId)) continue
            const inicioReal = inicioForzado.has(item.planId) ? instante : Math.max(cuando, instante)
            const registroId = iniciarRegistroDePlan(sesion.secuencia, indice, inicioReal)
            if (!registroId) return {
                ok: false,
                activos,
                iniciados: [...iniciados],
                error: registroRef.current.obtenerError?.() || registroRef.current.error || "No se pudo iniciar un evento de la planificación."
            }
            activos.push({ planId: item.planId, registroId, finBloque: new Date(inicioReal + item.duracionMs).toISOString(), grupo })
            iniciados.add(item.planId)
        }
        return { ok: true, activos, iniciados: [...iniciados] }
    }

    function obtenerSiguienteEtapa(sesion) {
        if (!usaAvancePorEtapas(sesion) || sesion.tipoSeguimiento === "cronometro"
            || sesion.estado !== "En curso") return null
        const iniciados = new Set(sesion.iniciados ?? [])
        const resueltos = new Set([...(sesion.finalizados ?? []), ...(sesion.eventosOmitidos ?? [])])
        const grupos = [...new Set(sesion.secuencia.map(item => item.grupo ?? 0))].sort((a, b) => a - b)
        const ultimoGrupoIniciado = Math.max(-1, ...sesion.secuencia
            .filter(item => iniciados.has(item.planId))
            .map(item => item.grupo ?? 0))
        for (const grupo of grupos) {
            if (grupo <= ultimoGrupoIniciado) continue
            const pendientes = sesion.secuencia.filter(item => (item.grupo ?? 0) === grupo
                && !iniciados.has(item.planId) && !resueltos.has(item.planId))
            if (pendientes.length) return { grupo, pendientes }
        }
        return null
    }

    function procesarSecuenciaPorEtapas(instanteActual, sesionInicial = estadoRef.current, reintentarPendiente = false) {
        let sesion = sesionInicial
        if (!sesion || sesion.estado !== "En curso" || !usaAvancePorEtapas(sesion)) return
        let activos = [...(sesion.registrosActivos ?? [])]
        let finalizados = [...(sesion.finalizados ?? [])]
        const cantidadActivosInicial = activos.length
        const cantidadFinalizadosInicial = finalizados.length
        const cantidadIniciadosInicial = (sesion.iniciados ?? []).length
        const iniciados = new Set(sesion.iniciados ?? [])
        const grupoTransicionPendiente = sesion.transicionPendiente
            ? sesion.secuencia.find(item => sesion.transicionPendiente.planIds.includes(item.planId))?.grupo
            : null
        const idsInicioForzado = reintentarPendiente ? sesion.transicionPendiente?.planIds ?? [] : []
        function conservarInicioParcial(resultado) {
            const activosIds = new Set(resultado.activos.map(item => item.planId))
            const activoPrincipal = resultado.activos[0]
            const estadoParcial = {
                ...sesion,
                registrosActivos: resultado.activos,
                iniciados: resultado.iniciados,
                finalizados,
                indiceActual: Math.max(0, resultado.activos.length
                    ? sesion.secuencia.findIndex(item => activosIds.has(item.planId))
                    : sesion.secuencia.findIndex(item => !finalizados.includes(item.planId)
                        && !(sesion.eventosOmitidos ?? []).includes(item.planId))),
                registroId: activoPrincipal?.registroId ?? sesion.registroId,
                finBloque: activoPrincipal?.finBloque ?? new Date(instanteActual + 86400000).toISOString()
            }
            if (guardar(estadoParcial)) publicar(estadoParcial)
            cambiarError(resultado.error)
        }
        const grupoActivoAntesDelVencimiento = activos[0]?.grupo
        if (grupoActivoAntesDelVencimiento !== undefined
            && (reintentarPendiente || grupoActivoAntesDelVencimiento !== grupoTransicionPendiente)) {
            const nuevas = iniciarGrupoSecuencia({ ...sesion, registrosActivos: activos, iniciados: [...iniciados] }, grupoActivoAntesDelVencimiento, instanteActual,
                grupoActivoAntesDelVencimiento === grupoTransicionPendiente ? idsInicioForzado : [])
            if (!nuevas.ok) { conservarInicioParcial(nuevas); return }
            activos = nuevas.activos
            nuevas.iniciados.forEach(id => iniciados.add(id))
        }
        if (sesion.modoAvance === "automatico") {
            for (const activo of activos.filter(item => Date.parse(item.finBloque) <= instanteActual)) {
                const cierre = cerrarRegistroActual({ registroId: activo.registroId }, Date.parse(activo.finBloque))
                if (!cierre.ok) { cambiarError(cierre.error); return }
                activos = activos.filter(item => item.planId !== activo.planId)
                finalizados.push(activo.planId)
            }
        }

        const completados = new Set([...finalizados, ...(sesion.eventosOmitidos ?? [])])
        const porGrupo = [...new Set(sesion.secuencia.map(item => item.grupo))].sort((a, b) => a - b)
        const etapasDesbloqueadas = new Set(sesion.etapasDesbloqueadas ?? [])
        for (const grupo of porGrupo) {
            const itemsGrupo = sesion.secuencia.filter(item => item.grupo === grupo)
            if (itemsGrupo.every(item => completados.has(item.planId))) continue
            if (grupo === grupoTransicionPendiente && !reintentarPendiente) break
            const previos = sesion.secuencia.filter(item => item.grupo < grupo)
            if (!itemsGrupo.some(item => etapasDesbloqueadas.has(item.planId))
                && previos.some(item => !completados.has(item.planId))) break
            const nuevas = iniciarGrupoSecuencia({ ...sesion, registrosActivos: activos, iniciados: [...iniciados] }, grupo, instanteActual,
                grupo === grupoTransicionPendiente ? idsInicioForzado : [])
            if (!nuevas.ok) { conservarInicioParcial(nuevas); return }
            activos = nuevas.activos
            nuevas.iniciados.forEach(id => iniciados.add(id))
        }

        const todosTerminados = sesion.secuencia.every(item => completados.has(item.planId)
            || (sesion.modoAvance === "manual" && activos.some(activo => activo.planId === item.planId)))
            && activos.length === 0
        if (todosTerminados) {
            if (!guardar(null)) return
            publicar(null)
            cambiarMensaje("Terminó la planificación.")
            cambiarAhora(instanteActual)
            return
        }
        if (activos.length === cantidadActivosInicial
            && finalizados.length === cantidadFinalizadosInicial
            && iniciados.size === cantidadIniciadosInicial) {
            cambiarAhora(instanteActual)
            return
        }
        const proximoIndice = sesion.secuencia.findIndex(item => !completados.has(item.planId))
        const activosIds = new Set(activos.map(item => item.planId))
        const indiceActivo = sesion.secuencia.findIndex(item => activosIds.has(item.planId))
        const activoPrincipal = activos[0]
        sesion = {
            ...sesion,
            registrosActivos: activos,
            iniciados: [...iniciados],
            finalizados,
            transicionPendiente: sesion.transicionPendiente
                && sesion.transicionPendiente.planIds.some(planId => iniciados.has(planId))
                ? null
                : sesion.transicionPendiente,
            indiceActual: Math.max(0, indiceActivo >= 0 ? indiceActivo : proximoIndice),
            registroId: activoPrincipal?.registroId ?? sesion.registroId,
            inicio: activoPrincipal?.finBloque ? new Date(instanteActual).toISOString() : sesion.inicio,
            finBloque: activoPrincipal?.finBloque ?? new Date(instanteActual + 86400000).toISOString()
        }
        if (!guardar(sesion)) return
        publicar(sesion)
        cambiarAhora(instanteActual)
    }

    function cerrarRegistroActual(sesion, instante) {
        const api = registroRef.current
        const registro = api.buscar(sesion.registroId)
        if (!registro) return { ok: false, error: "No se encontró el registro activo del plan." }

        if (calcularTiempoEfectivo(registro.segmentos, new Date(instante)) >= 1) {
            return api.finalizar(sesion.registroId, new Date(instante))
                ? { ok: true }
                : { ok: false, error: api.error || "No se pudo finalizar el registro del plan." }
        }

        return api.descartarPlanSinDuracion(sesion.registroId, new Date(instante))
            ? { ok: true, descartado: true }
            : { ok: false, error: api.error || "No se pudo descartar el registro de duración insuficiente." }
    }

    function procesarVencimientos(instanteActual) {
        let sesion = estadoRef.current
        if (sesion?.tipoSeguimiento === "cronometro") {
            if (sesion.estado === "En curso") cambiarAhora(instanteActual)
            return
        }
        if (usaAvancePorEtapas(sesion)) {
            procesarSecuenciaPorEtapas(instanteActual, sesion)
            return
        }
        if (sesion?.modoAvance !== "automatico") {
            cambiarAhora(instanteActual)
            return
        }
        let limitePasos = 0

        while (sesion?.estado === "En curso"
            && Date.parse(sesion.finBloque) <= instanteActual
            && limitePasos < sesion.secuencia.length) {
            limitePasos += 1
            const finEvento = Date.parse(sesion.finBloque)
            const cierre = cerrarRegistroActual(sesion, finEvento)
            if (!cierre.ok) {
                cambiarError(cierre.error)
                return
            }

            const siguienteIndice = sesion.indiceActual + 1
            if (siguienteIndice >= sesion.secuencia.length) {
                guardar(null)
                publicar(null)
                cambiarMensaje("Terminó la secuencia de planificación.")
                cambiarAhora(instanteActual)
                return
            }

            const registroId = iniciarRegistroDePlan(sesion.secuencia, siguienteIndice, finEvento)
            if (!registroId) {
                guardar(null)
                publicar(null)
                cambiarError(registroRef.current.obtenerError?.() || registroRef.current.error || "No se pudo iniciar el siguiente evento planificado.")
                return
            }

            sesion = {
                ...sesion,
                indiceActual: siguienteIndice,
                registroId,
                inicio: new Date(finEvento).toISOString(),
                finBloque: new Date(finEvento + sesion.secuencia[siguienteIndice].duracionMs).toISOString()
            }
            if (!guardar(sesion)) {
                cerrarRegistroActual(sesion, instanteActual)
                guardar(null)
                publicar(null)
                return
            }
            publicar(sesion)
            cambiarMensaje(`Terminó “${sesion.secuencia[siguienteIndice - 1].nombre}”. Ahora sigue “${sesion.secuencia[siguienteIndice].nombre}”.`)
        }

        cambiarAhora(instanteActual)
    }

    useEffect(() => { procesarRef.current = procesarVencimientos })

    useEffect(() => {
        if (estado?.estado !== "En curso") return undefined
        const intervalo = setInterval(() => procesarRef.current(Date.now()), 250)
        return () => clearInterval(intervalo)
    }, [estado?.estado, estado?.finBloque, estado?.registrosActivos?.length, estado?.modoAvance])

    function empezar(planId, modo, planes, eventos, tareasDisponibles = tareasRef.current) {
        if (estadoRef.current) return { ok: false, error: "Ya hay un seguimiento de planificación activo." }
        const resultado = crearSecuenciaSeguimiento(planes, modo === "primero"
            ? obtenerPrimerPlanDelDia(planes, planId)
            : planId, eventos, tareasDisponibles)
        if (!resultado.ok) return resultado

        const id = crearId()
        if (!id) return { ok: false, error: "No se pudo crear la identidad del seguimiento." }
        const instante = Date.now()
        if (resultado.tipoSeguimiento === "cronometro") {
            const grupoInicial = resultado.secuencia[0]?.grupo ?? 0
            const seleccionado = resultado.secuencia.find(item => item.planId === planId)
            if (modo !== "grupo" && seleccionado?.grupo !== grupoInicial) return { ok: false, error: "Empezá por un evento de la primera etapa de la secuencia." }
            const idsIniciales = modo === "grupo"
                ? resultado.secuencia.filter(item => item.grupo === grupoInicial).map(item => item.planId)
                : [resultado.secuencia.find(item => item.planId === planId)?.planId ?? resultado.secuencia[0].planId]
            const base = {
                id,
                estado: "En curso",
                tipoSeguimiento: "cronometro",
                secuencia: resultado.secuencia,
                indiceActual: resultado.secuencia.findIndex(item => idsIniciales.includes(item.planId)),
                eventosOmitidos: [], finalizados: [], iniciados: [], registrosActivos: [],
                registroId: "pendiente", inicio: new Date(instante).toISOString(),
                inicioSeguimiento: new Date(instante).toISOString(), finBloque: null,
                idAplicacionPlantilla: resultado.idAplicacionPlantilla
            }
            const iniciados = iniciarEventosCronometro(base, idsIniciales, instante)
            if (!iniciados.ok || iniciados.activos.length === 0) return { ok: false, error: iniciados.error ?? "No se pudo iniciar la secuencia." }
            const sesion = { ...base, registrosActivos: iniciados.activos, iniciados: iniciados.iniciados, registroId: iniciados.activos[0].registroId }
            if (!guardar(sesion)) {
                iniciados.activos.forEach(activo => cerrarRegistroActual({ registroId: activo.registroId }, Date.now()))
                return { ok: false, error: "No se pudo guardar el seguimiento. Los registros iniciados se cerraron." }
            }
            publicar(sesion)
            cambiarMensaje("")
            cambiarAhora(instante)
            return { ok: true }
        }
        if (resultado.tipoSeguimiento === "duracion") {
            const sesion = {
                id,
                estado: "En curso",
                tipoSeguimiento: "duracion",
                ...(!resultado.idAplicacionPlantilla ? { controlAvancePorEtapas: true } : {}),
                secuencia: resultado.secuencia,
                indiceActual: 0,
                eventosOmitidos: [],
                finalizados: [],
                iniciados: [],
                registrosActivos: [],
                registroId: "pendiente",
                inicio: new Date(instante).toISOString(),
                inicioSeguimiento: new Date(instante).toISOString(),
                finBloque: new Date(instante + resultado.secuencia[0].duracionMs).toISOString(),
                modoAvance: "manual",
                ...(resultado.idAplicacionPlantilla ? { idAplicacionPlantilla: resultado.idAplicacionPlantilla } : {})
            }
            const primerGrupo = iniciarGrupoSecuencia(sesion, resultado.secuencia[0].grupo, instante)
            if (!primerGrupo.ok || primerGrupo.activos.length === 0) return { ok: false, error: primerGrupo.error ?? "No se pudo iniciar la planificación." }
            sesion.registrosActivos = primerGrupo.activos
            sesion.iniciados = primerGrupo.iniciados
            sesion.registroId = primerGrupo.activos[0].registroId
            sesion.finBloque = primerGrupo.activos[0].finBloque
            if (!guardar(sesion)) return { ok: false, error: "No se pudo guardar el seguimiento." }
            publicar(sesion)
            cambiarMensaje("")
            cambiarAhora(instante)
            return { ok: true }
        }
        const registroId = iniciarRegistroDePlan(resultado.secuencia, 0, instante)
        if (!registroId) {
            return { ok: false, error: registroRef.current.obtenerError?.() || registroRef.current.error || "No se pudo iniciar el registro del plan." }
        }

        const sesion = {
            id,
            estado: "En curso",
            secuencia: resultado.secuencia,
            indiceActual: 0,
            eventosOmitidos: [],
            registroId,
            inicio: new Date(instante).toISOString(),
            finBloque: new Date(instante + resultado.secuencia[0].duracionMs).toISOString()
        }
        if (!guardar(sesion)) {
            cerrarRegistroActual(sesion, Date.now())
            return { ok: false, error: "No se pudo guardar el seguimiento. El registro iniciado se cerró." }
        }
        publicar(sesion)
        cambiarMensaje("")
        cambiarAhora(instante)
        return { ok: true }
    }

    function pausar() {
        let sesion = estadoRef.current
        if (!sesion || sesion.estado !== "En curso") return false
        const instante = Date.now()
        if (sesion.tipoSeguimiento === "cronometro") {
            const pausados = []
            for (const activo of sesion.registrosActivos ?? []) {
                if (!registroRef.current.pausar(activo.registroId, new Date(instante))) {
                    pausados.forEach(id => registroRef.current.continuar(id, new Date(instante)))
                    return false
                }
                pausados.push(activo.registroId)
            }
            const pausa = {
                ...sesion, estado: "Pausado", pausaInicio: new Date(instante).toISOString(), finBloque: null, restanteMs: 0,
                registrosActivos: sesion.registrosActivos.map(activo => ({
                    ...activo, elapsedMs: (activo.elapsedMs ?? 0) + Math.max(0, instante - Date.parse(activo.inicioReal)), inicioReal: null
                }))
            }
            if (!guardar(pausa)) { pausados.forEach(id => registroRef.current.continuar(id, new Date(instante))); return false }
            publicar(pausa)
            cambiarAhora(instante)
            return true
        }
        if (usaAvancePorEtapas(sesion)) {
            const pausados = []
            for (const activo of sesion.registrosActivos ?? []) {
                if (!registroRef.current.pausar(activo.registroId, new Date(instante))) {
                    pausados.forEach(id => registroRef.current.continuar(id, new Date(instante)))
                    return false
                }
                pausados.push(activo.registroId)
            }
            const pausada = {
                ...sesion,
                estado: "Pausado",
                pausaInicio: new Date(instante).toISOString(),
                restanteMs: 0,
                finBloque: null,
                registrosActivos: sesion.registrosActivos.map(item => ({
                    ...item,
                    restanteMs: Date.parse(item.finBloque) - instante
                }))
            }
            if (!guardar(pausada)) {
                pausados.forEach(id => registroRef.current.continuar(id, new Date(instante)))
                return false
            }
            publicar(pausada)
            cambiarAhora(instante)
            return true
        }
        if (Date.parse(sesion.finBloque) <= instante) {
            procesarVencimientos(instante)
            sesion = estadoRef.current
            if (!sesion || sesion.estado !== "En curso") return false
        }
        if (!registroRef.current.pausar(sesion.registroId, new Date(instante))) {
            cambiarError(registroRef.current.obtenerError?.() || registroRef.current.error || "No se pudo pausar el registro actual.")
            return false
        }
        const pausada = {
            ...sesion,
            estado: "Pausado",
            restanteMs: Math.max(0, Date.parse(sesion.finBloque) - instante),
            finBloque: null
        }
        if (!guardar(pausada)) {
            registroRef.current.continuar(sesion.registroId, new Date())
            return false
        }
        publicar(pausada)
        cambiarAhora(instante)
        return true
    }

    function reanudar() {
        const sesion = estadoRef.current
        if (!sesion || sesion.estado !== "Pausado") return false
        const instante = Date.now()
        if (sesion.tipoSeguimiento === "cronometro") {
            const reanudados = []
            for (const activo of sesion.registrosActivos ?? []) {
                if (!registroRef.current.continuar(activo.registroId, new Date(instante))) {
                    reanudados.forEach(id => registroRef.current.pausar(id, new Date(instante)))
                    return false
                }
                reanudados.push(activo.registroId)
            }
            const reanudada = { ...sesion, estado: "En curso", finBloque: null,
                registrosActivos: sesion.registrosActivos.map(activo => ({ ...activo, inicioReal: new Date(instante).toISOString() })) }
            delete reanudada.pausaInicio
            if (!guardar(reanudada)) { reanudados.forEach(id => registroRef.current.pausar(id, new Date(instante))); return false }
            publicar(reanudada)
            cambiarAhora(instante)
            return true
        }
        if (usaAvancePorEtapas(sesion)) {
            const reanudados = []
            for (const activo of sesion.registrosActivos ?? []) {
                if (!registroRef.current.continuar(activo.registroId, new Date(instante))) {
                    reanudados.forEach(id => registroRef.current.pausar(id, new Date(instante)))
                    return false
                }
                reanudados.push(activo.registroId)
            }
            const delta = instante - Date.parse(sesion.pausaInicio)
            const reanudada = {
                ...sesion,
                estado: "En curso",
                inicioSeguimiento: new Date(Date.parse(sesion.inicioSeguimiento) + delta).toISOString(),
                registrosActivos: sesion.registrosActivos.map(item => {
                    const reanudado = { ...item, finBloque: new Date(Date.parse(item.finBloque) + delta).toISOString() }
                    delete reanudado.restanteMs
                    return reanudado
                }),
                finBloque: new Date(instante + (sesion.registrosActivos[0]?.finBloque ? Date.parse(sesion.registrosActivos[0].finBloque) - Date.parse(sesion.pausaInicio) : 60000)).toISOString()
            }
            delete reanudada.pausaInicio
            delete reanudada.restanteMs
            if (!guardar(reanudada)) {
                reanudados.forEach(id => registroRef.current.pausar(id, new Date(instante)))
                return false
            }
            publicar(reanudada)
            cambiarAhora(instante)
            return true
        }
        if (!registroRef.current.continuar(sesion.registroId, new Date(instante))) {
            cambiarError(registroRef.current.obtenerError?.() || registroRef.current.error || "No se pudo reanudar el registro actual.")
            return false
        }
        const reanudada = {
            ...sesion,
            estado: "En curso",
            finBloque: new Date(instante + sesion.restanteMs).toISOString()
        }
        delete reanudada.restanteMs
        if (!guardar(reanudada)) {
            registroRef.current.pausar(sesion.registroId, new Date())
            return false
        }
        publicar(reanudada)
        cambiarAhora(instante)
        return true
    }

    function avanzarHasta(indiceDestino, instante, eventosOmitidos = []) {
        const sesion = estadoRef.current
        if (!sesion) return false
        if (indiceDestino < sesion.secuencia.length) {
            const habilitacion = registroRef.current.puedeIniciarActividad?.(new Date(instante))
            if (habilitacion && !habilitacion.ok) {
                cambiarError(habilitacion.error)
                return false
            }
        }
        const cierre = cerrarRegistroActual(sesion, instante)
        if (!cierre.ok) {
            cambiarError(cierre.error)
            return false
        }
        if (indiceDestino >= sesion.secuencia.length) {
            if (!guardar(null)) return false
            publicar(null)
            cambiarMensaje(eventosOmitidos.length > 0
                ? `Se omitió ${eventosOmitidos.map(item => `“${item.nombre}”`).join(", ")}. No quedan eventos en la secuencia.`
                : "Terminó la secuencia de planificación.")
            cambiarAhora(instante)
            return true
        }
        const registroId = iniciarRegistroDePlan(sesion.secuencia, indiceDestino, instante)
        if (!registroId) {
            guardar(null)
            publicar(null)
            cambiarError(registroRef.current.obtenerError?.() || registroRef.current.error || "No se pudo iniciar el siguiente evento planificado.")
            return false
        }
        const siguiente = {
            ...sesion,
            estado: "En curso",
            indiceActual: indiceDestino,
            eventosOmitidos: [...(sesion.eventosOmitidos ?? []), ...eventosOmitidos.map(item => item.planId)],
            registroId,
            inicio: new Date(instante).toISOString(),
            finBloque: new Date(instante + sesion.secuencia[indiceDestino].duracionMs).toISOString()
        }
        if (!guardar(siguiente)) {
            cerrarRegistroActual(siguiente, instante)
            publicar(null)
            return false
        }
        publicar(siguiente)
        cambiarMensaje(eventosOmitidos.length > 0
            ? `Se omitió ${eventosOmitidos.map(item => `“${item.nombre}”`).join(", ")} sin crear registros. Ahora sigue “${sesion.secuencia[indiceDestino].nombre}”.`
            : `Ahora sigue “${sesion.secuencia[indiceDestino].nombre}”.`)
        cambiarAhora(instante)
        return true
    }

    function finalizarYContinuar() {
        const sesion = estadoRef.current
        if (!sesion) return false
        if (usaAvancePorEtapas(sesion)) {
            const activo = sesion.registrosActivos?.[0]
            if (!activo) return false
            return finalizarEvento(activo.planId)
        }
        cambiarMensaje("")
        return avanzarHasta(sesion.indiceActual + 1, Date.now())
    }

    function finalizarEvento(planId, { diferirAplicacion = false } = {}) {
        const sesion = estadoRef.current
        const activo = sesion?.registrosActivos?.find(item => item.planId === planId)
        if (!sesion || !activo) return false
        const instante = Date.now()
        const cierre = cerrarRegistroActual({ registroId: activo.registroId }, instante)
        if (!cierre.ok) { cambiarError(cierre.error); return false }
        const actualizada = {
            ...sesion,
            registrosActivos: sesion.registrosActivos.filter(item => item.planId !== planId),
            finalizados: [...(sesion.finalizados ?? []), planId],
            finBloque: sesion.finBloque
        }
        if (sesion.tipoSeguimiento === "cronometro") {
            if (completarSesionCronometro(sesion, actualizada.registrosActivos, actualizada.finalizados)) {
                cambiarAhora(instante)
                return true
            }
            if (!guardar(actualizada)) return false
            publicar(actualizada)
            cambiarMensaje(`Se finalizó “${sesion.secuencia.find(item => item.planId === planId)?.nombre}”.`)
            cambiarAhora(instante)
            return true
        }
        if (!guardar(actualizada)) return false
        publicar(actualizada)
        if (!diferirAplicacion && usaAvancePorEtapas(actualizada)) procesarSecuenciaPorEtapas(instante, actualizada)
        cambiarMensaje(`Se finalizó “${sesion.secuencia.find(item => item.planId === planId)?.nombre}”.`)
        return true
    }

    function siguienteEventoAlFinalizar(planId) {
        const sesion = estadoRef.current
        if (usaAvancePorEtapas(sesion) && sesion.tipoSeguimiento !== "cronometro") {
            if (!(sesion.registrosActivos ?? []).some(item => item.planId === planId)
                || sesion.transicionPendiente) return null
            return obtenerSiguienteEtapa(sesion)?.pendientes[0] ?? null
        }
        if (sesion?.tipoSeguimiento !== "cronometro" || sesion.estado !== "En curso"
            || !(sesion.registrosActivos ?? []).some(item => item.planId === planId)) return null
        const activos = new Set((sesion.registrosActivos ?? [])
            .filter(item => item.planId !== planId)
            .map(item => item.planId))
        const iniciados = new Set(sesion.iniciados ?? [])
        const finalizados = new Set([...(sesion.finalizados ?? []), planId])
        const omitidos = new Set(sesion.eventosOmitidos ?? [])
        const sesionTrasFinalizar = {
            ...sesion,
            registrosActivos: (sesion.registrosActivos ?? []).filter(item => item.planId !== planId),
            iniciados: [...iniciados],
            finalizados: [...finalizados]
        }
        return sesion.secuencia.find(item => !activos.has(item.planId)
            && !iniciados.has(item.planId)
            && !finalizados.has(item.planId)
            && !omitidos.has(item.planId)
            && puedeIniciarGrupo(sesionTrasFinalizar, item.grupo ?? 0)) ?? null
    }

    function iniciarEtapaAhora(sesion, etapa, instante, nombreActual = null) {
        const habilitacion = registroRef.current.puedeIniciarActividad?.(new Date(instante))
        if (habilitacion && !habilitacion.ok) {
            cambiarError(habilitacion.error)
            return false
        }
        const inicioSeguimiento = Date.parse(sesion.inicioSeguimiento)
        const primerOffsetEtapa = Math.min(...etapa.pendientes.map(item => item.inicioOffsetMs ?? 0))
        const desplazamiento = instante - inicioSeguimiento - primerOffsetEtapa
        const idsEtapa = sesion.secuencia
            .filter(item => (item.grupo ?? 0) === etapa.grupo)
            .map(item => item.planId)
        const siguiente = etapa.pendientes[0]
        const transicion = {
            ...sesion,
            secuencia: sesion.secuencia.map(item => (item.grupo ?? 0) >= etapa.grupo
                && !(sesion.iniciados ?? []).includes(item.planId)
                ? { ...item, inicioOffsetMs: (item.inicioOffsetMs ?? 0) + desplazamiento }
                : item),
            etapasDesbloqueadas: [...new Set([...(sesion.etapasDesbloqueadas ?? []), ...idsEtapa])],
            transicionPendiente: { planIds: [siguiente.planId] }
        }
        if (!guardar(transicion)) return false
        publicar(transicion)
        procesarSecuenciaPorEtapas(instante, transicion, true)
        if (estadoRef.current?.transicionPendiente) {
            cambiarError(errorActual => {
                const mensajeTransicion = `${nombreActual ? `Se finalizó “${nombreActual}”, pero ` : ""}no se pudo iniciar “${siguiente.nombre}”. Podés reintentar el inicio.`
                return errorActual ? `${mensajeTransicion} ${errorActual}` : mensajeTransicion
            })
            return false
        }
        cambiarMensaje(nombreActual
            ? `Se finalizó “${nombreActual}” y comenzó “${siguiente.nombre}”.`
            : `Comenzó “${siguiente.nombre}”. Se ajustaron los horarios de las etapas pendientes.`)
        return true
    }

    function iniciarSiguienteEtapaAhora() {
        const sesion = estadoRef.current
        if (!usaAvancePorEtapas(sesion) || sesion.tipoSeguimiento === "cronometro"
            || sesion.estado !== "En curso" || (sesion.registrosActivos ?? []).length > 0
            || sesion.transicionPendiente) return false
        const etapa = obtenerSiguienteEtapa(sesion)
        if (!etapa) return false
        return iniciarEtapaAhora(sesion, etapa, Date.now())
    }

    function finalizarYComenzarSiguiente(planId) {
        const sesion = estadoRef.current
        if (usaAvancePorEtapas(sesion) && sesion.tipoSeguimiento !== "cronometro") {
            const etapa = obtenerSiguienteEtapa(sesion)
            if (!etapa || !(sesion.registrosActivos ?? []).some(item => item.planId === planId)) return false
            const instante = Date.now()
            const nombreActual = sesion.secuencia.find(item => item.planId === planId)?.nombre ?? "la actividad actual"
            const habilitacion = registroRef.current.puedeIniciarActividad?.(new Date(instante))
            if (habilitacion && !habilitacion.ok) {
                cambiarError(habilitacion.error)
                return false
            }
            if (!finalizarEvento(planId, { diferirAplicacion: true })) return false
            return iniciarEtapaAhora(estadoRef.current, etapa, instante, nombreActual)
        }
        const siguiente = siguienteEventoAlFinalizar(planId)
        if (!sesion || !siguiente) return false
        const nombreActual = sesion.secuencia.find(item => item.planId === planId)?.nombre ?? "el evento actual"
        const habilitacion = registroRef.current.puedeIniciarActividad?.(new Date())
        if (habilitacion && !habilitacion.ok) {
            cambiarError(habilitacion.error)
            return false
        }
        if (!finalizarEvento(planId)) return false
        if (!iniciarEventoSecuencial(siguiente.planId)) {
            cambiarError(`Se finalizó “${nombreActual}”, pero no se pudo iniciar “${siguiente.nombre}”.`)
            return false
        }
        cambiarMensaje(`Se finalizó “${nombreActual}” y comenzó “${siguiente.nombre}”.`)
        return true
    }

    function reintentarTransicion() {
        const sesion = estadoRef.current
        if (!usaAvancePorEtapas(sesion) || !sesion.transicionPendiente || sesion.estado !== "En curso") return false
        procesarSecuenciaPorEtapas(Date.now(), sesion, true)
        return !estadoRef.current?.transicionPendiente
    }

    function cambiarModoAvance(modo) {
        const sesion = estadoRef.current
        if (!sesion || !["automatico", "manual"].includes(modo)) return false
        const actualizada = { ...sesion, modoAvance: modo }
        if (!guardar(actualizada)) return false
        publicar(actualizada)
        if (modo === "automatico") {
            if (usaAvancePorEtapas(actualizada)) procesarSecuenciaPorEtapas(Date.now(), actualizada)
            else procesarVencimientos(Date.now())
        }
        return true
    }

    function omitirEvento(planId) {
        const sesion = estadoRef.current
        if (!usaAvancePorEtapas(sesion)
            || !sesion.secuencia.some(item => item.planId === planId)
            || (sesion.registrosActivos ?? []).some(item => item.planId === planId)
            || (sesion.eventosOmitidos ?? []).includes(planId)) return false
        const omitido = sesion.secuencia.find(item => item.planId === planId)
        if (sesion.tipoSeguimiento === "cronometro") {
            const eventosOmitidos = [...(sesion.eventosOmitidos ?? []), planId]
            if (completarSesionCronometro(sesion, sesion.registrosActivos ?? [], sesion.finalizados ?? [], eventosOmitidos)) return true
            const actualizada = { ...sesion, eventosOmitidos }
            if (!guardar(actualizada)) return false
            publicar(actualizada)
            cambiarMensaje(`Se omitió “${omitido.nombre}” en este seguimiento. El plan sigue en el calendario.`)
            return true
        }
        const grupo = sesion.secuencia.filter(item => item.grupo === omitido.grupo)
        const inicioGrupo = Math.min(...grupo.map(item => item.inicioOffsetMs))
        const finAntes = Math.max(...grupo.map(item => item.inicioOffsetMs + item.duracionMs))
        const finDespues = Math.max(inicioGrupo, ...grupo
            .filter(item => item.planId !== planId && !(sesion.eventosOmitidos ?? []).includes(item.planId))
            .map(item => item.inicioOffsetMs + item.duracionMs))
        const delta = Math.max(0, finAntes - finDespues)
        const actualizada = {
            ...sesion,
            eventosOmitidos: [...(sesion.eventosOmitidos ?? []), planId],
            secuencia: sesion.secuencia.map(item => item.grupo > omitido.grupo
                ? { ...item, inicioOffsetMs: Math.max(0, item.inicioOffsetMs - delta) }
                : item)
        }
        if (!guardar(actualizada)) return false
        publicar(actualizada)
        procesarSecuenciaPorEtapas(Date.now(), actualizada)
        cambiarMensaje("Se omitió “" + omitido.nombre + "” en este seguimiento. El plan sigue en el calendario.")
        return true
    }

    function finalizarYOmitirSiguiente() {
        const sesion = estadoRef.current
        if (!sesion || sesion.indiceActual + 1 >= sesion.secuencia.length) return false
        const indiceOmitido = sesion.indiceActual + 1
        const elementoOmitido = sesion.secuencia[indiceOmitido]
        cambiarMensaje("")
        return avanzarHasta(indiceOmitido + 1, Date.now(), [elementoOmitido])
    }

    function puedeIniciarGrupo(sesion, grupo) {
        const previos = [...new Set(sesion.secuencia.map(item => item.grupo ?? 0))].filter(valor => valor < grupo)
        const resueltos = new Set([...(sesion.iniciados ?? []), ...(sesion.finalizados ?? []), ...(sesion.eventosOmitidos ?? [])])
        return previos.every(grupoPrevio => sesion.secuencia.some(item => item.grupo === grupoPrevio && resueltos.has(item.planId)))
    }

    function registrarNuevosEventos(sesion, ids) {
        const instante = Date.now()
        const resultado = iniciarEventosCronometro(sesion, ids, instante)
        if (!resultado.ok) {
            cambiarError(resultado.error)
            return false
        }
        if (resultado.activos.length === (sesion.registrosActivos ?? []).length) return false
        const actualizada = {
            ...sesion, estado: "En curso", registrosActivos: resultado.activos,
            iniciados: resultado.iniciados,
            indiceActual: sesion.secuencia.findIndex(item => ids.includes(item.planId)),
            registroId: resultado.activos[0]?.registroId ?? sesion.registroId,
            inicio: new Date(instante).toISOString(), finBloque: null
        }
        if (!guardar(actualizada)) {
            resultado.activos.filter(activo => !(sesion.registrosActivos ?? []).some(anterior => anterior.registroId === activo.registroId))
                .forEach(activo => cerrarRegistroActual({ registroId: activo.registroId }, instante))
            return false
        }
        publicar(actualizada)
        cambiarMensaje("")
        cambiarAhora(instante)
        return true
    }

    function iniciarEventoSecuencial(planId) {
        const sesion = estadoRef.current
        if (!sesion || sesion.tipoSeguimiento !== "cronometro") return false
        const item = sesion.secuencia.find(elemento => elemento.planId === planId)
        if (!item || !puedeIniciarGrupo(sesion, item.grupo ?? 0)) return false
        return registrarNuevosEventos(sesion, [planId])
    }

    function puedeIniciarEventoSecuencial(planId) {
        const sesion = estadoRef.current
        const item = sesion?.secuencia.find(elemento => elemento.planId === planId)
        return Boolean(sesion?.tipoSeguimiento === "cronometro" && item && sesion.estado === "En curso"
            && !(sesion.iniciados ?? []).includes(planId) && !(sesion.eventosOmitidos ?? []).includes(planId)
            && puedeIniciarGrupo(sesion, item.grupo ?? 0))
    }

    function iniciarGrupoSecuencial(grupo) {
        const sesion = estadoRef.current
        if (!sesion || sesion.tipoSeguimiento !== "cronometro" || !puedeIniciarGrupo(sesion, grupo)) return false
        const ids = sesion.secuencia.filter(item => item.grupo === grupo).map(item => item.planId)
        return registrarNuevosEventos(sesion, ids)
    }

    function sincronizarPlanes(planes, eventos, tareasDisponibles = tareasRef.current) {
        const sesion = estadoRef.current
        if (!sesion) return { ok: true }
        const planActualId = sesion.secuencia[sesion.indiceActual]?.planId
        const actualizacion = crearSecuenciaSeguimiento(planes, planActualId, eventos, tareasDisponibles)
        if (!actualizacion.ok) return actualizacion

        if (sesion.tipoSeguimiento === "cronometro") {
            const activos = new Set((sesion.registrosActivos ?? []).map(item => item.planId))
            const resueltos = new Set([...(sesion.finalizados ?? []), ...(sesion.eventosOmitidos ?? [])])
            const secuencia = actualizacion.secuencia.map(item => {
                const anterior = sesion.secuencia.find(elemento => elemento.planId === item.planId)
                return activos.has(item.planId) || resueltos.has(item.planId) ? anterior ?? item : item
            })
            const indiceActivo = secuencia.findIndex(item => activos.has(item.planId))
            const sincronizada = { ...sesion, secuencia, indiceActual: Math.max(0, indiceActivo >= 0 ? indiceActivo : secuencia.findIndex(item => !resueltos.has(item.planId))) }
            if (!guardar(sincronizada)) return { ok: false, error: "No se pudo guardar la secuencia actualizada." }
            publicar(sincronizada)
            return { ok: true }
        }

        if (usaAvancePorEtapas(sesion)) {
            const grupoBase = sesion.secuencia[sesion.indiceActual]?.grupo ?? 0
            const offsetBase = Math.min(...sesion.secuencia
                .filter(item => item.grupo === grupoBase)
                .map(item => item.inicioOffsetMs ?? 0))
            const activos = new Set((sesion.registrosActivos ?? []).map(item => item.planId))
            const finalizados = new Set(sesion.finalizados ?? [])
            const conservados = sesion.secuencia.filter(item => item.grupo < grupoBase)
            const actualizados = actualizacion.secuencia.map(item => {
                const anterior = sesion.secuencia.find(elemento => elemento.planId === item.planId)
                if (activos.has(item.planId) || finalizados.has(item.planId)) return anterior ?? item
                return { ...item, grupo: item.grupo + grupoBase, inicioOffsetMs: item.inicioOffsetMs + offsetBase }
            })
            let secuencia = [...conservados, ...actualizados]
            const idsDesbloqueados = new Set(sesion.etapasDesbloqueadas ?? [])
            const itemsDesbloqueadosAnteriores = sesion.secuencia.filter(item => idsDesbloqueados.has(item.planId))
            const itemsDesbloqueadosActuales = secuencia.filter(item => idsDesbloqueados.has(item.planId))
            if (itemsDesbloqueadosAnteriores.length && itemsDesbloqueadosActuales.length) {
                const grupoAnterior = Math.min(...itemsDesbloqueadosAnteriores.map(item => item.grupo ?? 0))
                const grupoActual = Math.min(...itemsDesbloqueadosActuales.map(item => item.grupo ?? 0))
                const offsetAnterior = Math.min(...itemsDesbloqueadosAnteriores
                    .filter(item => (item.grupo ?? 0) === grupoAnterior)
                    .map(item => item.inicioOffsetMs ?? 0))
                const offsetActual = Math.min(...itemsDesbloqueadosActuales
                    .filter(item => (item.grupo ?? 0) === grupoActual)
                    .map(item => item.inicioOffsetMs ?? 0))
                const delta = offsetAnterior - offsetActual
                secuencia = secuencia.map(item => (item.grupo ?? 0) >= grupoActual
                    && !activos.has(item.planId) && !finalizados.has(item.planId)
                    ? { ...item, inicioOffsetMs: (item.inicioOffsetMs ?? 0) + delta }
                    : item)
            }
            const indiceActivo = secuencia.findIndex(item => activos.has(item.planId))
            const indicePendiente = secuencia.findIndex(item => !finalizados.has(item.planId)
                && !activos.has(item.planId) && !(sesion.eventosOmitidos ?? []).includes(item.planId))
            const idsVigentes = new Set(secuencia.map(item => item.planId))
            const etapasDesbloqueadas = (sesion.etapasDesbloqueadas ?? []).filter(id => idsVigentes.has(id))
            const idsTransicion = (sesion.transicionPendiente?.planIds ?? []).filter(id => idsVigentes.has(id))
            const sincronizada = {
                ...sesion,
                secuencia,
                etapasDesbloqueadas,
                transicionPendiente: idsTransicion.length ? { planIds: idsTransicion } : null,
                indiceActual: indiceActivo >= 0 ? indiceActivo : Math.max(0, indicePendiente)
            }
            if (!guardar(sincronizada)) return { ok: false, error: "No se pudo guardar la cola actualizada." }
            publicar(sincronizada)
            return { ok: true }
        }

        const secuencia = [
            ...sesion.secuencia.slice(0, sesion.indiceActual),
            sesion.secuencia[sesion.indiceActual],
            ...actualizacion.secuencia.slice(1)
        ]
        const sincronizada = { ...sesion, secuencia }
        if (!guardar(sincronizada)) return { ok: false, error: "No se pudo guardar la cola actualizada." }
        publicar(sincronizada)
        return { ok: true }
    }

    function dejarDeSeguir() {
        const sesion = estadoRef.current
        if (!sesion) return false
        const instante = Date.now()
        if (usaAvancePorEtapas(sesion)) {
            for (const activo of sesion.registrosActivos ?? []) {
                const cierre = cerrarRegistroActual({ registroId: activo.registroId }, instante)
                if (!cierre.ok) { cambiarError(cierre.error); return false }
            }
            if (!guardar(null)) return false
            publicar(null)
            cambiarAhora(instante)
            return true
        }
        const cierre = cerrarRegistroActual(sesion, instante)
        if (!cierre.ok) {
            cambiarError(cierre.error)
            return false
        }
        if (!guardar(null)) return false
        publicar(null)
        cambiarAhora(instante)
        return true
    }

    const elementoActual = estado?.secuencia[estado.indiceActual] ?? null
    const idsActivos = new Set((estado?.registrosActivos ?? []).map(item => item.planId))
    const idsCerrados = new Set([...(estado?.finalizados ?? []), ...(estado?.eventosOmitidos ?? [])])
    const siguientesDisponibles = usaAvancePorEtapas(estado)
        ? estado.secuencia.filter((item, indice) => indice !== estado.indiceActual
            && !idsActivos.has(item.planId) && !idsCerrados.has(item.planId))
        : estado?.secuencia.slice((estado?.indiceActual ?? -1) + 1) ?? []
    const elementoSiguiente = siguientesDisponibles[0] ?? null
    const elementoPosterior = siguientesDisponibles[1] ?? null
    const siguienteEtapaPendiente = estado && usaAvancePorEtapas(estado)
        && estado.tipoSeguimiento !== "cronometro"
        ? obtenerSiguienteEtapa(estado)?.pendientes[0] ?? null
        : null
    const segundosRestantes = usaAvancePorEtapas(estado) && estado.registrosActivos?.length
        ? Math.ceil((estado.estado === "Pausado"
            ? estado.registrosActivos[0].restanteMs
            : Date.parse(estado.registrosActivos[0].finBloque) - ahora) / 1000)
        : estado?.estado === "Pausado"
        ? Math.ceil(estado.restanteMs / 1000)
        : estado?.finBloque ? Math.max(0, Math.ceil((Date.parse(estado.finBloque) - ahora) / 1000)) : 0

    return {
        estado, error, mensaje, elementoActual, elementoSiguiente, elementoPosterior,
        segundosRestantes, empezar, pausar, reanudar, finalizarYContinuar,
        finalizarYOmitirSiguiente, dejarDeSeguir, sincronizarPlanes, finalizarEvento, cambiarModoAvance, omitirEvento,
        siguienteEventoAlFinalizar, finalizarYComenzarSiguiente, iniciarSiguienteEtapaAhora,
        siguienteEtapaPendiente,
        reintentarTransicion,
        iniciarEvento: iniciarEventoSecuencial,
        iniciarGrupo: iniciarGrupoSecuencial,
        puedeIniciarEvento: puedeIniciarEventoSecuencial,
        ahora
    }
}

function obtenerPrimerPlanDelDia(planes, idPlan) {
    const seleccionado = planes.find(plan => plan.id === idPlan)
    if (!seleccionado) return idPlan
    const esCronometro = seleccionado.modoSeguimientoPlanificacion === "cronometro"
    return planes
        .filter(plan => (!seleccionado.idAplicacionPlantilla
            || plan.idAplicacionPlantilla === seleccionado.idAplicacionPlantilla)
            && (seleccionado.idAplicacionPlantilla
                || plan.inicio.getFullYear() === seleccionado.inicio.getFullYear()
                    && plan.inicio.getMonth() === seleccionado.inicio.getMonth()
                    && plan.inicio.getDate() === seleccionado.inicio.getDate())
            && (esCronometro
                ? plan.modoSeguimientoPlanificacion === "cronometro"
                : plan.tipoPlanificacion !== "focus" && plan.modoSeguimientoPlanificacion !== "cronometro"))
        .sort(compararPlanesPorSeguimiento)[0]?.id ?? idPlan
}
