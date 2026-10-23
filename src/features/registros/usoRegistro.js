import { useCallback, useEffect, useRef, useState } from "react"

import {
    aplicarLimitesVencidos,
    continuarRegistro,
    crearRegistroManual,
    descartarRegistroPlanSinDuracion,
    editarRegistroFinalizado,
    eliminarRegistroFinalizado,
    ESTADO_REGISTRO_EN_CURSO,
    ESTADO_REGISTRO_PAUSADO,
    finalizarRegistro,
    obtenerConflictoConcentracion,
    iniciarRegistro,
    pausarRegistro
} from "../../domain/registros/registros.js"
import { cargarRegistros, guardarRegistros } from "../../domain/registros/persistenciaRegistros.js"
import { cargarSesionActivaFocus } from "../../domain/focus/persistenciaFocus.js"

export function useRegistro() {
    const [datos, cambiarDatos] = useState(() => {
        const carga = cargarRegistros()
        return { ...carga, mensaje: carga.mensaje ?? "", advertencia: carga.advertencia ?? "" }
    })
    const [ahora, cambiarAhora] = useState(() => new Date())
    const [error, cambiarError] = useState("")
    const [mensaje, cambiarMensaje] = useState(datos.mensaje)
    const datosRef = useRef(datos)
    const limiteFallidoRef = useRef(null)
    const ultimoErrorRef = useRef("")

    function sesionFocusEnConcentracion() {
        const resultado = cargarSesionActivaFocus()
        return resultado.ok && resultado.sesion?.estado === "concentracion"
            ? resultado.sesion.configuracion.nombre
            : null
    }

    const guardarTransicion = useCallback((resultado, { mostrarError = true } = {}) => {
        if (!resultado.ok) {
            if (mostrarError) {
                ultimoErrorRef.current = resultado.error
                cambiarError(resultado.error)
            }
            return { ok: false, error: resultado.error }
        }

        const guardado = guardarRegistros(resultado.registros)

        if (!guardado.ok) {
            if (mostrarError) {
                ultimoErrorRef.current = guardado.error
                cambiarError(guardado.error)
            }
            return guardado
        }

        limiteFallidoRef.current = null
        const nuevosDatos = {
            ok: true,
            registros: resultado.registros,
            mensaje: "",
            advertencia: ""
        }
        datosRef.current = nuevosDatos
        cambiarDatos(nuevosDatos)
        cambiarError("")
        ultimoErrorRef.current = ""
        cambiarMensaje(resultado.mensaje ?? "")
        return { ok: true }
    }, [])

    const registros = datos.ok ? datos.registros : []
    const registrosActivos = registros.filter(registro => (
        [ESTADO_REGISTRO_EN_CURSO, ESTADO_REGISTRO_PAUSADO].includes(registro.estado)
    ))

    useEffect(() => {
        if (registrosActivos.length === 0) {
            return undefined
        }

        const intervalo = setInterval(() => {
            const instante = new Date()

            if (limiteFallidoRef.current) {
                return
            }

            const datosActuales = datosRef.current

            if (!datosActuales.ok) {
                return
            }

            const resultado = aplicarLimitesVencidos(datosActuales.registros, instante)

            if (resultado.ok && resultado.cambioPorLimite && !guardarTransicion(resultado).ok) {
                limiteFallidoRef.current = "fallo"
            }
        }, 1000)

        return () => clearInterval(intervalo)
    }, [registrosActivos.length, guardarTransicion])

    function iniciarConId(nombre, evento = null, instante = new Date(), tarea = null, opciones = {}) {
        const datosActuales = datosRef.current
        if (!datosActuales.ok) {
            cambiarError(datosActuales.error)
            return null
        }

        const conflicto = obtenerConflictoConcentracion(datosActuales.registros, instante)
        const sesionFocus = sesionFocusEnConcentracion()
        if ((opciones.origenFocus && conflicto)
            || (!opciones.origenFocus && (conflicto?.tipo === "focus" || sesionFocus))) {
            const errorInicio = opciones.origenFocus
                ? conflicto?.tipo === "actividad"
                    ? `Focus esperará a que finalices o pauses “${conflicto.registro.nombre}” antes de empezar la concentración.`
                    : `Ya hay una concentración Focus en curso (${conflicto.registro.nombre}).`
                : `No se puede iniciar otra actividad mientras Focus está en concentración (${conflicto?.registro.nombre ?? sesionFocus}).`
            ultimoErrorRef.current = errorInicio
            cambiarError(errorInicio)
            return null
        }

        cambiarAhora(instante)
        const resultado = iniciarRegistro(
            datosActuales.registros,
            nombre,
            instante,
            undefined,
            evento,
            tarea,
            opciones.planId ?? null,
            opciones
        )
        return guardarTransicion(resultado).ok ? resultado.registro.id : null
    }

    function iniciar(nombre, evento = null, tarea = null, opciones = {}) {
        return Boolean(iniciarConId(nombre, evento, new Date(), tarea, opciones))
    }

    function puedeIniciarActividad(instante = new Date()) {
        const datosActuales = datosRef.current
        if (!datosActuales.ok) return { ok: false, error: datosActuales.error }
        const conflicto = obtenerConflictoConcentracion(datosActuales.registros, instante)
        const sesionFocus = sesionFocusEnConcentracion()
        if (conflicto?.tipo === "focus" || sesionFocus) {
            return {
                ok: false,
                error: `No se puede iniciar otra actividad mientras Focus está en concentración (${conflicto?.registro.nombre ?? sesionFocus}).`
            }
        }
        return { ok: true }
    }

    function obtenerError() {
        return ultimoErrorRef.current
    }

    function pausar(id, instante = new Date()) {
        const datosActuales = datosRef.current
        if (!datosActuales.ok) {
            return false
        }

        cambiarAhora(instante)
        return guardarTransicion(pausarRegistro(datosActuales.registros, id, instante)).ok
    }

    function continuar(id, instante = new Date()) {
        const datosActuales = datosRef.current
        if (!datosActuales.ok) {
            return false
        }

        const registro = datosActuales.registros.find(item => item.id === id)
        const conflicto = obtenerConflictoConcentracion(datosActuales.registros, instante, id)
        const sesionFocus = sesionFocusEnConcentracion()
        if (registro?.origenFocus === true ? conflicto !== null : conflicto?.tipo === "focus" || sesionFocus) {
            cambiarError(registro?.origenFocus === true
                ? conflicto?.tipo === "actividad"
                    ? `Focus esperará a que finalices o pauses “${conflicto.registro.nombre}” antes de reanudar la concentración.`
                    : `Ya hay una concentración Focus en curso (${conflicto?.registro.nombre}).`
                : `No se puede reanudar esta actividad mientras Focus está en concentración (${conflicto?.registro.nombre ?? sesionFocus}).`)
            return false
        }

        cambiarAhora(instante)
        return guardarTransicion(continuarRegistro(datosActuales.registros, id, instante)).ok
    }

    function finalizar(id, instante = new Date()) {
        const datosActuales = datosRef.current
        if (!datosActuales.ok) {
            return false
        }

        cambiarAhora(instante)
        return guardarTransicion(finalizarRegistro(datosActuales.registros, id, instante)).ok
    }

    function descartarPlanSinDuracion(id, instante = new Date()) {
        const datosActuales = datosRef.current
        if (!datosActuales.ok) return false
        cambiarAhora(instante)
        return guardarTransicion(descartarRegistroPlanSinDuracion(datosActuales.registros, id, instante)).ok
    }

    function buscar(id) {
        return datosRef.current.ok
            ? datosRef.current.registros.find(registro => registro.id === id) ?? null
            : null
    }

    function crearManual(cambios) {
        if (!datos.ok) {
            cambiarError(datos.error)
            return { ok: false, error: datos.error }
        }

        const resultado = crearRegistroManual(datos.registros, cambios)
        cambiarError("")
        const guardado = guardarTransicion(resultado, { mostrarError: false })

        if (guardado.ok) {
            cambiarAhora(new Date())
            return { ok: true, registro: resultado.registro }
        }

        return guardado
    }

    function editarFinalizado(id, cambios) {
        if (!datos.ok) {
            cambiarError(datos.error)
            return { ok: false, error: datos.error }
        }

        const instante = new Date()
        const resultado = editarRegistroFinalizado(datos.registros, id, cambios, instante)
        cambiarError("")
        const guardado = guardarTransicion(resultado, { mostrarError: false })

        if (guardado.ok) {
            cambiarAhora(instante)
            return { ok: true, registro: resultado.registro }
        }

        return guardado
    }

    function eliminarFinalizado(id) {
        if (!datos.ok) {
            cambiarError(datos.error)
            return { ok: false, error: datos.error }
        }

        const resultado = eliminarRegistroFinalizado(datos.registros, id)
        cambiarError("")
        return guardarTransicion(resultado, { mostrarError: false })
    }

    const marcarComoFocus = useCallback((ids) => {
        if (!datosRef.current.ok || !Array.isArray(ids) || ids.length === 0) return { ok: true }
        const seleccionados = new Set(ids)
        const nuevos = datosRef.current.registros.map(registro => seleccionados.has(registro.id) && registro.origenFocus !== true
            ? { ...registro, origenFocus: true }
            : registro)
        if (nuevos.every((registro, indice) => registro === datosRef.current.registros[indice])) return { ok: true }
        return guardarTransicion({ ok: true, registros: nuevos }, { mostrarError: false })
    }, [guardarTransicion])

    return {
        datos,
        registros,
        registrosActivos,
        ahora,
        error,
        mensaje,
        iniciar,
        iniciarConId,
        puedeIniciarActividad,
        obtenerError,
        pausar,
        continuar,
        finalizar,
        descartarPlanSinDuracion,
        buscar,
        crearManual,
        editarFinalizado,
        eliminarFinalizado,
        marcarComoFocus
    }
}
