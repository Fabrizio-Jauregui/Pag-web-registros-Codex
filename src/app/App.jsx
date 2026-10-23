import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { ProveedorReloj } from "./ProveedorReloj.jsx"

import "./App.css"
import "./index.css"

import { BibliotecaEventos } from "../features/eventos/BibliotecaEventos.jsx"
import { BibliotecaCategorias } from "../features/eventos/BibliotecaCategorias.jsx"
import { CalendarioDiario } from "../features/calendario/CalendarioDiario.jsx"
import { EstadosRegistros } from "../features/registros/EstadosRegistros.jsx"
import { AnaliticaRegistros } from "../features/analitica/AnaliticaRegistros.jsx"
import { useRegistro } from "../features/registros/usoRegistro.js"
import { VistaFocus } from "../features/registros/VistaFocus.jsx"
import { HistorialRegistros } from "../features/registros/HistorialRegistros.jsx"
import {
    actualizarPlantillaEvento,
    crearPlantillaEvento,
    eliminarPlantillaEvento
} from "../domain/eventos/eventos.js"
import {
    cargarPlantillasEventos,
    guardarPlantillasEventos
} from "../domain/eventos/persistenciaEventos.js"
import { crearCategoria, actualizarCategoria, eliminarCategoria } from "../domain/categorias/categorias.js"
import { cargarCategorias, guardarCategorias } from "../domain/categorias/persistenciaCategorias.js"
import { crearPlan, actualizarPlan, eliminarAplicacionPlan, eliminarPlan, compararPlanesPorSeguimiento, validarCompatibilidadPlanesFocus } from "../domain/planificacion/planes.js"
import { cargarPlanes, guardarPlanes } from "../domain/planificacion/persistenciaPlanes.js"
import { formatearFechaISO } from "../domain/tiempo/FechaCalendario.js"
import { cargarRecurrencias, guardarRecurrencias, crearReglaRecurrencia, cambiarRecurrencia, eliminarRecurrencia, generarAparicionesRecurrencia } from "../domain/planificacion/recurrencias.js"
import {
    aplicarPlantillaPlanificacion,
    actualizarPlantillaPlanificacion,
    crearPlantillaPlanificacion,
    eliminarPlantillaPlanificacion,
    yaAplicadaEnFecha
} from "../domain/planificacion/plantillasPlanificacion.js"
import {
    cargarPlantillasPlanificacion,
    guardarPlantillasPlanificacion
} from "../domain/planificacion/persistenciaPlantillasPlanificacion.js"
import { BibliotecaPlantillasPlanificacion } from "../features/planificacion/BibliotecaPlantillasPlanificacion.jsx"
import { useSeguimientoPlanificacion } from "../features/planificacion/usoSeguimientoPlanificacion.js"
import { PanelSeguimientoPlanificacion } from "../features/planificacion/SeguimientoPlanificacion.jsx"
import { BibliotecaTareas } from "../features/tareas/BibliotecaTareas.jsx"
import { crearTarea, crearObjetivo, actualizarObjetivo, cambiarEstadoRama, descendientesDe, obtenerRutaTarea, actualizarTarea, cambiarDestinoTarea, eliminarTarea, moverTareaEnArbol, moverTareaEnCola, posponerTareaEnCola, sincronizarEstadoTareasFocus } from "../domain/tareas/tareas.js"
import { cargarTareas, guardarTareas } from "../domain/tareas/persistenciaTareas.js"
import { cargarPlantillasFocus } from "../domain/focus/persistenciaFocus.js"

