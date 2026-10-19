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
    iniciarRegistro,
    pausarRegistro
} from "../../domain/registros/registros.js"
import { cargarRegistros, guardarRegistros } from "../../domain/registros/persistenciaRegistros.js"

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

    const guardarTransicion = useCallback((resultado, { mostrarError = true } = {}) => {
        if (!resultado.ok) {
            if (mostrarError) {
                cambiarError(resultado.error)
            }
            return { ok: false, error: resultado.error }
        }

        const guardado = guardarRegistros(resultado.registros)

        if (!guardado.ok) {
            if (mostrarError) {
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

        cambiarAhora(instante)
        const resultado = iniciarRegistro(
            datosActuales.registros,
            nombre,
            instante,
            undefined,
            evento,
            tarea,
            opciones.planId ?? null
        )
        return guardarTransicion(resultado).ok ? resultado.registro.id : null
    }

    function iniciar(nombre, evento = null, tarea = null, opciones = {}) {
        return Boolean(iniciarConId(nombre, evento, new Date(), tarea, opciones))
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

    return {
        datos,
        registros,
        registrosActivos,
        ahora,
        error,
        mensaje,
        iniciar,
        iniciarConId,
        pausar,
        continuar,
        finalizar,
        descartarPlanSinDuracion,
        buscar,
        crearManual,
        editarFinalizado,
        eliminarFinalizado
    }
}
