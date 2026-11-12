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
    eliminarPlantillaEvento,
    marcarPlantillaEventoUsada,
    normalizarPlantillaEvento,
    obtenerCategoriasPlantillaEvento
} from "../domain/eventos/eventos.js"
import {
    cargarPlantillasEventos,
    guardarPlantillasEventos
} from "../domain/eventos/persistenciaEventos.js"
import { crearCategoria, actualizarCategoria, eliminarCategoria } from "../domain/categorias/categorias.js"
import { cargarCategorias, guardarCategorias } from "../domain/categorias/persistenciaCategorias.js"
import { crearPlan, actualizarPlan, eliminarAplicacionPlan, eliminarPlan, eliminarPlanesDePlantilla, compararPlanesPorSeguimiento, validarCompatibilidadPlanesFocus } from "../domain/planificacion/planes.js"
import { cargarPlanes, guardarPlanes, eliminarPlanInvalido, CLAVE_PLANES } from "../domain/planificacion/persistenciaPlanes.js"
import { formatearFechaISO, leerFechaISO } from "../domain/tiempo/FechaCalendario.js"
import { cargarRecurrencias, guardarRecurrencias, crearReglaRecurrencia, crearReglasRecurrenciaPlantilla, cambiarRecurrencia, eliminarRecurrencia, eliminarRecurrenciasDePlantilla, generarAparicionesRecurrencia, eliminarRecurrenciaInvalida, CLAVE_RECURRENCIAS } from "../domain/planificacion/recurrencias.js"
import {
    aplicarPlantillaPlanificacion,
    actualizarPlantillaPlanificacion,
    crearPlantillaPlanificacion,
    eliminarPlantillaPlanificacion,
    yaAplicadaEnFecha
} from "../domain/planificacion/plantillasPlanificacion.js"
import {
    cargarPlantillasPlanificacion,
    guardarPlantillasPlanificacion,
    eliminarPlantillaPlanificacionInvalida,
    eliminarColeccionPlantillasPlanificacionCorrupta,
    CLAVE_PLANTILLAS_PLANIFICACION
} from "../domain/planificacion/persistenciaPlantillasPlanificacion.js"
import { CLAVE_SEGUIMIENTO_PLANIFICACION } from "../domain/planificacion/persistenciaSeguimientoPlanificacion.js"
import { cargarUsosPlantillasPlanificacion, guardarUsosPlantillasPlanificacion, eliminarUsosPlantillasPlanificacionCorruptos, plantillaUsadaEnFecha } from "../domain/planificacion/persistenciaUsosPlantillas.js"
import { ejecutarTransaccionAlmacenamiento } from "../domain/planificacion/transaccionAlmacenamiento.js"
import { BibliotecaPlantillasPlanificacion } from "../features/planificacion/BibliotecaPlantillasPlanificacion.jsx"
import { useSeguimientoPlanificacion } from "../features/planificacion/usoSeguimientoPlanificacion.js"
import { PanelSeguimientoPlanificacion } from "../features/planificacion/SeguimientoPlanificacion.jsx"
import { BibliotecaTareas } from "../features/tareas/BibliotecaTareas.jsx"
import { crearTarea, crearObjetivo, actualizarObjetivo, cambiarEstadoRama, descendientesDe, obtenerRutaTarea, actualizarTarea, cambiarDestinoTarea, eliminarTarea, moverTareaEnArbol, moverTareaEnCola, ordenarTareasFocus, ordenarTareasBacklog, moverTareaEnBacklog, posponerTareaEnCola, sincronizarEstadoTareasFocus } from "../domain/tareas/tareas.js"
import { cargarTareas, guardarTareas } from "../domain/tareas/persistenciaTareas.js"
import { cargarPlantillasFocus, cargarHistorialFocus, cargarSesionActivaFocus, eliminarSesionFocusInvalida, eliminarPlantillaFocusInvalida, CLAVE_HISTORIAL_FOCUS, CLAVE_SESION_ACTIVA_FOCUS, CLAVE_PLANTILLAS_FOCUS } from "../domain/focus/persistenciaFocus.js"
import {
    cargarOrdenPlantillasEventos,
    CLAVE_ORDEN_PLANTILLAS_EVENTOS
} from "../domain/eventos/ordenPlantillasEventos.js"