export function App() {
    const [vistaPrincipal, cambiarVistaPrincipal] = useState("calendario")
    const [tema, cambiarTema] = useState(() => {
        try {
            return localStorage.getItem("focus.tema.v1") === "claro" ? "claro" : "oscuro"
        } catch {
            return "oscuro"
        }
    })
    const [estadoPlantillas, cambiarEstadoPlantillas] = useState(cargarPlantillasEventos)
    const [estadoCategorias, cambiarEstadoCategorias] = useState(cargarCategorias)
    const [estadoPlanes, cambiarEstadoPlanes] = useState(cargarPlanes)
    const [estadoRecurrencias, cambiarEstadoRecurrencias] = useState(cargarRecurrencias)
    const [estadoPlantillasPlan, cambiarEstadoPlantillasPlan] = useState(cargarPlantillasPlanificacion)
    const [estadoTareas, cambiarEstadoTareas] = useState(cargarTareas)
    const [estadoPlantillasFocus, cambiarEstadoPlantillasFocus] = useState(cargarPlantillasFocus)
    const publicarPlantillasFocus = useCallback(plantillasFocus => {
        cambiarEstadoPlantillasFocus(actual => actual.plantillas === plantillasFocus
            ? actual
            : { ok: true, plantillas: plantillasFocus })
    }, [])
    const [estadoFocusTareas, cambiarEstadoFocusTareas] = useState({ activa: false, tareaActivaId: null })
    const [fechaCalendarioSolicitada, cambiarFechaCalendarioSolicitada] = useState({ fecha: null, version: 0 })
    const calendarioRef = useRef(null)
    const inicioFocusPlanificadoRef = useRef(null)
    const estadoRegistro = useRegistro()
    const seguimientoPlanificacion = useSeguimientoPlanificacion(estadoRegistro)
    const objetivos = estadoTareas.ok ? estadoTareas.tareas.filter(tarea => tarea.tipo === "objetivo") : []
    const tareasBase = estadoTareas.ok ? estadoTareas.tareas.filter(tarea => tarea.tipo !== "objetivo") : []
    const tareasDeTrabajo = estadoTareas.ok
        ? tareasBase.map(tarea => ({
            ...tarea,
            rutaNombre: obtenerRutaTarea(tareasBase, objetivos, tarea.id)
        }))
        : []
    const plantillas = estadoPlantillas.ok ? estadoPlantillas.plantillas : []
    const idAplicacionSeguimiento = seguimientoPlanificacion.estado?.idAplicacionPlantilla
    const fechaSeguimiento = seguimientoPlanificacion.estado
        ? new Date(seguimientoPlanificacion.estado.secuencia[seguimientoPlanificacion.estado.indiceActual].inicioPrevisto)
        : null
    const planesSeguimiento = idAplicacionSeguimiento && estadoPlanes.ok
        ? estadoPlanes.planes.filter(plan => plan.idAplicacionPlantilla === idAplicacionSeguimiento)
        : fechaSeguimiento
        ? [
            ...(estadoPlanes.ok ? estadoPlanes.planes : []),
            ...generarAparicionesRecurrencia(
                estadoRecurrencias.ok ? estadoRecurrencias.reglas : [],
                fechaSeguimiento,
                fechaSeguimiento
            )
        ].filter(plan => plan.inicio.getFullYear() === fechaSeguimiento.getFullYear()
            && plan.inicio.getMonth() === fechaSeguimiento.getMonth()
            && plan.inicio.getDate() === fechaSeguimiento.getDate())
        : []
    const esVistaFocus = vistaPrincipal === "focus"

    useLayoutEffect(() => {
        document.documentElement.dataset.tema = tema
        try {
            localStorage.setItem("focus.tema.v1", tema)
        } catch {
            // El tema sigue activo durante esta sesión aunque no pueda persistirse.
        }
    }, [tema])

    function solicitarAccionCalendario(tipo, evento) {
        if (tipo === "registro") calendarioRef.current?.abrirNuevoRegistro(evento.currentTarget)
        if (tipo === "plan") calendarioRef.current?.abrirNuevaPlanificacion(evento.currentTarget)
    }

    function iniciarFocusPlanificado(plan) {
        if (plan?.tipoPlanificacion !== "focus" || !plan.configuracionFocus) return { ok: false, error: "Este plan no contiene una sesión Focus válida." }
        if (typeof inicioFocusPlanificadoRef.current !== "function") return { ok: false, error: "Focus todavía no está disponible para iniciar la sesión." }
        const iniciada = inicioFocusPlanificadoRef.current(plan.configuracionFocus)
        if (!iniciada) return { ok: false, error: "No se pudo iniciar la sesión Focus. Revisá si ya hay otra sesión activa." }
        cambiarVistaPrincipal("focus")
        return { ok: true }
    }

    function confirmarCambio(nuevasPlantillas) {
        const guardado = guardarPlantillasEventos(nuevasPlantillas)

        if (!guardado.ok) {
            return guardado
        }

        cambiarEstadoPlantillas({ ok: true, plantillas: nuevasPlantillas })
        return { ok: true }
    }

    function sincronizarSeguimiento(planes = estadoPlanes.ok ? estadoPlanes.planes : [], reglas = estadoRecurrencias.ok ? estadoRecurrencias.reglas : []) {
        const seguimiento = seguimientoPlanificacion.estado
        if (!seguimiento) return { ok: true }
        const planActivo = seguimiento.secuencia[seguimiento.indiceActual]
        const fecha = new Date(planActivo.inicioPrevisto)
        const apariciones = generarAparicionesRecurrencia(reglas, fecha, fecha)
        const visibles = seguimiento.idAplicacionPlantilla
            ? planes.filter(plan => plan.idAplicacionPlantilla === seguimiento.idAplicacionPlantilla)
            : [...planes, ...apariciones].filter(plan => plan.inicio.getFullYear() === fecha.getFullYear()
                && plan.inicio.getMonth() === fecha.getMonth()
                && plan.inicio.getDate() === fecha.getDate())
        return seguimientoPlanificacion.sincronizarPlanes(visibles, plantillas)
    }

    function confirmarPlanes(nuevosPlanes) {
        const anteriores = estadoPlanes.ok ? estadoPlanes.planes : []
        const porIdAnterior = new Map(anteriores.map(plan => [plan.id, plan]))
        const idsModificados = new Set(nuevosPlanes.filter(plan => {
            const anterior = porIdAnterior.get(plan.id)
            return !anterior || anterior.inicio.getTime() !== plan.inicio.getTime()
                || anterior.fin?.getTime() !== plan.fin?.getTime()
                || anterior.tipoPlanificacion !== plan.tipoPlanificacion
                || JSON.stringify(anterior.configuracionFocus) !== JSON.stringify(plan.configuracionFocus)
        }).map(plan => plan.id))
        const incompatibilidad = validarCompatibilidadPlanesFocus(nuevosPlanes, idsModificados)
        if (incompatibilidad) return { ok: false, error: incompatibilidad }
        const guardado = guardarPlanes(nuevosPlanes)
        if (!guardado.ok) return guardado
        const sincronizacion = sincronizarSeguimiento(nuevosPlanes)
        if (!sincronizacion.ok) {
            guardarPlanes(anteriores)
            return sincronizacion
        }
        cambiarEstadoPlanes({ ok: true, planes: nuevosPlanes })
        return { ok: true }
    }

    function confirmarRecurrencias(nuevas) {
        const guardado = guardarRecurrencias(nuevas)
        if (!guardado.ok) return guardado
        const sincronizacion = sincronizarSeguimiento(undefined, nuevas)
        if (!sincronizacion.ok) {
            guardarRecurrencias(estadoRecurrencias.ok ? estadoRecurrencias.reglas : [])
            return sincronizacion
        }
        cambiarEstadoRecurrencias({ ok: true, reglas: nuevas })
        return { ok: true }
    }

    function guardarColaSeguimiento(idsFuturos, planesBase = estadoPlanes.planes, reglasBase = estadoRecurrencias.reglas) {
        const sesion = seguimientoPlanificacion.estado
        if (!sesion || !estadoPlanes.ok || !estadoRecurrencias.ok) {
            return { ok: false, error: "No se pudieron cargar los planes para actualizar la secuencia." }
        }
        const activo = sesion.secuencia[sesion.indiceActual]
        const fecha = new Date(activo.inicioPrevisto)
        const apariciones = generarAparicionesRecurrencia(reglasBase, fecha, fecha)
        const visibles = sesion.idAplicacionPlantilla
            ? planesBase.filter(plan => plan.idAplicacionPlantilla === sesion.idAplicacionPlantilla)
            : [...planesBase, ...apariciones].filter(plan => plan.inicio.getFullYear() === fecha.getFullYear()
                && plan.inicio.getMonth() === fecha.getMonth()
                && plan.inicio.getDate() === fecha.getDate())
        const activos = new Set((sesion.registrosActivos ?? []).map(item => item.planId))
        const finalizados = new Set(sesion.finalizados ?? [])
        const grupoActivo = sesion.secuencia[sesion.indiceActual]?.grupo
        const prefijo = sesion.tipoSeguimiento === "cronometro"
            ? sesion.secuencia.filter(item => activos.has(item.planId) || finalizados.has(item.planId)
                || (sesion.eventosOmitidos ?? []).includes(item.planId) || (sesion.iniciados ?? []).includes(item.planId)).map(item => item.planId)
            : sesion.idAplicacionPlantilla
            ? sesion.secuencia.filter(item => activos.has(item.planId) || finalizados.has(item.planId)
                || item.grupo === grupoActivo).map(item => item.planId)
            : sesion.secuencia.slice(0, sesion.indiceActual + 1).map(item => item.planId)
        const idsCola = [...new Set([...prefijo, ...idsFuturos])]
        const idsIncluidos = new Set(idsCola)
        const alcanceVisible = sesion.idAplicacionPlantilla
            ? visibles.filter(plan => plan.idAplicacionPlantilla === sesion.idAplicacionPlantilla)
            : visibles
        const anteriores = alcanceVisible.filter(plan => !idsIncluidos.has(plan.id)).sort(compararPlanesPorSeguimiento)
        const orden = [...anteriores.map(plan => plan.id), ...idsCola]
        const ordenPorId = new Map(orden.map((id, indice) => [id, indice]))

        const gruposCronometro = new Map()
        let grupoAnterior = null
        let grupoNormalizado = -1
        for (const id of orden) {
            const plan = [...planesBase, ...visibles].find(item => item.id === id)
            if (!plan || plan.modoSeguimientoPlanificacion !== "cronometro") continue
            if (grupoAnterior !== plan.grupoCronometro) { grupoNormalizado += 1; grupoAnterior = plan.grupoCronometro }
            gruposCronometro.set(id, grupoNormalizado)
        }
        const nuevosPlanes = planesBase.map(plan => ordenPorId.has(plan.id)
            ? { ...plan, ordenSeguimiento: ordenPorId.get(plan.id), ...(gruposCronometro.has(plan.id) ? { grupoCronometro: gruposCronometro.get(plan.id) } : {}) }
            : plan)
        let nuevasReglas = reglasBase
        for (const aparicion of visibles.filter(plan => plan.idRecurrencia && ordenPorId.has(plan.id))) {
            nuevasReglas = nuevasReglas.map(regla => {
                if (regla.id !== aparicion.idRecurrencia) return regla
                const fechaExcepcion = aparicion.fechaRecurrencia
                const evento = plantillas.find(item => item.id === aparicion.eventoId)
                const excepcion = {
                    id: aparicion.id,
                    nombre: aparicion.nombre,
                    eventoId: aparicion.eventoId ?? null,
                    colorEvento: aparicion.colorEvento,
                    inicio: aparicion.inicio.toISOString(),
                    fin: aparicion.fin.toISOString(),
                    ordenSeguimiento: ordenPorId.get(aparicion.id)
                }
                if (aparicion.eventoId && !evento) return regla
                return { ...regla, excepciones: { ...regla.excepciones, [fechaExcepcion]: excepcion } }
            })
        }

        const guardadoPlanes = guardarPlanes(nuevosPlanes)
        if (!guardadoPlanes.ok) return guardadoPlanes
        const guardadoRecurrencias = guardarRecurrencias(nuevasReglas)
        if (!guardadoRecurrencias.ok) {
            guardarPlanes(planesBase)
            return guardadoRecurrencias
        }
        const nuevasApariciones = sesion.idAplicacionPlantilla
            ? []
            : generarAparicionesRecurrencia(nuevasReglas, fecha, fecha)
        const sincronizacion = seguimientoPlanificacion.sincronizarPlanes(
            sesion.idAplicacionPlantilla
                ? nuevosPlanes.filter(plan => plan.idAplicacionPlantilla === sesion.idAplicacionPlantilla)
                : [...nuevosPlanes, ...nuevasApariciones].filter(plan => plan.inicio.getFullYear() === fecha.getFullYear()
                    && plan.inicio.getMonth() === fecha.getMonth()
                    && plan.inicio.getDate() === fecha.getDate()),
            plantillas
        )
        if (!sincronizacion.ok) {
            guardarPlanes(planesBase)
            guardarRecurrencias(reglasBase)
            return sincronizacion
        }
        cambiarEstadoPlanes({ ok: true, planes: nuevosPlanes })
        cambiarEstadoRecurrencias({ ok: true, reglas: nuevasReglas })
        return { ok: true }
    }

    function crearPlanEnSeguimiento(cambios, indiceInsercion = 0) {
        if (!estadoPlanes.ok || !seguimientoPlanificacion.estado) return { ok: false, error: "No hay una secuencia activa para editar." }
        const sesion = seguimientoPlanificacion.estado
        const fecha = new Date(sesion.secuencia[sesion.indiceActual].inicioPrevisto)
        if (sesion.tipoSeguimiento === "cronometro" && cambios.tipoSecuencial) {
            const evento = cambios.eventoId ? plantillas.find(item => item.id === cambios.eventoId) : null
            const creado = crearPlan({ nombre: evento?.nombre ?? cambios.nombre, evento, inicio: fecha, fin: new Date(fecha.getTime() + 1000) })
            if (!creado.ok) return creado
            const planCreado = { ...creado.plan, fin: null, plantillaOrigenId: sesion.secuencia[0].plantillaOrigenId,
                plantillaOrigenNombre: sesion.secuencia[0].plantillaOrigenNombre, idAplicacionPlantilla: sesion.idAplicacionPlantilla,
                fechaAplicacion: formatearFechaISO(fecha), modoSeguimientoPlanificacion: "cronometro",
                grupoCronometro: cambios.grupoCronometro, ordenSeguimiento: Math.max(-1, ...sesion.secuencia.map(item => item.grupo ?? 0)) + 1 }
            const pendientes = sesion.secuencia.filter(item => !(sesion.iniciados ?? []).includes(item.planId)
                && !(sesion.finalizados ?? []).includes(item.planId) && !(sesion.eventosOmitidos ?? []).includes(item.planId)).map(item => item.planId)
            pendientes.splice(Math.max(0, Math.min(indiceInsercion, pendientes.length)), 0, planCreado.id)
            const nuevos = [...estadoPlanes.planes, planCreado]
            const guardado = guardarPlanes(nuevos)
            if (!guardado.ok) return guardado
            const cola = guardarColaSeguimiento(pendientes, nuevos)
            if (!cola.ok) { guardarPlanes(estadoPlanes.planes); return cola }
            return { ok: true, plan: planCreado }
        }
        if (!seguimientoPlanificacion.estado.idAplicacionPlantilla
            && (cambios.inicio.getFullYear() !== fecha.getFullYear()
            || cambios.inicio.getMonth() !== fecha.getMonth()
            || cambios.inicio.getDate() !== fecha.getDate())) {
            return { ok: false, error: "El evento nuevo debe pertenecer al mismo día de la planificación en curso." }
        }
        const creado = crearPlan(cambios)
        if (!creado.ok) return creado
        const planCreado = seguimientoPlanificacion.estado.idAplicacionPlantilla
            ? { ...creado.plan, idAplicacionPlantilla: seguimientoPlanificacion.estado.idAplicacionPlantilla }
            : creado.plan
        const futuros = sesion.tipoSeguimiento === "cronometro"
            ? sesion.secuencia.filter(item => !(sesion.iniciados ?? []).includes(item.planId)
                && !(sesion.finalizados ?? []).includes(item.planId) && !(sesion.eventosOmitidos ?? []).includes(item.planId)).map(item => item.planId)
            : sesion.secuencia.slice(sesion.indiceActual + 1).map(item => item.planId)
        futuros.splice(Math.max(0, Math.min(indiceInsercion, futuros.length)), 0, planCreado.id)
        const resultado = guardarColaSeguimiento(futuros, [...estadoPlanes.planes, planCreado])
        return resultado.ok ? { ok: true, plan: planCreado } : resultado
    }

    function crearRecurrenciaEnSeguimiento(cambios, indiceInsercion = 0) {
        if (!estadoRecurrencias.ok || !seguimientoPlanificacion.estado) return { ok: false, error: "No hay una secuencia activa para editar." }
        if (cambios.fechaFin && cambios.fechaFin < formatearFechaISO(cambios.inicio)) {
            return { ok: false, error: "La fecha final debe ser igual o posterior al primer día." }
        }
        const plan = crearPlan(cambios)
        if (!plan.ok) return plan
        const creada = crearReglaRecurrencia(plan.plan, cambios.diasSemana, cambios.fechaFin)
        if (!creada.ok) return creada
        const sesion = seguimientoPlanificacion.estado
        const fecha = new Date(sesion.secuencia[sesion.indiceActual].inicioPrevisto)
        const reglas = [...estadoRecurrencias.reglas, creada.regla]
        const aparicionHoy = generarAparicionesRecurrencia(reglas, fecha, fecha)
            .find(item => item.idRecurrencia === creada.regla.id)
        const futuros = sesion.secuencia.slice(sesion.indiceActual + 1).map(item => item.planId)
        if (aparicionHoy) futuros.splice(Math.max(0, Math.min(indiceInsercion, futuros.length)), 0, aparicionHoy.id)
        const resultado = guardarColaSeguimiento(futuros, estadoPlanes.planes, reglas)
        return resultado.ok
            ? { ok: true, regla: creada.regla, mensaje: aparicionHoy ? "La aparición de hoy se agregó a la secuencia." : "Se creó la serie; no tiene una aparición en el día que se está siguiendo." }
            : resultado
    }

    function editarPlanEnSeguimiento(plan, cambios) {
        if (plan.idRecurrencia) {
            return actualizarPlanificacion(plan.idRecurrencia, {
                ...cambios,
                idRecurrencia: plan.idRecurrencia,
                fechaRecurrencia: plan.fechaRecurrencia,
                ordenSeguimiento: plan.ordenSeguimiento
            })
        }
        if (seguimientoPlanificacion.estado?.tipoSeguimiento === "cronometro") {
            if ((seguimientoPlanificacion.estado.iniciados ?? []).includes(plan.id)) return { ok: false, error: "Un evento iniciado ya no se puede editar." }
            const evento = cambios.eventoId ? plantillas.find(item => item.id === cambios.eventoId) : null
            const resultadoSecuencial = actualizarPlan(estadoPlanes.planes, plan.id, {
                nombre: evento?.nombre ?? cambios.nombre, evento, inicio: plan.inicio, fin: plan.fin
            })
            if (!resultadoSecuencial.ok) return resultadoSecuencial
            const nuevos = resultadoSecuencial.planes.map(item => item.id === plan.id ? { ...item, grupoCronometro: cambios.grupoCronometro } : item)
            const guardado = confirmarPlanes(nuevos)
            return guardado.ok ? { ok: true, plan: nuevos.find(item => item.id === plan.id) } : guardado
        }
        const resultado = actualizarPlan(estadoPlanes.planes, plan.id, cambios)
        if (!resultado.ok) return resultado
        const guardado = confirmarPlanes(resultado.planes)
        return guardado.ok ? { ok: true, plan: resultado.planes.find(item => item.id === plan.id) } : guardado
    }

    function eliminarPlanEnSeguimiento(plan) {
        return plan.idRecurrencia
            ? eliminarRecurrenciaPlanificacion(plan.idRecurrencia, plan.fechaRecurrencia, "solo")
            : eliminarPlanificacion(plan.id)
    }

    function reordenarPlanesEnSeguimiento(idsFuturos) {
        return guardarColaSeguimiento(idsFuturos)
    }

    function confirmarPlantillasPlan(nuevas) {
        const guardado = guardarPlantillasPlanificacion(nuevas)
        if (!guardado.ok) return guardado
        cambiarEstadoPlantillasPlan({ ok: true, plantillas: nuevas })
        return { ok: true }
    }

    function confirmarTareas(nuevasTareas) {
        const guardado = guardarTareas(nuevasTareas)
        if (!guardado.ok) return guardado
        cambiarEstadoTareas({ ok: true, tareas: nuevasTareas })
        return { ok: true }
    }

    function actualizarEstadoSesionFocus(nuevoEstado) {
        cambiarEstadoFocusTareas(nuevoEstado)
        const cargadas = cargarTareas()
        if (!cargadas.ok) return
        const resultado = sincronizarEstadoTareasFocus(cargadas.tareas, nuevoEstado.tareaActivaId)
        if (resultado.ok && resultado.tareas !== cargadas.tareas) confirmarTareas(resultado.tareas)
    }

    function crearTareaNueva(nombre, estado, destino = "backlog", ubicacion = {}) {
        if (!estadoTareas.ok) return { ok: false, error: estadoTareas.error }
        const ordenFocus = destino === "focus"
            ? estadoTareas.tareas.filter(tarea => tarea.destino === "focus" && !["Completada", "Cancelada", "Boceto"].includes(tarea.estado))
                .reduce((maximo, tarea) => Math.max(maximo, tarea.ordenFocus ?? 0), 0) + 1
            : null
        const padreId = ubicacion.padreId ?? ubicacion.objetivoId ?? null
        const ordenArbol = estadoTareas.tareas.filter(tarea => tarea.tipo !== "objetivo" && (tarea.padreId ?? tarea.objetivoId ?? null) === padreId)
            .reduce((maximo, tarea) => Math.max(maximo, tarea.ordenArbol ?? 0), 0) + 1
        const resultado = crearTarea(nombre, estado, undefined, undefined, destino, ordenFocus, { ...ubicacion, padreId, ordenArbol })
        if (!resultado.ok) return resultado
        const tareas = [...estadoTareas.tareas, resultado.tarea]
        const guardado = confirmarTareas(tareas)
        return guardado.ok ? { ok: true, tarea: resultado.tarea, tareas } : guardado
    }

    function actualizarTareaExistente(id, cambios, alcance = "solo") {
        if (!estadoTareas.ok) return { ok: false, error: estadoTareas.error }
        const desdeFocus = alcance === "focus"
        const alcanceRama = desdeFocus ? "solo" : alcance
        if (cambios?.padreId !== undefined && descendientesDe(estadoTareas.tareas, id).some(tarea => tarea.id === estadoFocusTareas.tareaActivaId)) {
            return { ok: false, error: "No se puede cambiar la ubicación de una rama que contiene la tarea activa de Focus." }
        }
        const resultado = ["Completada", "Cancelada"].includes(cambios?.estado)
            ? cambiarEstadoRama(estadoTareas.tareas, id, cambios.estado, alcanceRama, estadoFocusTareas.tareaActivaId, undefined, desdeFocus)
            : actualizarTarea(estadoTareas.tareas, id, cambios)
        if (!resultado.ok) return resultado
        const guardado = confirmarTareas(resultado.tareas)
        return guardado.ok ? { ok: true, tareas: resultado.tareas } : guardado
    }

    function crearObjetivoNuevo(nombre) {
        if (!estadoTareas.ok) return { ok: false, error: estadoTareas.error }
        const resultado = crearObjetivo(nombre)
        if (!resultado.ok) return resultado
        const guardado = confirmarTareas([...estadoTareas.tareas, resultado.objetivo])
        return guardado.ok ? { ok: true, objetivo: resultado.objetivo } : guardado
    }

    function actualizarObjetivoExistente(id, cambios) {
        if (!estadoTareas.ok) return { ok: false, error: estadoTareas.error }
        const resultado = actualizarObjetivo(estadoTareas.tareas, id, cambios)
        if (!resultado.ok) return resultado
        const guardado = confirmarTareas(resultado.tareas)
        return guardado.ok ? { ok: true, tareas: resultado.tareas } : guardado
    }

    function cambiarDestinoTareaExistente(id, destino) {
        if (!estadoTareas.ok) return { ok: false, error: estadoTareas.error }
        const resultado = cambiarDestinoTarea(estadoTareas.tareas, id, destino)
        if (!resultado.ok) return resultado
        const guardado = confirmarTareas(resultado.tareas)
        return guardado.ok ? { ok: true, tareas: resultado.tareas } : guardado
    }

    function reordenarTareaFocus(id, direccion, tareaActivaId = null) {
        if (!estadoTareas.ok) return { ok: false, error: estadoTareas.error }
        const resultado = moverTareaEnCola(estadoTareas.tareas, id, direccion, tareaActivaId)
        if (!resultado.ok) return resultado
        const guardado = confirmarTareas(resultado.tareas)
        return guardado.ok ? { ok: true, tareas: resultado.tareas } : guardado
    }

    function reordenarTareaArbol(id, direccion) {
        if (!estadoTareas.ok) return { ok: false, error: estadoTareas.error }
        const resultado = moverTareaEnArbol(estadoTareas.tareas, id, direccion)
        if (!resultado.ok) return resultado
        const guardado = confirmarTareas(resultado.tareas)
        return guardado.ok ? { ok: true, tareas: resultado.tareas } : guardado
    }

    function posponerTareaFocus(id, modo) {
        if (!estadoTareas.ok) return { ok: false, error: estadoTareas.error }
        const resultado = posponerTareaEnCola(estadoTareas.tareas, id, modo)
        if (!resultado.ok) return resultado
        const guardado = confirmarTareas(resultado.tareas)
        return guardado.ok ? { ok: true, tareas: resultado.tareas } : guardado
    }

    function eliminarTareaExistente(id) {
        if (!estadoTareas.ok) return { ok: false, error: estadoTareas.error }
        if (!estadoRegistro.datos.ok) return { ok: false, error: "No se puede comprobar si hay registros vinculados porque no se pudieron cargar." }
        if (estadoRegistro.registros.some(registro => registro.tareaId === id)) {
            return { ok: false, error: "No se puede eliminar esta tarea porque está vinculada a uno o más registros." }
        }
        if (descendientesDe(estadoTareas.tareas, id).length) {
            return { ok: false, error: "No se puede eliminar una tarea que contiene subtareas. Reorganizá o eliminá primero sus descendientes." }
        }
        if (estadoFocusTareas.tareaActivaId === id) return { ok: false, error: "La tarea activa no se puede eliminar durante una sesión Focus." }
        const resultado = eliminarTarea(estadoTareas.tareas, id)
        if (!resultado.ok) return resultado
        return confirmarTareas(resultado.tareas)
    }

    function crearPlantillaPlan(cambios) {
        if (!estadoPlantillasPlan.ok) return { ok: false, error: estadoPlantillasPlan.error }
        const resultado = crearPlantillaPlanificacion(cambios)
        if (!resultado.ok) return resultado
        const guardado = confirmarPlantillasPlan([...estadoPlantillasPlan.plantillas, resultado.plantilla])
        return guardado.ok ? { ok: true } : guardado
    }

    function actualizarPlantillaPlan(id, cambios) {
        if (!estadoPlantillasPlan.ok) return { ok: false, error: estadoPlantillasPlan.error }
        const resultado = actualizarPlantillaPlanificacion(estadoPlantillasPlan.plantillas, id, cambios)
        if (!resultado.ok) return resultado
        return confirmarPlantillasPlan(resultado.plantillas)
    }

    function eliminarPlantillaPlan(id) {
        if (!estadoPlantillasPlan.ok) return { ok: false, error: estadoPlantillasPlan.error }
        const resultado = eliminarPlantillaPlanificacion(estadoPlantillasPlan.plantillas, id)
        if (!resultado.ok) return resultado
        return confirmarPlantillasPlan(resultado.plantillas)
    }

    function aplicarPlantillaPlan(id, fecha, permitirDuplicado, horaInicioSegundos) {
        if (!estadoPlantillasPlan.ok || !estadoPlanes.ok) return { ok: false, error: "No se pudieron cargar las plantillas o planes guardados." }
        const plantilla = estadoPlantillasPlan.plantillas.find(item => item.id === id)
        if (!plantilla) return { ok: false, error: "No se encontró la plantilla de planificación." }
        if (yaAplicadaEnFecha(estadoPlanes.planes, id, fecha) && !permitirDuplicado) return { ok: false, duplicado: true }
        const resultado = aplicarPlantillaPlanificacion(plantilla, fecha, plantillas, { ahora: new Date(), horaInicioSegundos })
        if (!resultado.ok) return resultado
        const guardado = confirmarPlanes([...estadoPlanes.planes, ...resultado.planes])
        if (!guardado.ok) return guardado
        cambiarFechaCalendarioSolicitada(actual => ({
            fecha: new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
            version: actual.version + 1
        }))
        cambiarVistaPrincipal("calendario")
        return { ok: true }
    }

    function crearPlanificacion(cambios) {
        if (!estadoPlanes.ok) return { ok: false, error: estadoPlanes.error }
        const resultado = crearPlan(cambios)
        if (!resultado.ok) return resultado
        const guardado = confirmarPlanes([...estadoPlanes.planes, resultado.plan])
        return guardado.ok ? { ok: true, plan: resultado.plan } : guardado
    }

    function crearRecurrenciaPlanificacion(cambios) {
        if (!estadoRecurrencias.ok) return { ok: false, error: estadoRecurrencias.error }
        const resultadoPlan = crearPlan(cambios)
        if (!resultadoPlan.ok) return resultadoPlan
        if (cambios.fechaFin && cambios.fechaFin < formatearFechaISO(cambios.inicio)) return { ok: false, error: "La fecha final debe ser igual o posterior al primer día." }
        const resultado = crearReglaRecurrencia(resultadoPlan.plan, cambios.diasSemana, cambios.fechaFin)
        if (!resultado.ok) return resultado
        return confirmarRecurrencias([...estadoRecurrencias.reglas, resultado.regla])
    }

    function actualizarPlanificacion(id, cambios) {
        const elementoActivo = seguimientoPlanificacion.estado?.secuencia[seguimientoPlanificacion.estado.indiceActual]
        const planActivo = planesSeguimiento.find(plan => plan.id === elementoActivo?.planId)
        const planEnCurso = seguimientoPlanificacion.estado?.registrosActivos?.some(item => item.planId === id)
        if (id === elementoActivo?.planId || planEnCurso
            || (cambios.idRecurrencia && planActivo?.idRecurrencia === cambios.idRecurrencia
                && (planActivo?.fechaRecurrencia === cambios.fechaRecurrencia
                    || cambios.alcance === "toda"
                    || (cambios.alcance === "siguientes"
                        && planActivo?.fechaRecurrencia >= cambios.fechaRecurrencia)))) {
            return { ok: false, error: "El evento que está en curso no se puede editar hasta que termine." }
        }
        if (cambios.idRecurrencia) {
            if (!estadoRecurrencias.ok) return { ok: false, error: estadoRecurrencias.error }
            const aparicion = planesSeguimiento.find(plan => plan.idRecurrencia === cambios.idRecurrencia
                && plan.fechaRecurrencia === cambios.fechaRecurrencia)
            const cambiosConOrden = cambios.ordenSeguimiento === undefined && cambios.alcance === "solo"
                && Number.isInteger(aparicion?.ordenSeguimiento)
                ? { ...cambios, ordenSeguimiento: aparicion.ordenSeguimiento }
                : cambios
            const resultado = cambiarRecurrencia(estadoRecurrencias.reglas, cambios.idRecurrencia, cambios.fechaRecurrencia, cambiosConOrden, cambios.alcance)
            if (!resultado.ok) return resultado
            return confirmarRecurrencias(resultado.reglas)
        }
        if (!estadoPlanes.ok) return { ok: false, error: estadoPlanes.error }
        const resultado = actualizarPlan(estadoPlanes.planes, id, cambios)
        if (!resultado.ok) return resultado
        const guardado = confirmarPlanes(resultado.planes)
        return guardado.ok
            ? { ok: true, plan: resultado.planes.find(plan => plan.id === id) }
            : guardado
    }

    function moverAplicacionPlanificacion(idAplicacion, desplazamientoMs) {
        if (!estadoPlanes.ok) return { ok: false, error: estadoPlanes.error }
        const aplicacion = estadoPlanes.planes.filter(plan => plan.idAplicacionPlantilla === idAplicacion)
        if (aplicacion.length === 0 || !Number.isFinite(desplazamientoMs)) return { ok: false, error: "No se encontró esa aplicación de plantilla en el calendario." }
        const planesActivos = new Set((seguimientoPlanificacion.estado?.registrosActivos ?? []).map(item => item.planId))
        const planActivoId = seguimientoPlanificacion.estado?.secuencia[seguimientoPlanificacion.estado.indiceActual]?.planId
        if (aplicacion.some(plan => plan.id === planActivoId || planesActivos.has(plan.id))) {
            return { ok: false, error: "No se puede mover la aplicación completa mientras uno de sus eventos está en curso." }
        }
        const ids = new Set(aplicacion.map(plan => plan.id))
        const nuevas = estadoPlanes.planes.map(plan => ids.has(plan.id) ? {
            ...plan,
            inicio: new Date(plan.inicio.getTime() + desplazamientoMs),
            fin: new Date(plan.fin.getTime() + desplazamientoMs)
        } : plan)
        return confirmarPlanes(nuevas)
    }

    function eliminarPlanificacion(id) {
        const elementoActivo = seguimientoPlanificacion.estado?.secuencia[seguimientoPlanificacion.estado.indiceActual]
        if (id === elementoActivo?.planId || seguimientoPlanificacion.estado?.registrosActivos?.some(item => item.planId === id)) {
            return { ok: false, error: "El evento que está en curso no se puede eliminar hasta que termine." }
        }
        if (!estadoPlanes.ok) return { ok: false, error: estadoPlanes.error }
        const resultado = eliminarPlan(estadoPlanes.planes, id)
        if (!resultado.ok) return resultado
        return confirmarPlanes(resultado.planes)
    }

    function eliminarRecurrenciaPlanificacion(id, fecha, alcance) {
        const elementoActivo = seguimientoPlanificacion.estado?.secuencia[seguimientoPlanificacion.estado.indiceActual]
        const planActivo = planesSeguimiento.find(plan => plan.id === elementoActivo?.planId)
        const ocurrenciaEnCurso = seguimientoPlanificacion.estado?.registrosActivos?.some(item => {
            const plan = planesSeguimiento.find(candidato => candidato.id === item.planId)
            return plan?.idRecurrencia === id
                && (plan.fechaRecurrencia === fecha || alcance === "toda"
                    || (alcance === "siguientes" && plan.fechaRecurrencia >= fecha))
        })
        if (ocurrenciaEnCurso || planActivo?.idRecurrencia === id && (planActivo?.fechaRecurrencia === fecha
            || alcance === "toda"
            || (alcance === "siguientes" && planActivo?.fechaRecurrencia >= fecha))) {
            return { ok: false, error: "El evento que está en curso no se puede eliminar hasta que termine." }
        }
        if (!estadoRecurrencias.ok) return { ok: false, error: estadoRecurrencias.error }
        const resultado = eliminarRecurrencia(estadoRecurrencias.reglas, id, fecha, alcance)
        return resultado.ok ? confirmarRecurrencias(resultado.reglas) : resultado
    }

    function eliminarAplicacionPlanificacion(idAplicacion) {
        if (!estadoPlanes.ok) return { ok: false, error: estadoPlanes.error }
        const planesActivos = new Set((seguimientoPlanificacion.estado?.registrosActivos ?? []).map(item => item.planId))
        const planActivoId = seguimientoPlanificacion.estado?.secuencia[seguimientoPlanificacion.estado.indiceActual]?.planId
        if (estadoPlanes.planes.some(plan => (planesActivos.has(plan.id) || plan.id === planActivoId) && plan.idAplicacionPlantilla === idAplicacion)) {
            return { ok: false, error: "No se puede eliminar la aplicación mientras uno de sus eventos está en curso." }
        }
        const resultado = eliminarAplicacionPlan(estadoPlanes.planes, idAplicacion)
        if (!resultado.ok) return resultado
        const guardado = confirmarPlanes(resultado.planes)
        return guardado.ok
            ? { ok: true, cantidadEliminada: resultado.cantidadEliminada }
            : guardado
    }

    function crearEvento(nombre, color, categoriaId = null) {
        if (!estadoPlantillas.ok) {
            return { ok: false, error: estadoPlantillas.error }
        }

        if (categoriaId && (!estadoCategorias.ok || !estadoCategorias.categorias.some(categoria => categoria.id === categoriaId))) {
            return { ok: false, error: "La categoría seleccionada no está disponible." }
        }

        const resultado = crearPlantillaEvento(nombre, color, categoriaId)

        if (resultado.ok) {
            return confirmarCambio([...plantillas, resultado.plantilla])
        }

        return resultado
    }

    function actualizarEvento(id, nombre, color, categoriaId = null) {
        if (!estadoPlantillas.ok) {
            return { ok: false, error: estadoPlantillas.error }
        }

        if (categoriaId && (!estadoCategorias.ok || !estadoCategorias.categorias.some(categoria => categoria.id === categoriaId))) {
            return { ok: false, error: "La categoría seleccionada no está disponible." }
        }

        const resultado = actualizarPlantillaEvento(plantillas, id, nombre, color, categoriaId)

        if (resultado.ok) {
            return confirmarCambio(resultado.plantillas)
        }

        return resultado
    }

    function guardarColeccionCategorias(nuevasCategorias) {
        const guardado = guardarCategorias(nuevasCategorias)
        if (!guardado.ok) return guardado
        cambiarEstadoCategorias({ ok: true, categorias: nuevasCategorias })
        return { ok: true }
    }

    function crearCategoriaNueva(nombre) {
        if (!estadoCategorias.ok) return { ok: false, error: estadoCategorias.error }
        const resultado = crearCategoria(nombre)
        if (!resultado.ok) return resultado
        return guardarColeccionCategorias([...estadoCategorias.categorias, resultado.categoria])
    }

    function actualizarCategoriaExistente(id, nombre) {
        if (!estadoCategorias.ok) return { ok: false, error: estadoCategorias.error }
        const resultado = actualizarCategoria(estadoCategorias.categorias, id, nombre)
        if (!resultado.ok) return resultado
        return guardarColeccionCategorias(resultado.categorias)
    }

    function eliminarCategoriaExistente(id) {
        if (!estadoCategorias.ok || !estadoPlantillas.ok) return { ok: false, error: "No se pudieron cargar las categorías o los eventos guardados." }
        const resultado = eliminarCategoria(estadoCategorias.categorias, id)
        if (!resultado.ok) return resultado
        const eventosActualizados = plantillas.map(plantilla => {
            if (plantilla.categoriaId !== id) return plantilla
            const actualizado = { ...plantilla }
            delete actualizado.categoriaId
            return actualizado
        })
        const guardadoCategorias = guardarCategorias(resultado.categorias)
        if (!guardadoCategorias.ok) return guardadoCategorias
        const guardadoEventos = guardarPlantillasEventos(eventosActualizados)
        if (!guardadoEventos.ok) {
            guardarCategorias(estadoCategorias.categorias)
            return guardadoEventos
        }
        cambiarEstadoCategorias({ ok: true, categorias: resultado.categorias })
        cambiarEstadoPlantillas({ ok: true, plantillas: eventosActualizados })
        return { ok: true }
    }

    function eliminarEvento(id) {
        if (!estadoPlantillas.ok) {
            return { ok: false, error: estadoPlantillas.error }
        }

        if (!estadoRegistro.datos.ok) {
            return {
                ok: false,
                error: "No se puede comprobar si hay registros vinculados porque los registros guardados no se pudieron cargar."
            }
        }

        if (!estadoPlanes.ok) {
            return {
                ok: false,
                error: "No se puede comprobar si hay planes vinculados porque los planes guardados no se pudieron cargar."
            }
        }

        if (!estadoPlantillasPlan.ok) {
            return {
                ok: false,
                error: "No se puede comprobar si hay plantillas de planificación vinculadas porque no se pudieron cargar."
            }
        }

        if (estadoPlantillasPlan.plantillas.some(plantilla => plantilla.actividades.some(actividad => actividad.eventoId === id))) {
            return {
                ok: false,
                error: "No se puede eliminar esta plantilla porque está vinculada a una plantilla de planificación."
            }
        }

        if (estadoPlanes.planes.some(plan => plan.eventoId === id)) {
            return {
                ok: false,
                error: "No se puede eliminar esta plantilla porque está vinculada a uno o más planes."
            }
        }

        if (estadoRegistro.registros.some(registro => registro.eventoId === id)) {
            return {
                ok: false,
                error: "No se puede eliminar esta plantilla porque está vinculada a uno o más registros."
            }
        }

        const resultado = eliminarPlantillaEvento(plantillas, id)

        if (resultado.ok) {
            return confirmarCambio(resultado.plantillas)
        }

        return resultado
    }

    return (
        <ProveedorReloj activo={estadoRegistro.registrosActivos.length > 0}>
        <main className={esVistaFocus
            ? "app-shell app-shell-focus"
            : vistaPrincipal === "plantillas-plan"
                ? "app-shell app-shell-planificaciones"
                : vistaPrincipal === "analitica" ? "app-shell app-shell-analitica"
                    : vistaPrincipal === "historial" ? "app-shell app-shell-historial"
                        : vistaPrincipal === "tareas" ? "app-shell app-shell-tareas" : "app-shell"}>
            <header className="app-header">
                <div className="app-brand-group">
                    <h1 className="app-brand">Focus</h1>
                    <p className="app-description">
                        Registrá lo que ocurrió, consultá cuánto duró y planificá lo que sigue. Guardá actividades reutilizables en Eventos y secuencias en Planificaciones.
                    </p>
                </div>
                <div className="app-header-actions">
                    <button
                        type="button"
                        className="app-theme-toggle"
                        aria-label={`Cambiar a tema ${tema === "oscuro" ? "claro" : "oscuro"}`}
                        onClick={() => cambiarTema(actual => actual === "oscuro" ? "claro" : "oscuro")}
                    >
                        <span aria-hidden="true">{tema === "oscuro" ? "☀" : "☾"}</span>
                        {tema === "oscuro" ? "Claro" : "Oscuro"}
                    </button>
                </div>
            </header>

            <div className={esVistaFocus
                ? "app-content app-content-focus"
                : vistaPrincipal === "plantillas-plan"
                    ? "app-content app-content-planificaciones"
                    : vistaPrincipal === "analitica" ? "app-content app-content-analitica"
                        : vistaPrincipal === "historial" ? "app-content app-content-historial"
                            : vistaPrincipal === "tareas" ? "app-content app-content-tareas" : "app-content"}>
                <CalendarioDiario
                    ref={calendarioRef}
                    key={fechaCalendarioSolicitada.version}
                    registros={estadoRegistro.registros}
                    eventos={plantillas}
                    tareas={tareasDeTrabajo}
                    planes={estadoPlanes.ok ? estadoPlanes.planes : []}
                    recurrencias={estadoRecurrencias.ok ? estadoRecurrencias.reglas : []}
                    fechaInicial={fechaCalendarioSolicitada.fecha}
                    planesDisponibles={estadoPlanes.ok && estadoRecurrencias.ok}
                    ahora={estadoRegistro.ahora}
                    onCrearRegistro={estadoRegistro.crearManual}
                    onEditarRegistro={estadoRegistro.editarFinalizado}
                    onEliminarRegistro={estadoRegistro.eliminarFinalizado}
                    onCrearPlan={crearPlanificacion}
                    onCrearRecurrencia={crearRecurrenciaPlanificacion}
                    onActualizarPlan={actualizarPlanificacion}
                    onEliminarPlan={eliminarPlanificacion}
                    onEliminarRecurrencia={eliminarRecurrenciaPlanificacion}
                    onEliminarAplicacionPlan={eliminarAplicacionPlanificacion}
                    onMoverAplicacionPlan={moverAplicacionPlanificacion}
                    seguimientoPlanificacion={seguimientoPlanificacion}
                    onIniciarSesionFocus={iniciarFocusPlanificado}
                />

                <aside className="panel-herramientas" aria-label="Panel de herramientas">
                    <nav className="app-navigation" aria-label="Secciones de Focus">
                        <button
                            type="button"
                            aria-pressed={vistaPrincipal === "calendario"}
                            onClick={() => cambiarVistaPrincipal("calendario")}
                        >
                            Calendario
                        </button>
                        <button
                            type="button"
                            aria-pressed={vistaPrincipal === "focus"}
                            onClick={() => cambiarVistaPrincipal("focus")}
                        >
                            Focus
                        </button>
                        <button
                            type="button"
                            aria-pressed={vistaPrincipal === "historial"}
                            onClick={() => cambiarVistaPrincipal("historial")}
                        >
                            Historial
                        </button>
                        <button
                            type="button"
                            aria-pressed={vistaPrincipal === "eventos"}
                            onClick={() => cambiarVistaPrincipal("eventos")}
                        >
                            Eventos
                        </button>
                        <button
                            type="button"
                            aria-pressed={vistaPrincipal === "plantillas-plan"}
                            onClick={() => cambiarVistaPrincipal("plantillas-plan")}
                        >
                            Planificaciones
                        </button>
                        <button
                            type="button"
                            aria-pressed={vistaPrincipal === "analitica"}
                            onClick={() => cambiarVistaPrincipal("analitica")}
                        >
                            Analítica
                        </button>
                        <button
                            type="button"
                            aria-pressed={vistaPrincipal === "tareas"}
                            onClick={() => cambiarVistaPrincipal("tareas")}
                        >
                            Tareas
                        </button>
                    </nav>
                    <div className="panel-herramientas-contenido">
                        <PanelSeguimientoPlanificacion
                            seguimiento={seguimientoPlanificacion}
                            planes={planesSeguimiento}
                            eventos={plantillas}
                            onCrearPlan={crearPlanEnSeguimiento}
                            onCrearRecurrencia={crearRecurrenciaEnSeguimiento}
                            onActualizarPlan={editarPlanEnSeguimiento}
                            onEliminarPlan={eliminarPlanEnSeguimiento}
                            onEliminarRecurrencia={plan => eliminarRecurrenciaPlanificacion(
                                plan.idRecurrencia, plan.fechaRecurrencia, "solo"
                            )}
                            onReordenar={reordenarPlanesEnSeguimiento}
                        />
                        <div hidden={vistaPrincipal !== "calendario"}>
                            <>
                                <section className="acciones-calendario-rapidas" role="group" aria-label="Acciones principales">
                                    <h2 id="titulo-acciones-calendario">Crear</h2>
                                    <button
                                        type="button"
                                        className="accion-calendario-registro"
                                        disabled={!estadoRegistro.datos.ok}
                                        onClick={evento => solicitarAccionCalendario("registro", evento)}
                                    >
                                        Nuevo registro
                                    </button>
                                    <button
                                        type="button"
                                        className="accion-calendario-plan"
                                        disabled={!estadoPlanes.ok}
                                        onClick={evento => solicitarAccionCalendario("plan", evento)}
                                    >
                                        Planificar actividad
                                    </button>
                                </section>
                                <section className="registro-panel" aria-labelledby="titulo-registro">
                                    {vistaPrincipal === "calendario" && (
                                        <EstadosRegistros
                                            estadoRegistro={estadoRegistro}
                                            eventos={plantillas}
                                            tareas={tareasDeTrabajo}
                                        />
                                    )}
                                </section>
                            </>
                        </div>
                        <div hidden={!esVistaFocus}>
                            <VistaFocus
                                estadoRegistro={estadoRegistro}
                                vistaActiva={esVistaFocus}
                                eventos={plantillas}
                                tareas={tareasDeTrabajo}
                                onCrearTarea={crearTareaNueva}
                                onActualizarTarea={actualizarTareaExistente}
                                onCambiarDestinoTarea={cambiarDestinoTareaExistente}
                                onReordenarTarea={reordenarTareaFocus}
                                onPosponerTarea={posponerTareaFocus}
                                onEstadoSesionChange={actualizarEstadoSesionFocus}
                                onRegistrarInicioPlanificado={iniciar => { inicioFocusPlanificadoRef.current = iniciar }}
                                onPlantillasChange={publicarPlantillasFocus}
                            />
                        </div>
                        <div hidden={vistaPrincipal !== "eventos"}>
                            <BibliotecaCategorias
                                categorias={estadoCategorias.ok ? estadoCategorias.categorias : []}
                                errorCarga={estadoCategorias.ok ? "" : estadoCategorias.error}
                                onCrear={crearCategoriaNueva}
                                onActualizar={actualizarCategoriaExistente}
                                onEliminar={eliminarCategoriaExistente}
                            />
                            <BibliotecaEventos
                                plantillas={plantillas}
                                categorias={estadoCategorias.ok ? estadoCategorias.categorias : []}
                                errorCategorias={estadoCategorias.ok ? "" : estadoCategorias.error}
                                errorCarga={estadoPlantillas.ok ? "" : estadoPlantillas.error}
                                onCrear={crearEvento}
                                onActualizar={actualizarEvento}
                                onEliminar={eliminarEvento}
                            />
                        </div>
                        <div hidden={vistaPrincipal !== "plantillas-plan"}>
                            <BibliotecaPlantillasPlanificacion
                                plantillas={estadoPlantillasPlan.ok ? estadoPlantillasPlan.plantillas : []}
                        plantillasFocus={estadoPlantillasFocus.ok ? estadoPlantillasFocus.plantillas : []}
                                eventos={plantillas}
                                errorCarga={estadoPlantillasPlan.ok ? "" : estadoPlantillasPlan.error}
                                onCrear={crearPlantillaPlan}
                                onActualizar={actualizarPlantillaPlan}
                                onEliminar={eliminarPlantillaPlan}
                                onAplicar={aplicarPlantillaPlan}
                            />
                        </div>
                        <div hidden={vistaPrincipal !== "analitica"}>
                            <AnaliticaRegistros
                                registros={estadoRegistro.registros}
                                eventos={plantillas}
                                categorias={estadoCategorias.ok ? estadoCategorias.categorias : []}
                                categoriasDisponibles={estadoCategorias.ok}
                                errorCategorias={estadoCategorias.ok ? "" : estadoCategorias.error}
                                ahora={estadoRegistro.ahora}
                                datosDisponibles={estadoRegistro.datos.ok}
                                errorCarga={estadoRegistro.datos.error}
                            />
                        </div>
                        <div hidden={vistaPrincipal !== "historial"}>
                            <HistorialRegistros
                                registros={estadoRegistro.registros}
                                ahora={estadoRegistro.ahora}
                                tareas={tareasDeTrabajo}
                                eventos={plantillas}
                                datosDisponibles={estadoRegistro.datos.ok}
                                errorCarga={estadoRegistro.datos.error}
                                onEditar={estadoRegistro.editarFinalizado}
                                onEliminar={estadoRegistro.eliminarFinalizado}
                            />
                        </div>
                        <div hidden={vistaPrincipal !== "tareas"}>
                            <BibliotecaTareas
                                tareas={tareasDeTrabajo}
                                objetivos={objetivos}
                                registros={estadoRegistro.registros}
                                ahora={estadoRegistro.ahora}
                                errorCarga={estadoTareas.ok ? "" : estadoTareas.error}
                                tareaActivaId={estadoFocusTareas.tareaActivaId}
                                sesionFocusActiva={estadoFocusTareas.activa}
                                onCrear={crearTareaNueva}
                                onCrearObjetivo={crearObjetivoNuevo}
                                onActualizarObjetivo={actualizarObjetivoExistente}
                                onActualizar={actualizarTareaExistente}
                                onEliminar={eliminarTareaExistente}
                                onCambiarDestino={cambiarDestinoTareaExistente}
                                onReordenar={(id, direccion, tareaActivaId) => reordenarTareaFocus(id, direccion, tareaActivaId)}
                                onReordenarArbol={reordenarTareaArbol}
                            />
                        </div>
                    </div>
                </aside>
            </div>
        </main>
        </ProveedorReloj>
    )
}
