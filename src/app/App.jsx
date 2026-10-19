import { useLayoutEffect, useRef, useState } from "react"
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
import { crearPlan, actualizarPlan, eliminarAplicacionPlan, eliminarPlan } from "../domain/planificacion/planes.js"
import { cargarPlanes, guardarPlanes } from "../domain/planificacion/persistenciaPlanes.js"
import { formatearFechaISO } from "../domain/tiempo/FechaCalendario.js"
import { cargarRecurrencias, guardarRecurrencias, crearReglaRecurrencia, cambiarRecurrencia, eliminarRecurrencia } from "../domain/planificacion/recurrencias.js"
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
import { crearTarea, actualizarTarea, cambiarDestinoTarea, eliminarTarea, moverTareaEnCola, posponerTareaEnCola, sincronizarEstadoTareasFocus } from "../domain/tareas/tareas.js"
import { cargarTareas, guardarTareas } from "../domain/tareas/persistenciaTareas.js"

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
    const [estadoFocusTareas, cambiarEstadoFocusTareas] = useState({ activa: false, tareaActivaId: null })
    const [fechaCalendarioSolicitada, cambiarFechaCalendarioSolicitada] = useState({ fecha: null, version: 0 })
    const calendarioRef = useRef(null)
    const estadoRegistro = useRegistro()
    const seguimientoPlanificacion = useSeguimientoPlanificacion(estadoRegistro)
    const plantillas = estadoPlantillas.ok ? estadoPlantillas.plantillas : []
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

    function confirmarCambio(nuevasPlantillas) {
        const guardado = guardarPlantillasEventos(nuevasPlantillas)

        if (!guardado.ok) {
            return guardado
        }

        cambiarEstadoPlantillas({ ok: true, plantillas: nuevasPlantillas })
        return { ok: true }
    }

    function confirmarPlanes(nuevosPlanes) {
        const guardado = guardarPlanes(nuevosPlanes)
        if (!guardado.ok) return guardado
        cambiarEstadoPlanes({ ok: true, planes: nuevosPlanes })
        return { ok: true }
    }

    function confirmarRecurrencias(nuevas) {
        const guardado = guardarRecurrencias(nuevas)
        if (!guardado.ok) return guardado
        cambiarEstadoRecurrencias({ ok: true, reglas: nuevas })
        return { ok: true }
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

    function crearTareaNueva(nombre, estado, destino = "backlog") {
        if (!estadoTareas.ok) return { ok: false, error: estadoTareas.error }
        const ordenFocus = destino === "focus"
            ? estadoTareas.tareas.filter(tarea => tarea.destino === "focus" && !["Completada", "Cancelada", "Boceto"].includes(tarea.estado))
                .reduce((maximo, tarea) => Math.max(maximo, tarea.ordenFocus ?? 0), 0) + 1
            : null
        const resultado = crearTarea(nombre, estado, undefined, undefined, destino, ordenFocus)
        if (!resultado.ok) return resultado
        const tareas = [...estadoTareas.tareas, resultado.tarea]
        const guardado = confirmarTareas(tareas)
        return guardado.ok ? { ok: true, tarea: resultado.tarea, tareas } : guardado
    }

    function actualizarTareaExistente(id, cambios) {
        if (!estadoTareas.ok) return { ok: false, error: estadoTareas.error }
        const resultado = actualizarTarea(estadoTareas.tareas, id, cambios)
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
        if (cambios.idRecurrencia) {
            if (!estadoRecurrencias.ok) return { ok: false, error: estadoRecurrencias.error }
            const resultado = cambiarRecurrencia(estadoRecurrencias.reglas, cambios.idRecurrencia, cambios.fechaRecurrencia, cambios, cambios.alcance)
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
        const ids = new Set(aplicacion.map(plan => plan.id))
        const nuevas = estadoPlanes.planes.map(plan => ids.has(plan.id) ? {
            ...plan,
            inicio: new Date(plan.inicio.getTime() + desplazamientoMs),
            fin: new Date(plan.fin.getTime() + desplazamientoMs)
        } : plan)
        return confirmarPlanes(nuevas)
    }

    function eliminarPlanificacion(id) {
        if (!estadoPlanes.ok) return { ok: false, error: estadoPlanes.error }
        const resultado = eliminarPlan(estadoPlanes.planes, id)
        if (!resultado.ok) return resultado
        return confirmarPlanes(resultado.planes)
    }

    function eliminarRecurrenciaPlanificacion(id, fecha, alcance) {
        if (!estadoRecurrencias.ok) return { ok: false, error: estadoRecurrencias.error }
        const resultado = eliminarRecurrencia(estadoRecurrencias.reglas, id, fecha, alcance)
        return resultado.ok ? confirmarRecurrencias(resultado.reglas) : resultado
    }

    function eliminarAplicacionPlanificacion(idAplicacion) {
        if (!estadoPlanes.ok) return { ok: false, error: estadoPlanes.error }
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
                        : vistaPrincipal === "tareas" ? "app-content app-content-tareas" : "app-content"}>
                <CalendarioDiario
                    ref={calendarioRef}
                    key={fechaCalendarioSolicitada.version}
                    registros={estadoRegistro.registros}
                    eventos={plantillas}
                    tareas={estadoTareas.ok ? estadoTareas.tareas : []}
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
                />

                <aside className="panel-herramientas" aria-label="Panel de herramientas">
                    <PanelSeguimientoPlanificacion seguimiento={seguimientoPlanificacion} />
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
                                            tareas={estadoTareas.ok ? estadoTareas.tareas : []}
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
                                tareas={estadoTareas.ok ? estadoTareas.tareas : []}
                                onCrearTarea={crearTareaNueva}
                                onActualizarTarea={actualizarTareaExistente}
                                onCambiarDestinoTarea={cambiarDestinoTareaExistente}
                                onReordenarTarea={reordenarTareaFocus}
                                onPosponerTarea={posponerTareaFocus}
                                onEstadoSesionChange={actualizarEstadoSesionFocus}
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
                        <div hidden={vistaPrincipal !== "tareas"}>
                            <BibliotecaTareas
                                tareas={estadoTareas.ok ? estadoTareas.tareas : []}
                                errorCarga={estadoTareas.ok ? "" : estadoTareas.error}
                                tareaActivaId={estadoFocusTareas.tareaActivaId}
                                sesionFocusActiva={estadoFocusTareas.activa}
                                onCrear={crearTareaNueva}
                                onActualizar={actualizarTareaExistente}
                                onEliminar={eliminarTareaExistente}
                                onCambiarDestino={cambiarDestinoTareaExistente}
                                onReordenar={(id, direccion, tareaActivaId) => reordenarTareaFocus(id, direccion, tareaActivaId)}
                            />
                        </div>
                    </div>
                </aside>
            </div>
        </main>
        </ProveedorReloj>
    )
}