export function App() {
    const [vistaPrincipal, cambiarVistaPrincipal] = useState("calendario")
    const [tema, cambiarTema] = useState(() => {
        try {
            return localStorage.getItem("focus.tema.v1") === "claro" ? "claro" : "oscuro"
        } catch {
            return "oscuro"
        }
    })
    const [ordenPlantillasEventos, cambiarOrdenPlantillasEventos] = useState(cargarOrdenPlantillasEventos)
    const [estadoPlantillas, cambiarEstadoPlantillas] = useState(cargarPlantillasEventos)
    const [estadoCategorias, cambiarEstadoCategorias] = useState(cargarCategorias)
    const [estadoPlanes, cambiarEstadoPlanes] = useState(cargarPlanes)
    const [estadoRecurrencias, cambiarEstadoRecurrencias] = useState(cargarRecurrencias)
    const [estadoPlantillasPlan, cambiarEstadoPlantillasPlan] = useState(cargarPlantillasPlanificacion)
    const [estadoUsosPlantillasPlan, cambiarEstadoUsosPlantillasPlan] = useState(cargarUsosPlantillasPlanificacion)
    const [estadoTareas, cambiarEstadoTareas] = useState(cargarTareas)
    const [estadoPlantillasFocus, cambiarEstadoPlantillasFocus] = useState(cargarPlantillasFocus)
    const [diagnosticoHistorialFocus, cambiarDiagnosticoHistorialFocus] = useState(cargarHistorialFocus)
    const [diagnosticoSesionFocus, cambiarDiagnosticoSesionFocus] = useState(cargarSesionActivaFocus)
    const publicarPlantillasFocus = useCallback(plantillasFocus => {
        cambiarEstadoPlantillasFocus(actual => actual.plantillas === plantillasFocus
            ? actual
            : { ...cargarPlantillasFocus(), plantillas: plantillasFocus })
    }, [])
    const [estadoFocusTareas, cambiarEstadoFocusTareas] = useState({ activa: false, tareaActivaId: null })
    const [fechaCalendarioSolicitada, cambiarFechaCalendarioSolicitada] = useState({ fecha: null, version: 0 })
    const calendarioRef = useRef(null)
    const inicioFocusPlanificadoRef = useRef(null)
    const estadoRegistro = useRegistro({ onInicioConEvento: registrarUsoEvento })
    const seguimientoPlanificacion = useSeguimientoPlanificacion(estadoRegistro, estadoTareas.ok ? estadoTareas.tareas : [])
    const objetivos = estadoTareas.ok ? estadoTareas.tareas.filter(tarea => tarea.tipo === "objetivo") : []
    const tareasBase = estadoTareas.ok ? estadoTareas.tareas.filter(tarea => tarea.tipo !== "objetivo") : []
    const tareasDeTrabajo = estadoTareas.ok
        ? tareasBase.map(tarea => ({
            ...tarea,
            rutaNombre: obtenerRutaTarea(tareasBase, objetivos, tarea.id)
        }))
        : []
    const plantillas = estadoPlantillas.ok ? estadoPlantillas.plantillas : []
    const problemasPlanes = estadoPlanes.ok
        ? (estadoPlanes.problemas ?? []).map(problema => ({ ...problema, tipo: "plan" }))
        : (estadoPlanes.problemas?.length
            ? estadoPlanes.problemas.map(problema => ({ ...problema, tipo: "plan" }))
            : [{ tipo: "plan", indice: null, titulo: "Planes guardados", detalle: estadoPlanes.error }])
    const problemasRevision = [
        ...(estadoRegistro.datos.problemas ?? []).map(problema => ({ ...problema, tipo: "registro" })),
        ...problemasPlanes,
        ...(estadoRecurrencias.ok
            ? (estadoRecurrencias.problemas ?? []).map(problema => ({ ...problema, tipo: "recurrencia" }))
            : [{ tipo: "recurrencia", indice: null, titulo: "Recurrencias", detalle: estadoRecurrencias.error }]),
        ...(estadoPlantillasPlan.ok
            ? (estadoPlantillasPlan.problemas ?? []).map(problema => ({ ...problema, tipo: "plantilla-plan" }))
            : [{ tipo: "plantilla-plan", indice: null, titulo: "Plantillas de planificación", detalle: estadoPlantillasPlan.error }]),
        ...(!estadoUsosPlantillasPlan.ok
            ? [{ tipo: "uso-plantilla", indice: null, titulo: "Usos de plantillas de planificación", detalle: estadoUsosPlantillasPlan.error }]
            : []),
        ...(diagnosticoHistorialFocus.ok
            ? (diagnosticoHistorialFocus.problemas ?? [])
            : [{ tipo: "focus-historial", indice: null, titulo: "Historial de sesiones Focus", detalle: diagnosticoHistorialFocus.error }]),
        ...(estadoPlantillasFocus.ok
            ? (estadoPlantillasFocus.problemas ?? [])
            : [{ tipo: "focus-plantilla", indice: null, titulo: "Plantillas Focus", detalle: estadoPlantillasFocus.error }]),
        ...(!diagnosticoSesionFocus.ok
            ? [{ tipo: "focus-activa", indice: null, titulo: "Sesión Focus activa", detalle: diagnosticoSesionFocus.error }]
            : [])
    ]
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

    function registrarUsoEvento(id, instante) {
        if (!estadoPlantillas.ok) return
        const resultado = marcarPlantillaEventoUsada(estadoPlantillas.plantillas, id, instante)
        if (!resultado.ok) return
        const guardado = guardarPlantillasEventos(resultado.plantillas)
        if (guardado.ok) cambiarEstadoPlantillas({ ok: true, plantillas: resultado.plantillas })
    }

    function cambiarOrdenEventos(orden) {
        cambiarOrdenPlantillasEventos(orden)
        try {
            localStorage.setItem(CLAVE_ORDEN_PLANTILLAS_EVENTOS, orden)
        } catch {
            // La preferencia queda activa durante esta sesión aunque no se pueda guardar.
        }
    }

    function iniciarFocusPlanificado(plan) {
        if (plan?.tipoPlanificacion !== "focus" || !plan.configuracionFocus) return { ok: false, error: "Este plan no contiene una sesión Focus válida." }
        if (typeof inicioFocusPlanificadoRef.current !== "function") return { ok: false, error: "Focus todavía no está disponible para iniciar la sesión." }
        const evento = plantillas.find(item => item.id === plan.eventoId) ?? null
        const tarea = estadoTareas.ok ? estadoTareas.tareas.find(item => item.id === plan.tareaId) ?? (plan.tareaId ? { id: plan.tareaId, nombre: plan.tareaNombre } : null) : null
        const actividadPuntual = plan.origenPuntual ? { nombre: plan.nombre, categoriaIds: plan.categoriaIds ?? [] } : null
        const inicio = registrarUsoPlantillaPlan(plan, () => inicioFocusPlanificadoRef.current({ ...plan.configuracionFocus, evento, tarea, actividadPuntual })
            ? { ok: true }
            : { ok: false, error: "No se pudo iniciar la sesión Focus. Revisá si ya hay otra sesión activa." })
        if (!inicio.ok) return inicio
        cambiarVistaPrincipal("focus")
        return { ok: true }
    }

    function registrarUsoPlantillaPlan(plan, iniciarRegistro) {
        if (!plan?.plantillaOrigenId || !plan?.idAplicacionPlantilla) return iniciarRegistro()
        if (!estadoUsosPlantillasPlan.ok) return { ok: false, error: estadoUsosPlantillasPlan.error }
        const fecha = plan.fechaAplicacion ?? formatearFechaISO(plan.inicio)
        if (plantillaUsadaEnFecha(estadoUsosPlantillasPlan.usos, plan.plantillaOrigenId, fecha)) {
            return { ok: false, error: "Esta plantilla ya se usó en esa fecha. Podés seguir usando otra plantilla, incluso si coincide en horario." }
        }
        const uso = {
            plantillaId: plan.plantillaOrigenId,
            fecha,
            idAplicacionPlantilla: plan.idAplicacionPlantilla,
            usadaEn: new Date().toISOString()
        }
        const usosPrevios = estadoUsosPlantillasPlan.usos
        const usosNuevos = [...usosPrevios, uso]
        const guardado = guardarUsosPlantillasPlanificacion(usosNuevos)
        if (!guardado.ok) return guardado
        const resultado = iniciarRegistro()
        if (resultado.ok) {
            cambiarEstadoUsosPlantillasPlan({ ok: true, usos: usosNuevos })
            return resultado
        }
        const revertido = guardarUsosPlantillasPlanificacion(usosPrevios)
        if (!revertido.ok) {
            cambiarEstadoUsosPlantillasPlan(cargarUsosPlantillasPlanificacion())
            return { ...resultado, error: `${resultado.error} Además, no se pudo revertir el uso reservado de la plantilla: ${revertido.error}` }
        }
        return resultado
    }

    const seguimientoParaCalendario = {
        ...seguimientoPlanificacion,
        empezar(planId, modo, planes, eventos, tareas) {
            const seleccionado = planes.find(plan => plan.id === planId)
            if (!seleccionado?.plantillaOrigenId) {
                return seguimientoPlanificacion.empezar(planId, modo, planes, eventos, tareas)
            }
            const inicio = () => seguimientoPlanificacion.empezar(planId, modo, planes, eventos, tareas)
            return registrarUsoPlantillaPlan(seleccionado, inicio)
        }
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
        return seguimientoPlanificacion.sincronizarPlanes(visibles, plantillas, estadoTareas.ok ? estadoTareas.tareas : [])
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
        cambiarEstadoPlanes(cargarPlanes())
        return { ok: true }
    }

    function eliminarPlanInvalidoDesdeHistorial(indice) {
        const resultado = eliminarPlanInvalido(indice)
        if (resultado.ok) cambiarEstadoPlanes(cargarPlanes())
        return resultado
    }

    function eliminarPlanesCorruptosDesdeHistorial() {
        try {
            localStorage.removeItem(CLAVE_PLANES)
            cambiarEstadoPlanes(cargarPlanes())
            return { ok: true }
        } catch { return { ok: false, error: "No se pudieron eliminar los datos de planes corruptos." } }
    }

    function eliminarProblemaRevision(problema) {
        if (problema.tipo === "registro") return problema.indice === null
            ? estadoRegistro.eliminarDatosCorruptos()
            : estadoRegistro.eliminarInvalido(problema.indice)
        if (problema.tipo === "plan") return problema.indice === null
            ? eliminarPlanesCorruptosDesdeHistorial()
            : eliminarPlanInvalidoDesdeHistorial(problema.indice)
        if (problema.tipo === "recurrencia") {
            if (problema.indice === null) {
                try { localStorage.removeItem(CLAVE_RECURRENCIAS); cambiarEstadoRecurrencias(cargarRecurrencias()); return { ok: true } }
                catch { return { ok: false, error: "No se pudieron eliminar las recurrencias corruptas." } }
            }
            const resultado = eliminarRecurrenciaInvalida(problema.indice)
            if (resultado.ok) cambiarEstadoRecurrencias(cargarRecurrencias())
            return resultado
        }
        if (problema.tipo === "plantilla-plan") {
            if (problema.indice === null) {
                const resultado = eliminarColeccionPlantillasPlanificacionCorrupta()
                if (resultado.ok) cambiarEstadoPlantillasPlan(cargarPlantillasPlanificacion())
                return resultado
            }
            const resultado = eliminarPlantillaPlanificacionInvalida(problema.indice)
            if (resultado.ok) cambiarEstadoPlantillasPlan(cargarPlantillasPlanificacion())
            return resultado
        }
        if (problema.tipo === "uso-plantilla") {
            const resultado = eliminarUsosPlantillasPlanificacionCorruptos()
            if (resultado.ok) cambiarEstadoUsosPlantillasPlan(cargarUsosPlantillasPlanificacion())
            return resultado
        }
        if (problema.tipo === "focus-historial") {
            if (problema.indice === null) {
                try { localStorage.removeItem(CLAVE_HISTORIAL_FOCUS); cambiarDiagnosticoHistorialFocus(cargarHistorialFocus()); return { ok: true } }
                catch { return { ok: false, error: "No se pudo eliminar el historial Focus corrupto." } }
            }
            const resultado = eliminarSesionFocusInvalida(problema.indice, problema.firma)
            if (resultado.ok) cambiarDiagnosticoHistorialFocus(cargarHistorialFocus())
            return resultado
        }
        if (problema.tipo === "focus-plantilla") {
            if (problema.indice === null) {
                try { localStorage.removeItem(CLAVE_PLANTILLAS_FOCUS); cambiarEstadoPlantillasFocus(cargarPlantillasFocus()); return { ok: true } }
                catch { return { ok: false, error: "No se pudieron eliminar las plantillas Focus corruptas." } }
            }
            const resultado = eliminarPlantillaFocusInvalida(problema.indice)
            if (resultado.ok) cambiarEstadoPlantillasFocus(cargarPlantillasFocus())
            return resultado
        }
        if (problema.tipo === "focus-activa") {
            try { localStorage.removeItem(CLAVE_SESION_ACTIVA_FOCUS); cambiarDiagnosticoSesionFocus(cargarSesionActivaFocus()); return { ok: true } }
            catch { return { ok: false, error: "No se pudo eliminar la sesión Focus activa corrupta." } }
        }
        return { ok: false, error: "No se reconoce este tipo de dato inválido." }
    }

    function confirmarRecurrencias(nuevas) {
        const guardado = guardarRecurrencias(nuevas)
        if (!guardado.ok) return guardado
        const sincronizacion = sincronizarSeguimiento(undefined, nuevas)
        if (!sincronizacion.ok) {
            guardarRecurrencias(estadoRecurrencias.ok ? estadoRecurrencias.reglas : [])
            return sincronizacion
        }
        cambiarEstadoRecurrencias(cargarRecurrencias())
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
                const tarea = estadoTareas.ok ? estadoTareas.tareas.find(item => item.id === aparicion.tareaId) : null
                const excepcion = {
                    id: aparicion.id,
                    nombre: aparicion.nombre,
                    eventoId: aparicion.eventoId ?? null,
                    colorEvento: aparicion.colorEvento,
                    ...(aparicion.tareaId ? { tareaId: aparicion.tareaId, tareaNombre: tarea?.nombre ?? aparicion.tareaNombre } : {}),
                    inicio: aparicion.inicio.toISOString(),
                    fin: aparicion.fin.toISOString(),
                    ordenSeguimiento: ordenPorId.get(aparicion.id)
                }
                if (aparicion.eventoId && !evento) return regla
                if (aparicion.tareaId && !tarea) return regla
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
            plantillas,
            estadoTareas.ok ? estadoTareas.tareas : []
        )
        if (!sincronizacion.ok) {
            guardarPlanes(planesBase)
            guardarRecurrencias(reglasBase)
            return sincronizacion
        }
            cambiarEstadoPlanes(cargarPlanes())
        cambiarEstadoRecurrencias(cargarRecurrencias())
        return { ok: true }
    }

    function crearPlanEnSeguimiento(cambios, indiceInsercion = 0) {
        if (!estadoPlanes.ok || !seguimientoPlanificacion.estado) return { ok: false, error: "No hay una secuencia activa para editar." }
        const sesion = seguimientoPlanificacion.estado
        const fecha = new Date(sesion.secuencia[sesion.indiceActual].inicioPrevisto)
        if (sesion.tipoSeguimiento === "cronometro" && cambios.tipoSecuencial) {
            const evento = cambios.eventoId ? plantillas.find(item => item.id === cambios.eventoId) : null
            const tarea = cambios.tareaId && estadoTareas.ok ? estadoTareas.tareas.find(item => item.id === cambios.tareaId) : null
            const creado = crearPlan({ nombre: evento?.nombre ?? tarea?.nombre ?? cambios.actividadPuntual?.nombre ?? cambios.nombre, evento, tarea, actividadPuntual: cambios.actividadPuntual, inicio: fecha, fin: new Date(fecha.getTime() + 1000) })
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
        const planBase = planesSeguimiento.find(item => item.id === seguimientoPlanificacion.estado.secuencia[0]?.planId)
        const plantillaOrigenId = cambios.plantillaOrigenId ?? planBase?.plantillaOrigenId
        const plantillaOrigenNombre = cambios.plantillaOrigenNombre ?? planBase?.plantillaOrigenNombre
        const planConOrigen = {
            ...plan.plan,
            ...(plantillaOrigenId ? { plantillaOrigenId } : {}),
            ...(plantillaOrigenNombre ? { plantillaOrigenNombre } : {})
        }
        const creada = crearReglaRecurrencia(planConOrigen, cambios.diasSemana, cambios.fechaFin)
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
            const tarea = cambios.tareaId && estadoTareas.ok ? estadoTareas.tareas.find(item => item.id === cambios.tareaId) : null
            const resultadoSecuencial = actualizarPlan(estadoPlanes.planes, plan.id, {
                nombre: evento?.nombre ?? tarea?.nombre ?? cambios.actividadPuntual?.nombre ?? cambios.nombre, evento, tarea, actividadPuntual: cambios.actividadPuntual, inicio: plan.inicio, fin: plan.fin
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
        cambiarEstadoPlantillasPlan(cargarPlantillasPlanificacion())
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
        const ordenBacklog = destino === "backlog"
            ? estadoTareas.tareas.filter(tarea => tarea.tipo !== "objetivo" && (tarea.destino ?? "backlog") === "backlog")
                .reduce((maximo, tarea) => Math.max(maximo, tarea.ordenBacklog ?? 0), 0) + 1
            : null
        const padreId = ubicacion.padreId ?? ubicacion.objetivoId ?? null
        const ordenArbol = estadoTareas.tareas.filter(tarea => tarea.tipo !== "objetivo" && (tarea.padreId ?? tarea.objetivoId ?? null) === padreId)
            .reduce((maximo, tarea) => Math.max(maximo, tarea.ordenArbol ?? 0), 0) + 1
        const resultado = crearTarea(nombre, estado, undefined, undefined, destino, ordenFocus, { ...ubicacion, padreId, ordenArbol, ordenBacklog })
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

    function guardarOrdenColaFocus(idsOrdenados) {
        if (!estadoTareas.ok) return { ok: false, error: estadoTareas.error }
        const resultado = ordenarTareasFocus(estadoTareas.tareas, idsOrdenados, estadoFocusTareas.activa ? estadoFocusTareas.tareaActivaId : null)
        if (!resultado.ok) return resultado
        const guardado = confirmarTareas(resultado.tareas)
        return guardado.ok ? { ok: true, tareas: resultado.tareas } : guardado
    }

    function guardarOrdenBacklog(idsOrdenados) {
        if (!estadoTareas.ok) return { ok: false, error: estadoTareas.error }
        const resultado = ordenarTareasBacklog(estadoTareas.tareas, idsOrdenados)
        if (!resultado.ok) return resultado
        const guardado = confirmarTareas(resultado.tareas)
        return guardado.ok ? { ok: true, tareas: resultado.tareas } : guardado
    }

    function moverTareaBacklog(id, direccion) {
        if (!estadoTareas.ok) return { ok: false, error: estadoTareas.error }
        const resultado = moverTareaEnBacklog(estadoTareas.tareas, id, direccion)
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
        if (!estadoPlantillasPlan.ok || !estadoPlanes.ok || !estadoRecurrencias.ok || !estadoPlantillasFocus.ok) {
            return { ok: false, error: "No se pudieron revisar todos los vínculos de esta tarea; no se modificó ningún dato." }
        }
        if (estadoRegistro.registros.some(registro => registro.tareaId === id)) {
            return { ok: false, error: "No se puede eliminar esta tarea porque está vinculada a uno o más registros." }
        }
        if ((estadoPlantillasPlan.ok && estadoPlantillasPlan.plantillas.some(plantilla => plantilla.actividades.some(actividad => actividad.tareaId === id)))
            || (estadoPlanes.ok && estadoPlanes.planes.some(plan => plan.tareaId === id))
            || (estadoRecurrencias.ok && estadoRecurrencias.reglas.some(regla => regla.tareaId === id))
            || (estadoPlantillasFocus.ok && estadoPlantillasFocus.plantillas.some(plantilla => plantilla.configuracion?.tarea?.id === id))) {
            return { ok: false, error: "No se puede eliminar esta tarea porque está vinculada a una plantilla o plan. Quitá primero esos vínculos." }
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

    function eliminarPlantillaPlan(id, opciones = {}) {
        if (!estadoPlantillasPlan.ok) return { ok: false, error: estadoPlantillasPlan.error }
        const plantilla = estadoPlantillasPlan.plantillas.find(item => item.id === id)
        if (!plantilla) return { ok: false, error: "No se encontró la plantilla de planificación." }
        if (!opciones.alcance || opciones.alcance === "conservar") {
            const resultado = eliminarPlantillaPlanificacion(estadoPlantillasPlan.plantillas, id)
            if (!resultado.ok) return resultado
            return confirmarPlantillasPlan(resultado.plantillas)
        }
        if (!estadoPlanes.ok || !estadoRecurrencias.ok) {
            return { ok: false, error: "No se pudieron cargar planes y recurrencias; no se modificó ningún dato." }
        }
        const ahora = opciones.ahora instanceof Date ? opciones.ahora : new Date()
        const plantillasNuevas = eliminarPlantillaPlanificacion(estadoPlantillasPlan.plantillas, id)
        if (!plantillasNuevas.ok) return plantillasNuevas
        const planesNuevos = eliminarPlanesDePlantilla(estadoPlanes.planes, id, opciones.alcance, ahora)
        if (!planesNuevos.ok) return planesNuevos
        const recurrenciasNuevas = eliminarRecurrenciasDePlantilla(
            estadoRecurrencias.reglas,
            id,
            opciones.alcance,
            { ahora, idsLegado: opciones.idsRecurrenciasLegado ?? [], plantillaOrigenNombre: plantilla.nombre }
        )
        if (!recurrenciasNuevas.ok) return recurrenciasNuevas

        const sesion = seguimientoPlanificacion.estado
        if (sesion) {
            const idsEnSeguimiento = new Set(sesion.secuencia.map(item => item.planId))
            const seriesBorradas = new Set(recurrenciasNuevas.seriesAfectadas)
            const idsRecurrenciasOriginales = new Set(estadoRecurrencias.reglas
                .filter(regla => regla.plantillaOrigenId === id || (opciones.idsRecurrenciasLegado ?? []).includes(regla.id))
                .filter(regla => seriesBorradas.has(regla.idSerie ?? regla.id))
                .map(regla => regla.id))
            const planesEliminados = planesNuevos.eliminados
            const aparicionesSeguimientoAfectadas = planesSeguimiento.filter(plan => idsEnSeguimiento.has(plan.id)
                && ((plan.plantillaOrigenId === id && (opciones.alcance === "todas" || plan.inicio >= ahora))
                    || (plan.idRecurrencia && idsRecurrenciasOriginales.has(plan.idRecurrencia))))
            if (planesEliminados.some(plan => idsEnSeguimiento.has(plan.id)) || aparicionesSeguimientoAfectadas.length > 0) {
                return { ok: false, error: "No se pueden borrar planes que forman parte del seguimiento activo. Podés borrar solo la plantilla y conservar sus planes." }
            }
        }

        const guardado = ejecutarTransaccionAlmacenamiento([
            CLAVE_PLANTILLAS_PLANIFICACION,
            CLAVE_PLANES,
            CLAVE_RECURRENCIAS,
            CLAVE_SEGUIMIENTO_PLANIFICACION
        ], almacenamiento => {
            const plantillasGuardadas = guardarPlantillasPlanificacion(plantillasNuevas.plantillas, almacenamiento)
            if (!plantillasGuardadas.ok) return plantillasGuardadas
            const planesGuardados = guardarPlanes(planesNuevos.planes, almacenamiento)
            if (!planesGuardados.ok) return planesGuardados
            const recurrenciasGuardadas = guardarRecurrencias(recurrenciasNuevas.reglas, almacenamiento)
            if (!recurrenciasGuardadas.ok) return recurrenciasGuardadas
            const sincronizacion = sincronizarSeguimiento(planesNuevos.planes, recurrenciasNuevas.reglas)
            if (!sincronizacion.ok) return sincronizacion
            return { ok: true }
        })
        if (!guardado.ok) return guardado
        cambiarEstadoPlantillasPlan(cargarPlantillasPlanificacion())
        cambiarEstadoPlanes(cargarPlanes())
        cambiarEstadoRecurrencias(cargarRecurrencias())
        return { ok: true }
    }

    function aplicarPlantillaPlan(id, fecha, permitirDuplicado, horaInicioSegundos) {
        if (!estadoPlantillasPlan.ok || !estadoPlanes.ok) return { ok: false, error: "No se pudieron cargar las plantillas o planes guardados." }
        const plantilla = estadoPlantillasPlan.plantillas.find(item => item.id === id)
        if (!plantilla) return { ok: false, error: "No se encontró la plantilla de planificación." }
        if (yaAplicadaEnFecha(estadoPlanes.planes, id, fecha) && !permitirDuplicado) return { ok: false, duplicado: true }
        const resultado = aplicarPlantillaPlanificacion(plantilla, fecha, plantillas, {
            ahora: new Date(), horaInicioSegundos, tareas: estadoTareas.ok ? tareasDeTrabajo : []
        })
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
        const planConOrigen = cambios.plantillaOrigenId
            ? { ...resultadoPlan.plan, plantillaOrigenId: cambios.plantillaOrigenId,
                ...(cambios.plantillaOrigenNombre ? { plantillaOrigenNombre: cambios.plantillaOrigenNombre } : {}) }
            : resultadoPlan.plan
        const resultado = crearReglaRecurrencia(planConOrigen, cambios.diasSemana, cambios.fechaFin)
        if (!resultado.ok) return resultado
        return confirmarRecurrencias([...estadoRecurrencias.reglas, resultado.regla])
    }

    function crearRecurrenciaPlantillaPlanificacion(id, fechaTexto, diasSemana, fechaFin, horaInicioSegundos) {
        if (!estadoRecurrencias.ok || !estadoPlantillasPlan.ok || !estadoPlanes.ok) return { ok: false, error: "No se pudieron cargar las plantillas o recurrencias." }
        const plantilla = estadoPlantillasPlan.plantillas.find(item => item.id === id)
        const fecha = leerFechaISO(fechaTexto)
        if (!plantilla || !fecha) return { ok: false, error: "No se encontró la plantilla o la fecha de inicio no es válida." }
        const aplicacion = aplicarPlantillaPlanificacion(plantilla, fecha, plantillas, {
            ahora: new Date(), horaInicioSegundos, tareas: estadoTareas.ok ? tareasDeTrabajo : []
        })
        if (!aplicacion.ok) return aplicacion
        const resultado = crearReglasRecurrenciaPlantilla(aplicacion.planes, diasSemana, fechaFin)
        if (!resultado.ok) return resultado
        const guardado = confirmarRecurrencias([...estadoRecurrencias.reglas, ...resultado.reglas])
        return guardado.ok ? { ok: true, idSerie: resultado.idSerie } : guardado
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

    function crearEvento(nombre, color, categoriaIds = []) {
        if (!estadoPlantillas.ok) {
            return { ok: false, error: estadoPlantillas.error }
        }

        const ids = typeof categoriaIds === "string" ? [categoriaIds] : categoriaIds
        if (!Array.isArray(ids) || new Set(ids).size !== ids.length
            || ids.some(id => typeof id !== "string" || !id.trim())
            || ids.length && (!estadoCategorias.ok || ids.some(id => !estadoCategorias.categorias.some(categoria => categoria.id === id)))) {
            return { ok: false, error: "Una de las categorías seleccionadas no está disponible." }
        }

        const resultado = crearPlantillaEvento(nombre, color, ids)

        if (resultado.ok) {
            return confirmarCambio([...plantillas, resultado.plantilla])
        }

        return resultado
    }

    function actualizarEvento(id, nombre, color, categoriaIds = []) {
        if (!estadoPlantillas.ok) {
            return { ok: false, error: estadoPlantillas.error }
        }

        const ids = typeof categoriaIds === "string" ? [categoriaIds] : categoriaIds
        if (!Array.isArray(ids) || new Set(ids).size !== ids.length
            || ids.some(id => typeof id !== "string" || !id.trim())
            || ids.length && (!estadoCategorias.ok || ids.some(id => !estadoCategorias.categorias.some(categoria => categoria.id === id)))) {
            return { ok: false, error: "Una de las categorías seleccionadas no está disponible." }
        }

        const resultado = actualizarPlantillaEvento(plantillas, id, nombre, color, ids)

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
            const categoriaIds = obtenerCategoriasPlantillaEvento(plantilla)
            if (!categoriaIds.includes(id)) return normalizarPlantillaEvento(plantilla)
            const actualizado = normalizarPlantillaEvento(plantilla)
            const categoriasRestantes = categoriaIds.filter(categoriaId => categoriaId !== id)
            if (categoriasRestantes.length) actualizado.categoriaIds = categoriasRestantes
            else delete actualizado.categoriaIds
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

        if (!estadoRecurrencias.ok || !estadoPlantillasFocus.ok) return { ok: false, error: "No se pudieron revisar todos los vínculos de esta plantilla; no se modificó ningún dato." }
        if (estadoRecurrencias.reglas.some(regla => regla.eventoId === id)) {
            return { ok: false, error: "No se puede eliminar esta plantilla porque está vinculada a una recurrencia." }
        }
        if (estadoPlantillasFocus.plantillas.some(plantilla => plantilla.configuracion?.evento?.id === id)) {
            return { ok: false, error: "No se puede eliminar esta plantilla porque está vinculada a una plantilla de sesión Focus." }
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
        <ProveedorReloj activo={vistaPrincipal === "calendario" || vistaPrincipal === "plantillas-plan" || estadoRegistro.registrosActivos.length > 0}>
        <main className="app-shell">
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

            <div className={esVistaFocus
                ? "app-content app-content-focus"
                : vistaPrincipal === "plantillas-plan"
                    ? "app-content app-content-planificaciones"
                    : vistaPrincipal === "analitica" ? "app-content app-content-analitica"
                        : vistaPrincipal === "historial" ? "app-content app-content-historial"
                            : vistaPrincipal === "tareas" ? "app-content app-content-tareas"
                                : vistaPrincipal === "eventos" ? "app-content app-content-eventos" : "app-content"}>
                <CalendarioDiario
                    ref={calendarioRef}
                    key={fechaCalendarioSolicitada.version}
                    registros={estadoRegistro.registros}
                    eventos={plantillas}
                    tareas={tareasDeTrabajo}
                    categorias={estadoCategorias.ok ? estadoCategorias.categorias : []}
                    ordenEventos={ordenPlantillasEventos}
                    cambiarOrdenEventos={cambiarOrdenEventos}
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
                    seguimientoPlanificacion={seguimientoParaCalendario}
                    onIniciarSesionFocus={iniciarFocusPlanificado}
                />

                <aside className="panel-herramientas" aria-label="Panel de herramientas">
                    <div className="panel-herramientas-contenido">
                        <PanelSeguimientoPlanificacion
                            seguimiento={seguimientoParaCalendario}
                            planes={planesSeguimiento}
                            eventos={plantillas}
                            tareas={tareasDeTrabajo}
                            categorias={estadoCategorias.ok ? estadoCategorias.categorias : []}
                            ordenEventos={ordenPlantillasEventos}
                            cambiarOrdenEventos={cambiarOrdenEventos}
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
                                            categorias={estadoCategorias.ok ? estadoCategorias.categorias : []}
                                            ordenEventos={ordenPlantillasEventos}
                                            cambiarOrdenEventos={cambiarOrdenEventos}
                                            onFinalizarVinculado={seguimientoPlanificacion.finalizarDesdeRegistrosActivos}
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
                                categorias={estadoCategorias.ok ? estadoCategorias.categorias : []}
                                ordenEventos={ordenPlantillasEventos}
                                cambiarOrdenEventos={cambiarOrdenEventos}
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
                                tareas={tareasDeTrabajo}
                                usosPlantillas={estadoUsosPlantillasPlan.ok ? estadoUsosPlantillasPlan.usos : []}
                                categorias={estadoCategorias.ok ? estadoCategorias.categorias : []}
                                ordenEventos={ordenPlantillasEventos}
                                cambiarOrdenEventos={cambiarOrdenEventos}
                                errorCarga={estadoPlantillasPlan.ok ? "" : estadoPlantillasPlan.error}
                                errorUsos={estadoUsosPlantillasPlan.ok ? "" : estadoUsosPlantillasPlan.error}
                                planes={estadoPlanes.ok ? estadoPlanes.planes : []}
                                recurrencias={estadoRecurrencias.ok ? estadoRecurrencias.reglas : []}
                                planesEnSeguimiento={planesSeguimiento}
                                idsPlanesSeguimiento={seguimientoPlanificacion.estado?.secuencia.map(item => item.planId) ?? []}
                                errorDependencias={[estadoPlanes, estadoRecurrencias].filter(estado => !estado.ok).map(estado => estado.error).join(" ")}
                                onCrear={crearPlantillaPlan}
                                onActualizar={actualizarPlantillaPlan}
                                onEliminar={eliminarPlantillaPlan}
                                onAplicar={aplicarPlantillaPlan}
                                onCrearRecurrencia={crearRecurrenciaPlantillaPlanificacion}
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
                                categorias={estadoCategorias.ok ? estadoCategorias.categorias : []}
                                ordenEventos={ordenPlantillasEventos}
                                cambiarOrdenEventos={cambiarOrdenEventos}
                                datosDisponibles={estadoRegistro.datos.ok}
                                errorCarga={estadoRegistro.datos.error}
                                problemas={problemasRevision}
                                onEditar={estadoRegistro.editarFinalizado}
                                onEliminar={estadoRegistro.eliminarFinalizado}
                                onEliminarInvalido={estadoRegistro.eliminarInvalido}
                                onEliminarDatosCorruptos={estadoRegistro.eliminarDatosCorruptos}
                                onEliminarPlanInvalido={eliminarPlanInvalidoDesdeHistorial}
                                onEliminarPlanesCorruptos={eliminarPlanesCorruptosDesdeHistorial}
                                onEliminarProblema={eliminarProblemaRevision}
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
                                onOrdenarFocus={guardarOrdenColaFocus}
                                onOrdenarBacklog={guardarOrdenBacklog}
                                onMoverBacklog={moverTareaBacklog}
                            />
                        </div>
                    </div>
                </aside>
            </div>
        </main>
        </ProveedorReloj>
    )
}
