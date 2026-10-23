import { useEffect, useRef, useState } from "react"

import {
    cargarHistorialFocus,
    cargarPlantillasFocus,
    cargarSesionActivaFocus,
    guardarHistorialFocus,
    guardarPlantillasFocus,
    guardarSesionActivaFocus
} from "../../domain/focus/persistenciaFocus.js"

const generarId = () => globalThis.crypto.randomUUID()
const DURACION_MAXIMA_MINUTOS = 24 * 60

export function crearBloquesFocus(pares, minutosConcentracion, minutosDescanso) {
    if (!Number.isInteger(pares) || pares < 1 || pares > 8
        || !Number.isInteger(minutosConcentracion) || minutosConcentracion < 1 || minutosConcentracion > 180
        || !Number.isInteger(minutosDescanso) || minutosDescanso < 1 || minutosDescanso > 60
        || pares * (minutosConcentracion + minutosDescanso) > DURACION_MAXIMA_MINUTOS) {
        return { ok: false, error: "Revisá los bloques: deben durar al menos un minuto y la sesión no puede superar 24 horas." }
    }

    const bloques = []
    for (let indice = 1; indice <= pares; indice += 1) {
        bloques.push({ nombre: `Concentración ${indice}`, tipo: "concentracion", minutos: minutosConcentracion })
        bloques.push({ nombre: `Descanso ${indice}`, tipo: "descanso", minutos: minutosDescanso })
    }
    return { ok: true, bloques }
}

function nuevaId() {
    try { return generarId() } catch { return null }
}

function fechaIso(instante) {
    return new Date(instante).toISOString()
}

function duracionMs(bloque) {
    return bloque.minutos * 60_000
}

function cerrarExtraAbierto(extras, tipo, instante) {
    const indice = extras.findLastIndex(extra => extra.tipo === tipo && extra.fin === null)
    if (indice < 0) return extras
    return extras.map((extra, actual) => actual === indice ? { ...extra, fin: fechaIso(instante) } : extra)
}

function crearConfiguracion(nombre, bloques, colores, usarColaFocus = false) {
    return {
        nombre: nombre.trim(),
        nombreActividad: "Concentración",
        evento: null,
        tarea: null,
        usarColaFocus: Boolean(usarColaFocus),
        bloques: bloques.map(bloque => ({ ...bloque })),
        colores: { concentracion: "#6366f1", descanso: "#10b981", pausa: "#f59e0b", tiempoMuerto: "#ef4444", ...colores }
    }
}

