import { useEffect, useRef, useState } from "react"

import { calcularTiempoEfectivo } from "../../domain/tiempo/CalculosDuracion.js"
import {
    cargarSeguimientoPlanificacion,
    guardarSeguimientoPlanificacion
} from "../../domain/planificacion/persistenciaSeguimientoPlanificacion.js"
import { crearSecuenciaSeguimiento } from "../../domain/planificacion/seguimientoPlanificacion.js"

function crearId() {
    try { return globalThis.crypto.randomUUID() } catch { return null }
}

export function useSeguimientoPlanificacion(estadoRegistro) {
    const [cargaInicial] = useState(cargarSeguimientoPlanificacion)
    const [estado, cambiarEstado] = useState(() => cargaInicial.estado)
    const [error, cambiarError] = useState(() => cargaInicial.error ?? "")
    const [ahora, cambiarAhora] = useState(() => Date.now())
    const estadoRef = useRef(estado)
    const registroRef = useRef(estadoRegistro)
    const procesarRef = useRef(() => {})

    useEffect(() => { registroRef.current = estadoRegistro }, [estadoRegistro])

    const idSeguimiento = estado?.id
    const registroIdActual = estado?.registroId
    const estadoSeguimiento = estado?.estado
    const planIdActual = estado?.secuencia[estado.indiceActual]?.planId

    useEffect(() => {
        if (!idSeguimiento || !estadoRegistro.datos.ok) return undefined
        const temporizador = setTimeout(() => {
            const registro = registroRef.current.buscar(registroIdActual)
            const estadoEsperado = estadoSeguimiento === "Pausado" ? "Pausado" : "En curso"
            if (registro?.planId === planIdActual && registro.estado === estadoEsperado) return

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
        return registroRef.current.iniciarConId(
            elemento.nombre,
            elemento.evento,
            new Date(instante),
            null,
            { planId: elemento.planId }
        )
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
                cambiarAhora(instanteActual)
                return
            }

            const registroId = iniciarRegistroDePlan(sesion.secuencia, siguienteIndice, finEvento)
            if (!registroId) {
                guardar(null)
                publicar(null)
                cambiarError(registroRef.current.error || "No se pudo iniciar el siguiente evento planificado.")
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
        }

        cambiarAhora(instanteActual)
    }

    useEffect(() => { procesarRef.current = procesarVencimientos })

    useEffect(() => {
        if (estado?.estado !== "En curso") return undefined
        const intervalo = setInterval(() => procesarRef.current(Date.now()), 250)
        return () => clearInterval(intervalo)
    }, [estado?.estado, estado?.finBloque])

    function empezar(planId, modo, planes, eventos) {
        if (estadoRef.current) return { ok: false, error: "Ya hay un seguimiento de planificación activo." }
        const resultado = crearSecuenciaSeguimiento(planes, modo === "primero"
            ? obtenerPrimerPlanDelDia(planes, planId)
            : planId, eventos)
        if (!resultado.ok) return resultado

        const id = crearId()
        if (!id) return { ok: false, error: "No se pudo crear la identidad del seguimiento." }
        const instante = Date.now()
        const registroId = iniciarRegistroDePlan(resultado.secuencia, 0, instante)
        if (!registroId) {
            return { ok: false, error: registroRef.current.error || "No se pudo iniciar el registro del plan." }
        }

        const sesion = {
            id,
            estado: "En curso",
            secuencia: resultado.secuencia,
            indiceActual: 0,
            registroId,
            inicio: new Date(instante).toISOString(),
            finBloque: new Date(instante + resultado.secuencia[0].duracionMs).toISOString()
        }
        if (!guardar(sesion)) {
            cerrarRegistroActual(sesion, Date.now())
            return { ok: false, error: "No se pudo guardar el seguimiento. El registro iniciado se cerró." }
        }
        publicar(sesion)
        cambiarAhora(instante)
        return { ok: true }
    }

    function pausar() {
        let sesion = estadoRef.current
        if (!sesion || sesion.estado !== "En curso") return false
        const instante = Date.now()
        if (Date.parse(sesion.finBloque) <= instante) {
            procesarVencimientos(instante)
            sesion = estadoRef.current
            if (!sesion || sesion.estado !== "En curso") return false
        }
        if (!registroRef.current.pausar(sesion.registroId, new Date(instante))) {
            cambiarError(registroRef.current.error || "No se pudo pausar el registro actual.")
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
        if (!registroRef.current.continuar(sesion.registroId, new Date(instante))) {
            cambiarError(registroRef.current.error || "No se pudo reanudar el registro actual.")
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

    function saltar() {
        const sesion = estadoRef.current
        if (!sesion) return false
        const instante = Date.now()
        const cierre = cerrarRegistroActual(sesion, instante)
        if (!cierre.ok) {
            cambiarError(cierre.error)
            return false
        }
        const siguienteIndice = sesion.indiceActual + 1
        if (siguienteIndice >= sesion.secuencia.length) {
            guardar(null)
            publicar(null)
            cambiarAhora(instante)
            return true
        }
        const registroId = iniciarRegistroDePlan(sesion.secuencia, siguienteIndice, instante)
        if (!registroId) {
            guardar(null)
            publicar(null)
            cambiarError(registroRef.current.error || "No se pudo iniciar el siguiente evento planificado.")
            return false
        }
        const siguiente = {
            ...sesion,
            estado: "En curso",
            indiceActual: siguienteIndice,
            registroId,
            inicio: new Date(instante).toISOString(),
            finBloque: new Date(instante + sesion.secuencia[siguienteIndice].duracionMs).toISOString()
        }
        if (!guardar(siguiente)) {
            cerrarRegistroActual(siguiente, instante)
            publicar(null)
            return false
        }
        publicar(siguiente)
        cambiarAhora(instante)
        return true
    }

    function dejarDeSeguir() {
        const sesion = estadoRef.current
        if (!sesion) return false
        const instante = Date.now()
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
    const segundosRestantes = estado?.estado === "Pausado"
        ? Math.ceil(estado.restanteMs / 1000)
        : estado?.finBloque ? Math.max(0, Math.ceil((Date.parse(estado.finBloque) - ahora) / 1000)) : 0

    return { estado, error, elementoActual, segundosRestantes, empezar, pausar, reanudar, saltar, dejarDeSeguir }
}

function obtenerPrimerPlanDelDia(planes, idPlan) {
    const seleccionado = planes.find(plan => plan.id === idPlan)
    if (!seleccionado) return idPlan
    return planes
        .filter(plan => plan.inicio.getFullYear() === seleccionado.inicio.getFullYear()
            && plan.inicio.getMonth() === seleccionado.inicio.getMonth()
            && plan.inicio.getDate() === seleccionado.inicio.getDate())
        .sort((a, b) => a.inicio.getTime() - b.inicio.getTime()
            || a.fin.getTime() - b.fin.getTime()
            || a.id.localeCompare(b.id))[0]?.id ?? idPlan
}