export function useSesionFocus(estadoRegistro, tareas = [], accionesTareas = {}) {
    const [plantillas, cambiarPlantillas] = useState(() => cargarPlantillasFocus().plantillas)
    const [historial, cambiarHistorial] = useState(() => cargarHistorialFocus().sesiones)
    const [sesion, cambiarSesion] = useState(() => cargarSesionActivaFocus().sesion)
    const [ahora, cambiarAhora] = useState(() => Date.now())
    const [error, cambiarError] = useState("")
    const sesionRef = useRef(sesion)
    const registroRef = useRef(estadoRegistro)
    const tareasRef = useRef(tareas)
    const accionesTareasRef = useRef(accionesTareas)
    const historialRef = useRef(historial)
    const reconciliarRef = useRef(null)
    useEffect(() => {
        tareasRef.current = tareas
        accionesTareasRef.current = accionesTareas
    })

    function guardarSesion(nuevaSesion) {
        const resultado = guardarSesionActivaFocus(nuevaSesion)
        if (!resultado.ok) {
            cambiarError(resultado.error)
            return false
        }
        sesionRef.current = nuevaSesion
        cambiarSesion(nuevaSesion)
        const concentracionEnCurso = nuevaSesion?.estado === "concentracion" && Boolean(nuevaSesion.registroId)
        accionesTareasRef.current.onEstadoSesionChange?.({
            activa: concentracionEnCurso,
            tareaActivaId: concentracionEnCurso && nuevaSesion.configuracion.usarColaFocus ? nuevaSesion.tareaActivaId ?? null : null
        })
        cambiarError("")
        return true
    }

    function guardarHistorial(nuevoHistorial) {
        const resultado = guardarHistorialFocus(nuevoHistorial)
        if (!resultado.ok) {
            cambiarError(resultado.error)
            return false
        }
        historialRef.current = nuevoHistorial
        cambiarHistorial(nuevoHistorial)
        return true
    }

    function guardarPlantillas(nuevasPlantillas) {
        const resultado = guardarPlantillasFocus(nuevasPlantillas)
        if (!resultado.ok) {
            cambiarError(resultado.error)
            return false
        }
        cambiarPlantillas(nuevasPlantillas)
        cambiarError("")
        return true
    }

    function obtenerColaFocus(lista = tareasRef.current) {
        return lista.filter(tarea => tarea.destino === "focus"
            && !["Boceto", "Completada", "Cancelada"].includes(tarea.estado))
            .sort((a, b) => (a.ordenFocus ?? Number.MAX_SAFE_INTEGER) - (b.ordenFocus ?? Number.MAX_SAFE_INTEGER))
    }

    function hayOtraActividadEnCurso() {
        return (registroRef.current.registros ?? []).some(registro =>
            registro.estado === "En curso" && registro.origenFocus !== true
        )
    }

    function cerrarTrabajoCola(actual, instante) {
        if (!actual.registroId) return true
        const registro = registroRef.current.buscar(actual.registroId)
        if (!registro || !["En curso", "Pausado"].includes(registro.estado)) return true
        return registroRef.current.finalizar(actual.registroId, new Date(instante))
    }

    function abrirTrabajoCola(actual, instante, tareaId = actual.tareaActivaId, tareasDisponibles = tareasRef.current) {
        if (actual.estado !== "concentracion" || actual.registroId) return actual
        const cola = actual.configuracion.usarColaFocus ? obtenerColaFocus(tareasDisponibles) : []
        const tarea = cola.find(item => item.id === tareaId) ?? cola[0] ?? null
        return {
            ...actual,
            registroId: null,
            tareaActivaId: tarea?.id ?? null,
            trabajoPendienteInicio: fechaIso(instante)
        }
    }

    function iniciarTrabajoPendiente(actual) {
        if (!actual.trabajoPendienteInicio || actual.registroId || actual.estado !== "concentracion") return actual
        const cola = actual.configuracion.usarColaFocus ? obtenerColaFocus() : []
        const tarea = cola.find(item => item.id === actual.tareaActivaId) ?? cola[0] ?? null
        const registroId = registroRef.current.iniciarConId(
            tarea?.nombre ?? "Concentración",
            null,
            new Date(actual.trabajoPendienteInicio),
            tarea,
            { origenFocus: true }
        )
        if (!registroId) {
            const errorInicio = registroRef.current.obtenerError?.() || registroRef.current.error || ""
            if (errorInicio.startsWith("Focus esperará a que finalices o pauses")) {
                const inicioBloque = actual.bloques.map((bloque, indice) => indice === actual.indiceBloque
                    ? { ...bloque, inicio: null, fin: null }
                    : bloque)
                return {
                    ...actual,
                    estado: "esperando-concentracion",
                    bloques: inicioBloque,
                    registroId: null,
                    trabajoPendienteInicio: null,
                    finBloque: null,
                    esperaDesde: fechaIso(Date.now())
                }
            }
            cambiarError(registroRef.current.error || "No se pudo iniciar el registro del tramo de concentración.")
            return null
        }
        return {
            ...actual,
            registroId,
            registroIds: [...new Set([...(actual.registroIds ?? []), registroId])],
            tareaActivaId: tarea?.id ?? null,
            trabajoPendienteInicio: null
        }
    }

    function actualizarSesionTrasCambioDeTarea(actual, instante, tareaId, tareasDisponibles = tareasRef.current) {
        let actualizado = { ...actual, registroId: null, trabajoPendienteInicio: null, tareaActivaId: tareaId }
        if (actual.estado === "concentracion") {
            actualizado = abrirTrabajoCola(actualizado, instante, tareaId, tareasDisponibles)
            if (!actualizado) return false
        }
        return guardarSesion(actualizado)
    }

    function terminarSesion(actual, instante, finalizarRegistro = true) {
        const apiRegistro = registroRef.current
        const registro = actual.registroId ? apiRegistro.buscar(actual.registroId) : null
        if (finalizarRegistro && registro && ["En curso", "Pausado"].includes(registro.estado)) {
            if (!apiRegistro.finalizar(actual.registroId, new Date(instante))) {
                cambiarError(apiRegistro.error || "No se pudo finalizar el registro vinculado a Focus.")
                return false
            }
        }

        const fin = fechaIso(instante)
        const bloquePendienteSinIniciar = actual.estado === "esperando-concentracion"
            && actual.bloques[actual.indiceBloque]?.inicio === null
        const bloques = actual.bloques.map((bloque, indice) => indice === actual.indiceBloque && bloque.fin === null && !bloquePendienteSinIniciar
            ? { ...bloque, fin }
            : bloque)
        const registroHistorial = {
            id: actual.id,
            configuracion: actual.configuracion,
            registroId: actual.registroId,
            registroIds: actual.registroIds ?? (actual.registroId ? [actual.registroId] : []),
            inicio: actual.inicio,
            fin,
            bloques,
            extras: (actual.extras ?? []).map(extra => extra.fin === null ? { ...extra, fin } : extra)
        }
        if (!guardarHistorial([registroHistorial, ...historialRef.current.filter(item => item.id !== actual.id)])) return false
        if (!guardarSesion(null)) return false
        return true
    }

    function avanzarAlSiguiente(actual, instante) {
        const siguienteIndice = actual.indiceBloque + 1
        if (siguienteIndice >= actual.configuracion.bloques.length) {
            return terminarSesion(actual, instante)
        }

        const siguiente = actual.configuracion.bloques[siguienteIndice]
        const nuevoEstado = siguiente.tipo
        if (!cerrarTrabajoCola(actual, instante)) {
            cambiarError(registroRef.current.error || "No se pudo cerrar el tramo de trabajo antes del siguiente bloque.")
            return false
        }

        const bloques = actual.bloques.map((bloque, indice) => indice === actual.indiceBloque
            ? { ...bloque, fin: fechaIso(instante) }
            : bloque)
        const esperar = nuevoEstado === "concentracion" && hayOtraActividadEnCurso()
        bloques[siguienteIndice] = { ...siguiente, inicio: esperar ? null : fechaIso(instante), fin: null }
        const extras = actual.estado === "tiempo-muerto"
            ? cerrarExtraAbierto(actual.extras ?? [], "tiempo-muerto", instante)
            : actual.extras ?? []
        let actualizado = {
            ...actual,
            registroId: null,
            trabajoPendienteInicio: null,
            bloques,
            extras,
            indiceBloque: siguienteIndice,
            estado: esperar ? "esperando-concentracion" : nuevoEstado,
            finBloque: esperar ? null : fechaIso(instante + duracionMs(siguiente)),
            inicioTiempoMuerto: null,
            tiempoMuertoAcumuladoMs: 0,
            reanudarEstado: null,
            restanteMs: 0,
            esperaDesde: esperar ? fechaIso(instante) : null
        }
        if (nuevoEstado === "concentracion" && !esperar) {
            actualizado = abrirTrabajoCola(actualizado, instante)
            if (!actualizado) return false
        }
        return guardarSesion(actualizado)
    }

    function reconciliar(instanteActual) {
        let actual = sesionRef.current
        if (actual?.estado === "esperando-concentracion") {
            if (hayOtraActividadEnCurso()) return
            const bloque = actual.configuracion.bloques[actual.indiceBloque]
            const inicio = fechaIso(instanteActual)
            const bloques = actual.bloques.map((item, indice) => indice === actual.indiceBloque
                ? { ...item, inicio, fin: null }
                : item)
            actual = {
                ...actual,
                estado: "concentracion",
                bloques,
                finBloque: fechaIso(instanteActual + (actual.restanteMs > 0 ? actual.restanteMs : duracionMs(bloque))),
                restanteMs: 0,
                esperaDesde: null
            }
            actual = abrirTrabajoCola(actual, instanteActual)
            if (!actual || !guardarSesion(actual)) return
            return
        }
        if (actual?.estado === "concentracion"
            && actual.trabajoPendienteInicio
            && instanteActual - Date.parse(actual.trabajoPendienteInicio) >= 1000) {
            actual = iniciarTrabajoPendiente(actual)
            if (!actual || !guardarSesion(actual)) return
        }
        if (!actual || !["concentracion", "descanso"].includes(actual.estado)) return

        let iteraciones = 0
        while (actual && ["concentracion", "descanso"].includes(actual.estado)
            && Date.parse(actual.finBloque) <= instanteActual && iteraciones < 18) {
            const finProgramado = Date.parse(actual.finBloque)
            const bloque = actual.configuracion.bloques[actual.indiceBloque]
            const bloques = actual.bloques.map((item, indice) => indice === actual.indiceBloque
                ? { ...item, fin: fechaIso(finProgramado) }
                : item)
            actual = { ...actual, bloques }

            if (bloque.tipo === "concentracion") {
                const apiRegistro = registroRef.current
                if (!cerrarTrabajoCola(actual, finProgramado)) {
                    cambiarError(apiRegistro.error || "No se pudo cerrar el registro de trabajo al finalizar la concentración.")
                    return
                }
                actual = { ...actual, registroId: null, trabajoPendienteInicio: null }
                const descansoIndice = actual.indiceBloque + 1
                if (descansoIndice >= actual.configuracion.bloques.length) {
                    if (!guardarSesion(actual)) return
                    terminarSesion(actual, finProgramado)
                    return
                }
                const descanso = actual.configuracion.bloques[descansoIndice]
                const nuevosBloques = [...bloques]
                nuevosBloques[descansoIndice] = { ...descanso, inicio: fechaIso(finProgramado), fin: null }
                actual = {
                    ...actual,
                    bloques: nuevosBloques,
                    indiceBloque: descansoIndice,
                    estado: "descanso",
                    finBloque: fechaIso(finProgramado + duracionMs(descanso)),
                    inicioTiempoMuerto: null
                }
                if (!guardarSesion(actual)) return
            } else {
                const siguienteIndice = actual.indiceBloque + 1
                if (siguienteIndice >= actual.configuracion.bloques.length) {
                    if (!guardarSesion(actual)) return
                    terminarSesion(actual, finProgramado)
                    return
                }
                if (!actual.avanzarAutomaticamente) {
                    actual = {
                        ...actual,
                        estado: "tiempo-muerto",
                        finBloque: null,
                        inicioTiempoMuerto: fechaIso(finProgramado),
                        tiempoMuertoAcumuladoMs: 0,
                        extras: [...(actual.extras ?? []), {
                            tipo: "tiempo-muerto",
                            inicio: fechaIso(finProgramado),
                            fin: null
                        }],
                        restanteMs: 0
                    }
                    if (!guardarSesion(actual)) return
                    return
                }
                if (!avanzarAlSiguiente(actual, finProgramado)) return
                actual = sesionRef.current
                if (!actual) return
            }
            iteraciones += 1
        }
    }
    useEffect(() => {
        sesionRef.current = sesion
        registroRef.current = estadoRegistro
        historialRef.current = historial
    }, [sesion, estadoRegistro, historial])

    useEffect(() => {
        if (!estadoRegistro.datos.ok) return
        const idsFocus = new Set((historialRef.current ?? []).flatMap(item => item.registroIds
            ?? (item.registroId ? [item.registroId] : [])))
        const sesionActiva = sesionRef.current
        for (const id of sesionActiva?.registroIds ?? []) idsFocus.add(id)
        if (sesionActiva?.registroId) idsFocus.add(sesionActiva.registroId)
        if (idsFocus.size > 0) estadoRegistro.marcarComoFocus?.([...idsFocus])
        const idsRegistros = new Set(estadoRegistro.registros.map(registro => registro.id))
        const sesionesConRegistros = historialRef.current.filter(item => {
            const ids = item.registroIds ?? (item.registroId ? [item.registroId] : [])
            return ids.length === 0 || ids.some(id => idsRegistros.has(id))
        })
        if (sesionesConRegistros.length === historialRef.current.length) return
        const resultado = guardarHistorialFocus(sesionesConRegistros)
        if (!resultado.ok) {
            cambiarError(resultado.error)
            return
        }
        historialRef.current = sesionesConRegistros
        cambiarHistorial(sesionesConRegistros)
    }, [estadoRegistro.datos.ok, estadoRegistro.registros, estadoRegistro.marcarComoFocus])

    useEffect(() => {
        reconciliarRef.current = reconciliar
    })

    useEffect(() => {
        const concentracionEnCurso = sesion?.estado === "concentracion" && Boolean(sesion.registroId)
        accionesTareasRef.current.onEstadoSesionChange?.({
            activa: concentracionEnCurso,
            tareaActivaId: concentracionEnCurso && sesion.configuracion.usarColaFocus ? sesion.tareaActivaId ?? null : null
        })
    }, [sesion])

    useEffect(() => {
        const actualizar = () => {
            const instante = Date.now()
            cambiarAhora(instante)
            reconciliarRef.current?.(instante)
        }
        const intervalo = setInterval(actualizar, 250)
        document.addEventListener("visibilitychange", actualizar)
        return () => {
            clearInterval(intervalo)
            document.removeEventListener("visibilitychange", actualizar)
        }
    }, [])

    function completarTareaActiva() {
        const actual = sesionRef.current
        const tareaId = actual?.configuracion.usarColaFocus ? actual.tareaActivaId : null
        if (!actual || !tareaId) return false
        const ahoraMs = Date.now()
        if (!cerrarTrabajoCola(actual, ahoraMs)) {
            cambiarError(registroRef.current.error || "No se pudo cerrar el tiempo de la tarea actual.")
            return false
        }
        const resultado = accionesTareasRef.current.onActualizarTarea?.(tareaId, { estado: "Completada" }, "focus")
        if (!resultado?.ok) {
            const reabierta = abrirTrabajoCola({ ...actual, registroId: null }, ahoraMs, tareaId)
            if (reabierta) guardarSesion(reabierta)
            cambiarError(resultado?.error || "No se pudo completar la tarea.")
            return false
        }
        const tareasActualizadas = resultado.tareas ?? tareasRef.current.map(tarea => tarea.id === tareaId
            ? { ...tarea, estado: "Completada" }
            : tarea)
        const siguiente = obtenerColaFocus(tareasActualizadas)[0]?.id ?? null
        return actualizarSesionTrasCambioDeTarea({ ...actual, registroId: null }, ahoraMs, siguiente, tareasActualizadas)
    }

    function posponerTareaActiva(modo) {
        const actual = sesionRef.current
        const tareaId = actual?.configuracion.usarColaFocus ? actual.tareaActivaId : null
        if (!actual || !tareaId) return false
        const ahoraMs = Date.now()
        if (!cerrarTrabajoCola(actual, ahoraMs)) {
            cambiarError(registroRef.current.error || "No se pudo cerrar el tiempo de la tarea actual.")
            return false
        }
        const resultado = accionesTareasRef.current.onPosponerTarea?.(tareaId, modo)
        if (!resultado?.ok) {
            const reabierta = abrirTrabajoCola({ ...actual, registroId: null }, ahoraMs, tareaId)
            if (reabierta) guardarSesion(reabierta)
            cambiarError(resultado?.error || "No se pudo posponer la tarea.")
            return false
        }
        const cola = obtenerColaFocus(resultado.tareas ?? tareasRef.current)
        const siguiente = cola[0]?.id ?? null
        return actualizarSesionTrasCambioDeTarea({ ...actual, registroId: null }, ahoraMs, siguiente, resultado.tareas)
    }

    function crearTareaDuranteSesion(nombre, destino = "backlog") {
        const resultado = accionesTareasRef.current.onCrearTarea?.(nombre, "Pendiente", destino)
        if (!resultado?.ok) {
            cambiarError(resultado?.error || "No se pudo crear la tarea.")
            return resultado ?? { ok: false, error: "No se pudo crear la tarea." }
        }
        const tarea = resultado.tarea
        const actual = sesionRef.current
        if (destino === "focus" && actual?.configuracion.usarColaFocus && !actual.tareaActivaId) {
            const ahoraMs = Date.now()
            if (!cerrarTrabajoCola(actual, ahoraMs)) {
                cambiarError(registroRef.current.error || "No se pudo cerrar el trabajo general.")
                return { ok: false, error: registroRef.current.error }
            }
            const tareasActualizadas = resultado.tareas ?? [...tareasRef.current, tarea].filter(Boolean)
            const primerId = obtenerColaFocus(tareasActualizadas)[0]?.id ?? tarea?.id ?? null
            if (!actualizarSesionTrasCambioDeTarea({ ...actual, registroId: null }, ahoraMs, primerId, tareasActualizadas)) {
                return { ok: false, error: "La tarea se creó, pero no se pudo cambiar el registro activo." }
            }
        }
        return resultado
    }

    function iniciar({ nombre, usarColaFocus = false, bloques, colores }) {
        if (sesionRef.current) {
            cambiarError("Ya hay una sesión Focus activa.")
            return false
        }
        if (typeof nombre !== "string" || nombre.trim() === ""
            || !Array.isArray(bloques) || bloques.length < 2 || bloques.some(bloque => (
                typeof bloque.nombre !== "string" || bloque.nombre.trim() === ""
                || !["concentracion", "descanso"].includes(bloque.tipo)
                || !Number.isInteger(bloque.minutos)
                || bloque.minutos < 1
                || bloque.minutos > (bloque.tipo === "concentracion" ? 180 : 60)
            ))) {
            cambiarError("Confirmá una secuencia válida de bloques antes de iniciar.")
            return false
        }
        const totalMinutos = bloques.reduce((total, bloque) => total + bloque.minutos, 0)
        if (totalMinutos > DURACION_MAXIMA_MINUTOS) {
            cambiarError("La sesión no puede superar 24 horas para respetar el límite de los registros.")
            return false
        }
        const id = nuevaId()
        if (!id) {
            cambiarError("No se pudo crear una identidad para la sesión Focus.")
            return false
        }
        const configuracion = crearConfiguracion(nombre, bloques, colores, usarColaFocus)
        const ahoraMs = Date.now()
        const ahoraIso = fechaIso(ahoraMs)
        const primera = configuracion.bloques[0]
        const esperar = primera.tipo === "concentracion" && hayOtraActividadEnCurso()
        const actual = {
            id,
            configuracion,
            registroId: null,
            registroIds: [],
            tareaActivaId: usarColaFocus ? (obtenerColaFocus()[0]?.id ?? null) : null,
            trabajoPendienteInicio: null,
            inicio: ahoraIso,
            indiceBloque: 0,
            estado: esperar ? "esperando-concentracion" : primera.tipo,
            avanzarAutomaticamente: false,
            finBloque: esperar ? null : fechaIso(ahoraMs + duracionMs(primera)),
            inicioTiempoMuerto: null,
            tiempoMuertoAcumuladoMs: 0,
            reanudarEstado: null,
            restanteMs: 0,
            extras: [],
            bloques: configuracion.bloques.map((bloque, indice) => ({
                ...bloque,
                inicio: indice === 0 && !esperar ? ahoraIso : null,
                fin: null
            }))
        }
        let conTrabajo = esperar ? actual : abrirTrabajoCola(actual, ahoraMs)
        if (!conTrabajo) return false
        return guardarSesion(conTrabajo)
    }

    function pausarSesion() {
        const actual = sesionRef.current
        if (!actual || !["concentracion", "descanso", "tiempo-muerto"].includes(actual.estado)) return false
        const ahoraMs = Date.now()
        if (actual.estado === "concentracion") {
            if (!cerrarTrabajoCola(actual, ahoraMs)) {
                cambiarError(registroRef.current.error || "No se pudo cerrar el tramo de Focus al pausarlo.")
                return false
            }
        }
        let extras = actual.extras ?? []
        let tiempoMuertoAcumuladoMs = actual.tiempoMuertoAcumuladoMs ?? 0
        if (actual.estado === "tiempo-muerto") {
            tiempoMuertoAcumuladoMs += Math.max(0, ahoraMs - Date.parse(actual.inicioTiempoMuerto))
            extras = cerrarExtraAbierto(extras, "tiempo-muerto", ahoraMs)
        }
        extras = [...extras, { tipo: "pausa-sesion", inicio: fechaIso(ahoraMs), fin: null }]
        return guardarSesion({
            ...actual,
            registroId: null,
            trabajoPendienteInicio: null,
            extras,
            estado: "pausada",
            reanudarEstado: actual.estado,
            tiempoMuertoAcumuladoMs,
            restanteMs: actual.estado === "tiempo-muerto"
                ? tiempoMuertoAcumuladoMs
                : actual.finBloque ? Math.max(0, Date.parse(actual.finBloque) - ahoraMs) : 0,
            finBloque: null
        })
    }

    function reanudarSesion() {
        const actual = sesionRef.current
        if (!actual || actual.estado !== "pausada" || !actual.reanudarEstado) return false
        const ahoraMs = Date.now()
        const estado = actual.reanudarEstado
        let extras = cerrarExtraAbierto(actual.extras ?? [], "pausa-sesion", ahoraMs)
        if (estado === "tiempo-muerto") {
            extras = [...extras, { tipo: "tiempo-muerto", inicio: fechaIso(ahoraMs), fin: null }]
        }
        const esperar = estado === "concentracion" && hayOtraActividadEnCurso()
        let actualizado = {
            ...actual,
            extras,
            estado: esperar ? "esperando-concentracion" : estado,
            finBloque: estado === "tiempo-muerto" || esperar ? null : fechaIso(ahoraMs + actual.restanteMs),
            inicioTiempoMuerto: estado === "tiempo-muerto" ? fechaIso(ahoraMs) : null,
            restanteMs: esperar ? actual.restanteMs : 0,
            reanudarEstado: null
        }
        if (esperar) actualizado.esperaDesde = fechaIso(ahoraMs)
        if (estado === "concentracion" && !esperar) {
            actualizado = abrirTrabajoCola(actualizado, ahoraMs)
            if (!actualizado) return false
        }
        return guardarSesion(actualizado)
    }

    function cambiarAvanceAutomatico(valor) {
        const actual = sesionRef.current
        if (!actual || actual.estado !== "descanso" || typeof valor !== "boolean") return false
        return guardarSesion({ ...actual, avanzarAutomaticamente: valor })
    }

    function confirmarSiguiente() {
        const actual = sesionRef.current
        if (!actual || actual.avanzarAutomaticamente || !["descanso", "tiempo-muerto"].includes(actual.estado)) return false
        return avanzarAlSiguiente(actual, Date.now())
    }

    function finalizarSesion() {
        const actual = sesionRef.current
        if (!actual) return false
        return terminarSesion(actual, Date.now())
    }

    function guardarPlantilla(nombrePlantilla, configuracion) {
        const id = nuevaId()
        if (!id || !nombrePlantilla.trim()) {
            cambiarError("Escribí un nombre para la plantilla.")
            return false
        }
        return guardarPlantillas([{ id, nombrePlantilla: nombrePlantilla.trim(), configuracion }, ...plantillas])
    }

    function eliminarPlantilla(id) {
        return guardarPlantillas(plantillas.filter(item => item.id !== id))
    }

    const bloqueActual = sesion?.configuracion.bloques[sesion.indiceBloque] ?? null
    const finBloqueMs = sesion?.finBloque ? Date.parse(sesion.finBloque) : null
    const restanteMs = sesion?.estado === "pausada"
        ? sesion.restanteMs
        : finBloqueMs === null ? null : Math.max(0, finBloqueMs - ahora)
    const tiempoMuertoMs = sesion?.estado === "tiempo-muerto" && sesion.inicioTiempoMuerto
        ? (sesion.tiempoMuertoAcumuladoMs ?? 0) + Math.max(0, ahora - Date.parse(sesion.inicioTiempoMuerto))
        : sesion?.estado === "pausada" && sesion.reanudarEstado === "tiempo-muerto"
            ? sesion.restanteMs
        : 0

    return {
        plantillas,
        historial,
        sesion,
        bloqueActual,
        restanteMs,
        tiempoMuertoMs,
        error,
        iniciar,
        completarTareaActiva,
        posponerTareaActiva,
        crearTareaDuranteSesion,
        pausarSesion,
        reanudarSesion,
        cambiarAvanceAutomatico,
        confirmarSiguiente,
        finalizarSesion,
        guardarPlantilla,
        eliminarPlantilla,
        limpiarError: () => cambiarError("")
    }
}
