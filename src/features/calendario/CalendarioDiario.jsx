import { cloneElement, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"

import {
    desplazarDia,
    formatearFechaISO,
    leerFechaISO,
    obtenerDiasSemana,
    obtenerInicioSemana,
    obtenerFechaLocalHoy
} from "../../domain/tiempo/FechaCalendario.js"
import { obtenerFragmentosCalendario } from "./segmentosCalendario.js"
import { formatearInstante } from "../../domain/tiempo/historial.js"
import { FormularioRegistro } from "./FormularioRegistro.jsx"
import { DetalleRegistro } from "./DetalleRegistro.jsx"
import { TiempoTotal } from "./TiempoTotal.jsx"
import { VistaCalendarioDia } from "./VistaCalendarioDia.jsx"
import { VistaCalendarioSemana } from "./VistaCalendarioSemana.jsx"
import { FormularioPlan } from "./FormularioPlan.jsx"
import { DetallePlan } from "./DetallePlan.jsx"
import { ALTURA_HORA_BASE } from "./zoomCalendario.js"
import { obtenerFragmentosPlanesCalendario } from "./segmentosCalendario.js"
import { generarAparicionesRecurrencia } from "../../domain/planificacion/recurrencias.js"
import "./CalendarioDiario.css"

const formatoFechaLarga = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
})

const formatoFechaCorta = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric"
})

function obtenerCentroRegistro(registro, ahora) {
    const inicio = registro.segmentos[0].inicio.getTime()
    const fin = (registro.segmentos.at(-1).fin ?? ahora).getTime()
    return new Date((inicio + fin) / 2)
}

function etiquetaVentanaZoom(segundos) {
    if (segundos < 60) return `${segundos} ${segundos === 1 ? "segundo" : "segundos"}`
    if (segundos % 3600 === 0) return `${segundos / 3600} h`
    return `${segundos / 60} min`
}

function formatoInstanteVisible(instante, incluirFecha) {
    return formatearInstante(instante, incluirFecha
        ? { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }
        : { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
}

function obtenerFechasDelTramo(inicio, fin) {
    const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
    const ultimoDia = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate())
    const fechas = []

    while (cursor <= ultimoDia) {
        fechas.push(new Date(cursor))
        cursor.setDate(cursor.getDate() + 1)
    }

    return fechas
}

function distribuirCarriles(
    fragmentos,
    obtenerInicio = fragmento => fragmento.minutosInicio,
    obtenerFin = fragmento => fragmento.minutosFinParaCarriles ?? fragmento.minutosFin
) {
    const ordenados = [...fragmentos].sort((a, b) => (
        obtenerInicio(a) - obtenerInicio(b) || obtenerFin(a) - obtenerFin(b)
    ))
    const grupos = []
    let grupo = []
    let finGrupo = -Infinity

    for (const fragmento of ordenados) {
        if (grupo.length > 0 && obtenerInicio(fragmento) >= finGrupo) {
            grupos.push(grupo)
            grupo = []
            finGrupo = -Infinity
        }
        grupo.push(fragmento)
        finGrupo = Math.max(finGrupo, obtenerFin(fragmento))
    }
    if (grupo.length > 0) grupos.push(grupo)

    return grupos.flatMap(elementos => {
        const finalesCarril = []
        const asignados = elementos.map(fragmento => {
            let carril = finalesCarril.findIndex(fin => fin <= obtenerInicio(fragmento))
            if (carril === -1) carril = finalesCarril.length
            finalesCarril[carril] = obtenerFin(fragmento)
            return { ...fragmento, carril }
        })
        return asignados.map(fragmento => ({ ...fragmento, cantidadCarriles: finalesCarril.length }))
    })
}

export const CalendarioDiario = forwardRef(function CalendarioDiario({
    registros = [],
    eventos = [],
    tareas = [],
    categorias = [],
    ordenEventos = "ultimo-uso",
    cambiarOrdenEventos = () => {},
    ahora = new Date(),
    onCrearRegistro = () => ({ ok: false, error: "La operación no está disponible." }),
    onEditarRegistro = () => ({ ok: false, error: "La operación no está disponible." }),
    onEliminarRegistro = () => ({ ok: false, error: "La operación no está disponible." }),
    planes = [],
    recurrencias = [],
    fechaInicial = null,
    planesDisponibles = true,
    onCrearPlan = () => ({ ok: false, error: "La planificación no está disponible." }),
    onCrearRecurrencia = () => ({ ok: false, error: "La planificación recurrente no está disponible." }),
    onActualizarPlan = () => ({ ok: false, error: "La planificación no está disponible." }),
    onEliminarPlan = () => ({ ok: false, error: "La planificación no está disponible." }),
    onEliminarRecurrencia = () => ({ ok: false, error: "La planificación recurrente no está disponible." }),
    onEliminarAplicacionPlan = () => ({ ok: false, error: "La planificación no está disponible." }),
    onMoverAplicacionPlan = () => ({ ok: false, error: "No se pudo mover la aplicación." }),
    onIniciarSesionFocus = () => ({ ok: false, error: "No se pudo iniciar la sesión Focus." }),
    seguimientoPlanificacion = null
}, referencia) {
    const [vista, cambiarVista] = useState("dia")
    const [formatoSemanaMovil, cambiarFormatoSemanaMovil] = useState("agenda")
    const [fechaSeleccionada, cambiarFechaSeleccionada] = useState(
        () => fechaInicial ? new Date(fechaInicial.getFullYear(), fechaInicial.getMonth(), fechaInicial.getDate()) : obtenerFechaLocalHoy()
    )
    const [registroSeleccionado, cambiarRegistroSeleccionado] = useState(null)
    const [, cambiarCentroRegistroSeleccionado] = useState(null)
    const [formulario, cambiarFormulario] = useState(null)
    const [zoomCalendario, cambiarZoomCalendario] = useState(null)
    const [rangoZoomVisible, cambiarRangoZoomVisible] = useState(null)
    const [rangoLienzoZoom, cambiarRangoLienzoZoom] = useState(null)
    const [franjaSeleccionada, cambiarFranjaSeleccionada] = useState(null)
    const [estadoAjuste, cambiarEstadoAjuste] = useState(null)
    const [edicionDirectaHabilitada, cambiarEdicionDirectaHabilitada] = useState(false)
    const [idAplicacionArmada, cambiarIdAplicacionArmada] = useState(null)
    const [idAplicacionCronometroSeleccionada, cambiarIdAplicacionCronometroSeleccionada] = useState(null)
    const [planSeleccionado, cambiarPlanSeleccionado] = useState(null)
    const [, cambiarCentroPlanSeleccionado] = useState(null)
    const [formularioPlan, cambiarFormularioPlan] = useState(null)
    const focoPlanRef = useRef(null)
    const formularioPlanAbiertoRef = useRef(false)
    const focoAlCerrarFormularioRef = useRef(null)
    const formularioAbiertoRef = useRef(false)
    const rangoZoomVisibleRef = useRef(null)
    const idZoomRef = useRef(0)
    const [esViewportMovil, cambiarEsViewportMovil] = useState(false)

    useEffect(() => {
        const media = window.matchMedia("(max-width: 700px)")
        const actualizar = () => cambiarEsViewportMovil(media.matches)
        actualizar()
        media.addEventListener("change", actualizar)
        return () => media.removeEventListener("change", actualizar)
    }, [])


    useEffect(() => {
        if (formulario) {
            formularioAbiertoRef.current = true
            return
        }

        if (formularioAbiertoRef.current) {
            formularioAbiertoRef.current = false
            if (focoAlCerrarFormularioRef.current?.isConnected) focoAlCerrarFormularioRef.current.focus()
            focoAlCerrarFormularioRef.current = null
        }
    }, [formulario])

    useEffect(() => {
        if (formularioPlan) {
            formularioPlanAbiertoRef.current = true
            return
        }
        if (formularioPlanAbiertoRef.current) {
            formularioPlanAbiertoRef.current = false
            if (focoPlanRef.current?.isConnected) focoPlanRef.current.focus()
            focoPlanRef.current = null
        }
    }, [formularioPlan])

    useImperativeHandle(referencia, () => ({
        abrirNuevoRegistro(origen) {
            cambiarFranjaSeleccionada(null)
            focoAlCerrarFormularioRef.current = origen
            cambiarRegistroSeleccionado(null)
            cambiarPlanSeleccionado(null)
            cambiarFormularioPlan(null)
            cambiarZoomCalendario(null)
            cambiarEstadoAjuste(null)
            cambiarFormulario({ tipo: "crear" })
        },
        abrirNuevaPlanificacion(origen) {
            cambiarFranjaSeleccionada(null)
            focoPlanRef.current = origen
            cambiarPlanSeleccionado(null)
            cambiarCentroPlanSeleccionado(null)
            cambiarRegistroSeleccionado(null)
            cambiarZoomCalendario(null)
            cambiarEstadoAjuste(null)
            cambiarFormulario(null)
            cambiarFormularioPlan({ tipo: "crear" })
        }
    }), [])

    const fechaISO = formatearFechaISO(fechaSeleccionada)
    const inicioSemana = obtenerInicioSemana(fechaSeleccionada)
    const diasSemana = vista === "semana"
        ? obtenerDiasSemana(fechaSeleccionada)
        : []
    const fechaVisible = vista === "dia"
        ? formatoFechaLarga.format(fechaSeleccionada)
        : `${formatoFechaCorta.format(inicioSemana)} – ${formatoFechaCorta.format(diasSemana[6])}`
    const fechaFinRecurrencias = vista === "dia" ? fechaSeleccionada : new Date(diasSemana[6])
    if (vista === "semana") fechaFinRecurrencias.setDate(fechaFinRecurrencias.getDate() + 1)
    const planesVisibles = [...planes, ...generarAparicionesRecurrencia(
        recurrencias, vista === "dia" ? fechaSeleccionada : diasSemana[0], fechaFinRecurrencias
    )]
    const planActivoSeguimientoId = seguimientoPlanificacion?.estado
        ? seguimientoPlanificacion.estado.secuencia[seguimientoPlanificacion.estado.indiceActual]?.planId
        : null
    const aplicacionesCronometroDia = vista === "dia" ? [...new Map(planesVisibles
        .filter(plan => (plan.modoSeguimientoPlanificacion === "cronometro" || plan.modoAplicacionPlanificacion === "cronometro")
            && plan.inicio.getFullYear() === fechaSeleccionada.getFullYear()
            && plan.inicio.getMonth() === fechaSeleccionada.getMonth()
            && plan.inicio.getDate() === fechaSeleccionada.getDate())
        .map(plan => [plan.idAplicacionPlantilla, plan])).values()]
        .map(ancla => ({ ancla, actividades: planesVisibles.filter(plan => plan.idAplicacionPlantilla === ancla.idAplicacionPlantilla
            && (plan.modoSeguimientoPlanificacion === "cronometro" || (plan.tipoPlanificacion === "focus" && plan.modoAplicacionPlanificacion === "cronometro")))
            .sort((a, b) => (a.ordenSeguimiento ?? a.ordenSeguimientoCronometro ?? 0) - (b.ordenSeguimiento ?? b.ordenSeguimientoCronometro ?? 0) || a.id.localeCompare(b.id)) })) : []
    const representacionesSecuenciaCronometro = aplicacionesCronometroDia.map(({ ancla, actividades }) => {
        const sesion = seguimientoPlanificacion?.estado?.idAplicacionPlantilla === ancla.idAplicacionPlantilla ? seguimientoPlanificacion.estado : null
        const primero = actividades.find(plan => plan.modoSeguimientoPlanificacion === "cronometro") ?? actividades[0]
        const nombre = ancla.plantillaOrigenNombre ?? "Secuencia sin nombre"
        const horaAncla = formatearInstante(ancla.inicio, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        const iniciar = (planId, modo) => {
            const resultado = seguimientoPlanificacion?.empezar(planId, modo, planesVisibles, eventos, tareas)
            cambiarEstadoAjuste(resultado?.ok ? { mensaje: "Empezó el seguimiento de la planificación." } : { error: resultado?.error ?? "No se pudo iniciar el cronómetro." })
        }

        return {
            id: ancla.idAplicacionPlantilla,
            inicio: ancla.inicio,
            marcador: <button
                type="button"
                key={ancla.idAplicacionPlantilla}
                className="marcador-secuencia-cronometro"
                style={{ top: `${((ancla.inicio.getHours() * 3600 + ancla.inicio.getMinutes() * 60 + ancla.inicio.getSeconds()) / 86400) * 100}%` }}
                aria-label={`Abrir ${nombre}, ${actividades.length} ${actividades.length === 1 ? "actividad" : "actividades"}, inicio previsto ${horaAncla}`}
                aria-expanded={idAplicacionCronometroSeleccionada === ancla.idAplicacionPlantilla}
                onClick={() => cambiarIdAplicacionCronometroSeleccionada(actual => actual === ancla.idAplicacionPlantilla ? null : ancla.idAplicacionPlantilla)}
            >
                <strong>{nombre}</strong>
                <span>{actividades.length} {actividades.length === 1 ? "actividad" : "actividades"}</span>
            </button>,
            detalle: <section className="tarjeta-secuencia-cronometro" aria-label={`Planificación ${nombre}`}>
                <header>
                    <div><h3>{nombre}</h3><p>Secuencia sin duraciones · inicio previsto {horaAncla}</p></div>
                    <div className="secuencia-cronometro-estado">
                        <span>{sesion ? "En seguimiento" : "Pendiente"}</span>
                        <button type="button" aria-label={`Cerrar detalle de ${nombre}`} onClick={() => cambiarIdAplicacionCronometroSeleccionada(null)}>Cerrar</button>
                    </div>
                </header>
                <ol>{actividades.map(plan => {
                    if (plan.tipoPlanificacion === "focus") return <li key={plan.id} className="secuencia-cronometro-focus">
                        <span>Sesión Focus: {plan.nombre} · etapa {(plan.grupoCronometro ?? 0) + 1}</span>
                        <span>Duración prevista: {Math.round((plan.fin.getTime() - plan.inicio.getTime()) / 60000)} min · se inicia manualmente</span>
                        <button type="button" onClick={() => {
                            const resultado = onIniciarSesionFocus(plan)
                            cambiarEstadoAjuste(resultado?.ok ? { mensaje: "Se inició la sesión Focus planificada." } : { error: resultado?.error ?? "No se pudo iniciar la sesión Focus." })
                        }}>Iniciar Focus</button>
                        <button type="button" disabled={Boolean(sesion)} onClick={() => eliminarActividadCronometro(plan)}>Eliminar del calendario</button>
                    </li>
                    const elemento = sesion?.secuencia.find(item => item.planId === plan.id)
                    const activo = sesion?.registrosActivos?.find(item => item.planId === plan.id)
                    const completado = sesion?.finalizados?.includes(plan.id)
                    const omitido = sesion?.eventosOmitidos?.includes(plan.id)
                    return <li key={plan.id} className={activo ? "secuencia-cronometro-activo" : ""}>
                        <span>{elemento?.nombre ?? eventos.find(evento => evento.id === plan.eventoId)?.nombre ?? plan.nombre}</span>
                        <span>{activo ? "En curso" : completado ? "Finalizado" : omitido ? "Omitido" : "Pendiente"}</span>
                        {!sesion && <button type="button" onClick={() => iniciar(plan.id, "actual")}>Iniciar este evento</button>}
                        <button type="button" disabled={Boolean(sesion)} onClick={() => eliminarActividadCronometro(plan)}>Eliminar del calendario</button>
                    </li>
                })}</ol>
                {!sesion && actividades.filter(plan => plan.modoSeguimientoPlanificacion === "cronometro"
                    && (plan.grupoCronometro ?? 0) === (primero.grupoCronometro ?? 0)).length > 1
                    && <button type="button" className="secuencia-cronometro-iniciar-grupo" onClick={() => iniciar(primero.id, "grupo")}>Iniciar juntos los eventos de la primera etapa</button>}
                {!sesion && actividades.length > 0 && <button type="button" className="secuencia-cronometro-eliminar" onClick={() => eliminarSecuenciaCronometro(ancla.idAplicacionPlantilla, nombre, actividades.length)}>Eliminar planificación del calendario</button>}
                {sesion && <p>Los cronómetros de los eventos activos continúan por separado. Podés iniciar la siguiente etapa desde el panel de seguimiento.</p>}
            </section>
        }
    })
    const fragmentosCombinadosDia = distribuirCarriles([
        ...obtenerFragmentosCalendario(registros, fechaSeleccionada, ahora)
            .map(fragmento => ({ ...fragmento, tipoVisual: "registro" })),
        ...obtenerFragmentosPlanesCalendario(planesVisibles, fechaSeleccionada)
            .map(fragmento => ({ ...fragmento, tipoVisual: "plan" }))
    ])
    const fragmentosDia = fragmentosCombinadosDia.filter(fragmento => fragmento.tipoVisual === "registro")
    const fragmentosPlanesDia = fragmentosCombinadosDia.filter(fragmento => fragmento.tipoVisual === "plan")
    const fragmentosSemana = diasSemana.map(dia => {
        const combinados = distribuirCarriles([
            ...obtenerFragmentosCalendario(registros, dia, ahora)
                .map(fragmento => ({ ...fragmento, tipoVisual: "registro" })),
            ...obtenerFragmentosPlanesCalendario(planesVisibles, dia)
                .map(fragmento => ({ ...fragmento, tipoVisual: "plan" }))
        ])
        const diaSiguiente = new Date(dia)
        diaSiguiente.setDate(diaSiguiente.getDate() + 1)
        const extendidos = distribuirCarriles([
            ...combinados,
            ...obtenerFragmentosCalendario(registros, diaSiguiente, ahora)
                .map(fragmento => ({ ...fragmento, tipoVisual: "registro" })),
            ...obtenerFragmentosPlanesCalendario(planesVisibles, diaSiguiente)
                .map(fragmento => ({ ...fragmento, tipoVisual: "plan" }))
        ], fragmento => fragmento.inicio.getTime(), fragmento => fragmento.fin.getTime())
        return {
            fecha: formatearFechaISO(dia),
            fragmentos: combinados.filter(fragmento => fragmento.tipoVisual === "registro"),
            planes: combinados.filter(fragmento => fragmento.tipoVisual === "plan"),
            fragmentosExtendidos: extendidos.filter(fragmento => fragmento.tipoVisual === "registro"),
            planesExtendidos: extendidos.filter(fragmento => fragmento.tipoVisual === "plan")
        }
    })
    const inicioLienzoZoom = rangoLienzoZoom?.inicio
        ?? (zoomCalendario ? new Date(zoomCalendario.inicio.getTime() - zoomCalendario.duracionSegundos * 1000) : null)
    const finLienzoZoom = rangoLienzoZoom?.fin
        ?? (zoomCalendario ? new Date(inicioLienzoZoom.getTime() + zoomCalendario.duracionSegundos * 3000) : null)
    const fragmentosZoom = zoomCalendario && vista === "dia"
        ? (() => {
            const fechas = obtenerFechasDelTramo(inicioLienzoZoom, finLienzoZoom)
            const planesLienzo = [
                ...planes,
                ...generarAparicionesRecurrencia(recurrencias, fechas[0], fechas.at(-1))
            ]
            const fragmentos = fechas.flatMap(fecha => [
                ...obtenerFragmentosCalendario(registros, fecha, ahora)
                    .map(fragmento => ({ ...fragmento, tipoVisual: "registro" })),
                ...obtenerFragmentosPlanesCalendario(planesLienzo, fecha)
                    .map(fragmento => ({ ...fragmento, tipoVisual: "plan" }))
            ])
            return distribuirCarriles(fragmentos, fragmento => fragmento.inicio.getTime(), fragmento => fragmento.fin.getTime())
        })()
        : []
    const escalaCalendario = {
        "--altura-hora": `${ALTURA_HORA_BASE}px`,
        "--altura-dia": `${ALTURA_HORA_BASE * 24}px`
    }
    const zoomBloqueadoAgenda = vista === "semana" && esViewportMovil && formatoSemanaMovil === "agenda"
    const inicioEtiquetaZoom = rangoZoomVisible?.inicio
        ?? new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), fechaSeleccionada.getDate())
    const finEtiquetaZoom = rangoZoomVisible?.fin
        ?? new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), fechaSeleccionada.getDate() + 1)
    const duracionEtiquetaZoom = zoomCalendario?.duracionSegundos ?? 86400

    function obtenerCentroInicialZoom() {
        const hoy = new Date(ahora)
        hoy.setHours(0, 0, 0, 0)
        const inicio = vista === "semana" ? new Date(diasSemana[0]) : new Date(fechaSeleccionada)
        inicio.setHours(0, 0, 0, 0)
        const fin = vista === "semana" ? new Date(diasSemana[6]) : new Date(fechaSeleccionada)
        fin.setHours(23, 59, 59, 999)
        return hoy >= inicio && hoy <= fin
            ? new Date(ahora)
            : new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), fechaSeleccionada.getDate(), 12)
    }

    function cambiarZoom(direccion, intervaloForzado = null) {
        const enAgendaSemanalMovil = vista === "semana" && esViewportMovil && formatoSemanaMovil === "agenda"
        if (enAgendaSemanalMovil) return

        let inicio
        let duracionSegundos
        if (direccion > 0 && intervaloForzado) {
            inicio = new Date(intervaloForzado.inicio)
            duracionSegundos = (new Date(intervaloForzado.fin).getTime() - inicio.getTime()) / 1000
        } else if (!zoomCalendario && direccion > 0 && (registroSeleccionado || planSeleccionado || franjaSeleccionada)) {
            if (franjaSeleccionada) {
                inicio = franjaSeleccionada.referencia.inicio
                duracionSegundos = (franjaSeleccionada.referencia.fin.getTime() - inicio.getTime()) / 1000
            } else if (registroSeleccionado) {
                inicio = registroSeleccionado.segmentos[0].inicio
                const fin = registroSeleccionado.segmentos.at(-1).fin ?? ahora
                duracionSegundos = (fin.getTime() - inicio.getTime()) / 1000
            } else {
                inicio = planSeleccionado.inicio
                duracionSegundos = (planSeleccionado.fin.getTime() - inicio.getTime()) / 1000
            }
        } else {
            const rango = rangoZoomVisibleRef.current
            const centro = rango
                ? new Date((rango.inicio.getTime() + rango.fin.getTime()) / 2)
                : obtenerCentroInicialZoom()
            const actual = zoomCalendario?.duracionSegundos ?? 86400
            duracionSegundos = zoomCalendario
                ? Math.min(86400, Math.max(1, actual * (direccion > 0 ? 0.5 : 2)))
                : 43200
            inicio = new Date(centro.getTime() - duracionSegundos * 500)
        }

        duracionSegundos = Math.max(1, Math.min(86400, duracionSegundos))
        cambiarFranjaSeleccionada(null)
        if (duracionSegundos >= 86400) {
            restablecerZoom()
            return
        }
        const nuevoZoom = { id: ++idZoomRef.current, inicio: new Date(inicio), duracionSegundos }
        cambiarZoomCalendario(nuevoZoom)
        cambiarRangoZoomVisible({ inicio: nuevoZoom.inicio, fin: new Date(inicio.getTime() + duracionSegundos * 1000) })
        rangoZoomVisibleRef.current = { inicio: nuevoZoom.inicio, fin: new Date(inicio.getTime() + duracionSegundos * 1000) }
        cambiarRangoLienzoZoom({
            inicio: new Date(inicio.getTime() - duracionSegundos * 1000),
            fin: new Date(inicio.getTime() + duracionSegundos * 2000)
        })
    }

    function restablecerZoom() {
        cambiarZoomCalendario(null)
        cambiarRangoZoomVisible(null)
        cambiarRangoLienzoZoom(null)
        rangoZoomVisibleRef.current = null
        cambiarFranjaSeleccionada(null)
    }

    function seleccionarFranja(inicio, fin) {
        cambiarRegistroSeleccionado(null)
        cambiarPlanSeleccionado(null)
        cambiarFranjaSeleccionada({
            referencia: { id: "franja-seleccionada", inicio, fin },
            centro: new Date((inicio.getTime() + fin.getTime()) / 2)
        })
    }

    function moverDia(cantidad) {
        const diasAMover = vista === "semana" ? cantidad * 7 : cantidad
        const nuevaFecha = desplazarDia(fechaSeleccionada, diasAMover)

        if (nuevaFecha !== null) {
            cambiarFranjaSeleccionada(null)
            cambiarFechaSeleccionada(nuevaFecha)
            cambiarRegistroSeleccionado(null)
            cambiarFormulario(null)
            cambiarPlanSeleccionado(null)
            cambiarCentroPlanSeleccionado(null)
            cambiarFormularioPlan(null)
            restablecerZoom()
            cambiarEstadoAjuste(null)
        }
    }

    function seleccionarFecha(evento) {
        const nuevaFecha = leerFechaISO(evento.target.value)

        if (nuevaFecha !== null) {
            cambiarFranjaSeleccionada(null)
            cambiarFechaSeleccionada(nuevaFecha)
            cambiarRegistroSeleccionado(null)
            cambiarFormulario(null)
            cambiarPlanSeleccionado(null)
            cambiarCentroPlanSeleccionado(null)
            cambiarFormularioPlan(null)
            restablecerZoom()
            cambiarEstadoAjuste(null)
        }
    }

    function irAHoy() {
        cambiarFranjaSeleccionada(null)
        cambiarFechaSeleccionada(obtenerFechaLocalHoy())
        cambiarRegistroSeleccionado(null)
        cambiarFormulario(null)
        cambiarPlanSeleccionado(null)
            cambiarCentroPlanSeleccionado(null)
        cambiarFormularioPlan(null)
        restablecerZoom()
        cambiarEstadoAjuste(null)
    }

    function elegirVista(nuevaVista) {
        cambiarFranjaSeleccionada(null)
        cambiarVista(nuevaVista)
        cambiarRegistroSeleccionado(null)
        cambiarFormulario(null)
        cambiarPlanSeleccionado(null)
        cambiarCentroPlanSeleccionado(null)
        cambiarFormularioPlan(null)
        restablecerZoom()
        cambiarEstadoAjuste(null)
    }

    function editarRegistro(registro, evento) {
        focoAlCerrarFormularioRef.current = evento?.currentTarget ?? null
        cambiarRegistroSeleccionado(registro)
        cambiarCentroRegistroSeleccionado(obtenerCentroRegistro(registro, new Date()))
        cambiarFormulario({ tipo: "editar", registro })
    }

    function crearDesdeCalendario(cambios) {
        const resultado = onCrearRegistro(cambios)

        if (resultado.ok) {
            cambiarRegistroSeleccionado(resultado.registro)
            cambiarCentroRegistroSeleccionado(obtenerCentroRegistro(resultado.registro, new Date()))
        }

        return resultado
    }

    function guardarPlanDesdeFormulario(cambios) {
        const resultado = cambios.idRecurrencia
            ? onActualizarPlan(cambios.idRecurrencia, cambios)
            : cambios.id
            ? onActualizarPlan(cambios.id, cambios)
            : cambios.diasSemana
                ? onCrearRecurrencia(cambios)
                : onCrearPlan(cambios)
        if (!resultado.ok) return resultado
        if (cambios.idRecurrencia) {
            cambiarPlanSeleccionado(null)
            cambiarEstadoAjuste({ mensaje: "Serie semanal actualizada." })
            return resultado
        }
        cambiarEstadoAjuste({ mensaje: cambios.id ? "Plan actualizado." : "Plan guardado." })
        cambiarPlanSeleccionado(resultado.plan)
        cambiarCentroPlanSeleccionado(new Date((resultado.plan.inicio.getTime() + resultado.plan.fin.getTime()) / 2))
        return resultado
    }

    function crearRecurrenciaDesdeFormulario(cambios) {
        const resultado = onCrearRecurrencia(cambios)
        if (resultado.ok) cambiarEstadoAjuste({ mensaje: "Serie semanal guardada." })
        return resultado
    }

    function eliminarPlanSeleccionado() {
        if (!planSeleccionado) return
        const confirmado = window.confirm(
            "¿Querés eliminar el plan \"" + planSeleccionado.nombre + "\"? Esta acción no se puede deshacer."
        )
        if (!confirmado) return
        const resultado = planSeleccionado.idRecurrencia
            ? onEliminarRecurrencia(planSeleccionado.idRecurrencia, planSeleccionado.fechaRecurrencia, "solo")
            : onEliminarPlan(planSeleccionado.id)
        if (!resultado.ok) {
            cambiarEstadoAjuste({ error: resultado.error })
            return
        }
        if (planSeleccionado.idAplicacionPlantilla === idAplicacionArmada) {
            const quedanEnAplicacion = planes.some(plan => (
                plan.id !== planSeleccionado.id
                && plan.idAplicacionPlantilla === idAplicacionArmada
            ))
            if (!quedanEnAplicacion) cambiarIdAplicacionArmada(null)
        }
        cambiarPlanSeleccionado(null)
        cambiarEstadoAjuste({ mensaje: "Plan eliminado." })
    }

    function eliminarSerieSeleccionada(alcance) {
        if (!planSeleccionado?.idRecurrencia) return
        const etiqueta = alcance === "toda" ? "toda la serie" : alcance === "siguientes" ? "esta aparición y las siguientes" : "solo esta aparición"
        if (!window.confirm(`¿Querés eliminar ${etiqueta} de "${planSeleccionado.nombre}"?`)) return
        const resultado = onEliminarRecurrencia(planSeleccionado.idRecurrencia, planSeleccionado.fechaRecurrencia, alcance)
        if (!resultado.ok) { cambiarEstadoAjuste({ error: resultado.error }); return }
        cambiarPlanSeleccionado(null)
        cambiarEstadoAjuste({ mensaje: "Se actualizó la serie recurrente." })
    }

    function eliminarAplicacionSeleccionada() {
        if (!planSeleccionado?.idAplicacionPlantilla) return
        const aplicacion = planes.filter(plan => (
            plan.idAplicacionPlantilla === planSeleccionado.idAplicacionPlantilla
        ))
        if (aplicacion.length === 0) {
            cambiarEstadoAjuste({ error: "No se encontraron actividades para eliminar de esta aplicación." })
            return
        }
        const nombre = planSeleccionado.plantillaOrigenNombre ?? planSeleccionado.nombre
        const descripcionCantidad = aplicacion.length === 1
            ? "la única actividad"
            : `las ${aplicacion.length} actividades`
        const confirmado = window.confirm(
            `¿Querés eliminar ${descripcionCantidad} de la aplicación "${nombre}"? La plantilla reutilizable se conservará. Esta acción no se puede deshacer.`
        )
        if (!confirmado) return
        const resultado = onEliminarAplicacionPlan(planSeleccionado.idAplicacionPlantilla)
        if (!resultado.ok) {
            cambiarEstadoAjuste({ error: resultado.error })
            return
        }
        cambiarIdAplicacionArmada(actual => (
            actual === planSeleccionado.idAplicacionPlantilla ? null : actual
        ))
        cambiarPlanSeleccionado(null)
        cambiarEstadoAjuste({ mensaje: resultado.cantidadEliminada === 1
            ? "Se eliminó la actividad de la aplicación. La plantilla se conservó."
            : `Se eliminaron ${resultado.cantidadEliminada} actividades de la aplicación. La plantilla se conservó.` })
    }

    function eliminarActividadCronometro(plan) {
        const confirmado = window.confirm(`¿Querés eliminar "${plan.nombre}" del calendario? Esta acción no se puede deshacer.`)
        if (!confirmado) return
        const resultado = onEliminarPlan(plan.id)
        if (!resultado.ok) {
            cambiarEstadoAjuste({ error: resultado.error })
            return
        }
        cambiarEstadoAjuste({ mensaje: `Se eliminó "${plan.nombre}" del calendario.` })
    }

    function eliminarSecuenciaCronometro(idAplicacion, nombre, cantidad) {
        if (typeof idAplicacion !== "string" || !idAplicacion) return
        const actividades = cantidad === 1 ? "la única actividad" : `las ${cantidad} actividades`
        const confirmado = window.confirm(`¿Querés eliminar ${actividades} de "${nombre}" del calendario? La plantilla reutilizable se conservará. Esta acción no se puede deshacer.`)
        if (!confirmado) return
        const resultado = onEliminarAplicacionPlan(idAplicacion)
        if (!resultado.ok) {
            cambiarEstadoAjuste({ error: resultado.error })
            return
        }
        cambiarIdAplicacionCronometroSeleccionada(null)
        cambiarEstadoAjuste({ mensaje: resultado.cantidadEliminada === 1
            ? "Se eliminó la planificación del calendario. La plantilla se conservó."
            : `Se eliminaron ${resultado.cantidadEliminada} actividades del calendario. La plantilla se conservó.` })
    }

    function editarDesdeCalendario(id, cambios) {
        const resultado = onEditarRegistro(id, cambios)

        if (resultado.ok) {
            cambiarRegistroSeleccionado(resultado.registro)
            cambiarCentroRegistroSeleccionado(obtenerCentroRegistro(resultado.registro, new Date()))
        }

        return resultado
    }

    function eliminarDesdeDetalle(registro) {
        cambiarEstadoAjuste(null)
        const confirmado = window.confirm(
            `¿Querés eliminar el registro "${registro.nombre}"? Esta acción no se puede deshacer.`
        )

        if (!confirmado) {
            return
        }

        const resultado = onEliminarRegistro(registro.id)

        if (!resultado.ok) {
            cambiarEstadoAjuste({ error: resultado.error })
            return
        }

        cambiarRegistroSeleccionado(null)
        cambiarFormulario(null)
        cambiarEstadoAjuste({ mensaje: "Registro eliminado." })
    }

    function ajustarRegistroDesdeCalendario(registro, segmentos, modo) {
        cambiarEstadoAjuste(null)
        const evento = registro.eventoId
            ? eventos.find(plantilla => plantilla.id === registro.eventoId)
            : null
        const tarea = registro.tareaId
            ? tareas.find(item => item.id === registro.tareaId) ?? { id: registro.tareaId, nombre: registro.tareaNombre }
            : null

        if (registro.eventoId && !evento) {
            cambiarEstadoAjuste({
                error: "No se pudo ajustar el registro porque su plantilla vinculada no está disponible."
            })
            return
        }

        const resultado = onEditarRegistro(registro.id, {
            nombre: registro.nombre,
            evento,
            tarea,
            segmentos
        })

        if (!resultado.ok) {
            cambiarEstadoAjuste({ error: resultado.error })
            return
        }

        const mensajes = {
            mover: "Registro movido en el calendario.",
            inicio: "Inicio del registro ajustado.",
            fin: "Fin del registro ajustado."
        }
        cambiarEstadoAjuste({ mensaje: mensajes[modo] })
    }

    function ajustarPlanDesdeCalendario(plan, cambios, modo) {
        cambiarEstadoAjuste(null)
        if (plan.id === planActivoSeguimientoId) {
            cambiarEstadoAjuste({ mensaje: "El evento que está en curso permanece bloqueado hasta que termine." })
            return
        }
        if (idAplicacionArmada && modo === "mover" && plan.idAplicacionPlantilla === idAplicacionArmada) {
            const desplazamientoMs = cambios.inicio.getTime() - plan.inicio.getTime()
            const resultadoGrupo = onMoverAplicacionPlan(idAplicacionArmada, desplazamientoMs)
            if (!resultadoGrupo.ok) {
                cambiarEstadoAjuste({ error: resultadoGrupo.error })
                return
            }
            cambiarEstadoAjuste({ mensaje: "Se movió la aplicación completa de la plantilla. El movimiento conjunto sigue activo hasta que lo canceles." })
            return
        }
        const evento = plan.eventoId
            ? eventos.find(plantilla => plantilla.id === plan.eventoId)
            : null
        const tarea = plan.tareaId
            ? tareas.find(item => item.id === plan.tareaId) ?? { id: plan.tareaId, nombre: plan.tareaNombre }
            : null
        if (plan.eventoId && !evento) {
            cambiarEstadoAjuste({ error: "No se pudo ajustar la planificación porque su plantilla vinculada no está disponible." })
            return
        }
        const resultado = onActualizarPlan(plan.idRecurrencia ?? plan.id, {
            nombre: plan.nombre,
            evento,
            tarea,
            inicio: cambios.inicio,
            fin: cambios.fin,
            idRecurrencia: plan.idRecurrencia,
            fechaRecurrencia: plan.fechaRecurrencia,
            alcance: "solo"
        })
        if (!resultado.ok) {
            cambiarEstadoAjuste({ error: resultado.error })
            return
        }
        const mensajes = {
            mover: "Planificación movida en el calendario.",
            inicio: "Inicio de la planificación ajustado.",
            fin: "Fin de la planificación ajustado."
        }
        cambiarEstadoAjuste({ mensaje: mensajes[modo] })
    }

    return (
        <section className="calendario-panel" aria-labelledby="titulo-calendario">
            <header className="calendario-header">
                <div>
                    <h2 id="titulo-calendario">Calendario</h2>
                    <p className="calendario-ayuda">
                        Consultá lo registrado y lo planificado por horario. Los bloques sólidos son tiempo registrado; los punteados son actividades planificadas. Seleccioná un bloque o arrastrá sobre una franja vacía y usá + para acercarte.
                    </p>
                    <ul className="leyenda-calendario" aria-label="Significado de los bloques del calendario">
                        <li><span className="leyenda-calendario-muestra leyenda-calendario-registro" aria-hidden="true" />Tiempo registrado</li>
                        <li><span className="leyenda-calendario-muestra leyenda-calendario-plan" aria-hidden="true" />Actividad planificada</li>
                    </ul>
                    <p className="calendario-fecha-visible" aria-live="polite">{fechaVisible}</p>
                    {vista === "dia" && (
                        <p className="tiempo-total-dia">
                            Tiempo total del día: <TiempoTotal registros={registros} fecha={fechaSeleccionada} />
                        </p>
                    )}
                </div>

                <nav className="calendario-controles" aria-label="Navegación del calendario">
                    <div className="grupo-controles-calendario grupo-fecha-calendario" role="group" aria-label="Vista y fecha">
                        <span className="etiqueta-grupo-calendario">Vista y fecha</span>
                        <div className="fila-controles-calendario">
                            <div className="calendario-vistas" role="group" aria-label="Vista del calendario">
                                <button type="button" aria-pressed={vista === "dia"} onClick={() => elegirVista("dia")}>Día</button>
                                <button type="button" aria-pressed={vista === "semana"} onClick={() => elegirVista("semana")}>Semana</button>
                            </div>
                            <button
                                type="button"
                                className="boton-navegacion"
                                aria-label={vista === "dia" ? "Día anterior" : "Semana anterior"}
                                onClick={() => moverDia(-1)}
                            >←</button>
                            <button type="button" className="boton-hoy" onClick={irAHoy}>Hoy</button>
                            <button
                                type="button"
                                className="boton-navegacion"
                                aria-label={vista === "dia" ? "Día siguiente" : "Semana siguiente"}
                                onClick={() => moverDia(1)}
                            >→</button>
                            <label className="selector-fecha">
                                <span>Ir a fecha</span>
                                <input type="date" value={fechaISO} onChange={seleccionarFecha} />
                            </label>
                        </div>
                    </div>
                    <div className="grupo-controles-calendario grupo-herramientas-calendario" role="group" aria-label="Herramientas del calendario">
                        <span className="etiqueta-grupo-calendario">Herramientas</span>
                        <div className="fila-controles-calendario">
                            <div className="controles-zoom" role="group" aria-label="Zoom del calendario">
                                <button
                                    type="button"
                                    aria-label="Alejar calendario"
                                    disabled={!zoomCalendario || zoomBloqueadoAgenda}
                                    onClick={() => cambiarZoom(-1)}
                                >−</button>
                                <output aria-live="polite">
                                    {zoomBloqueadoAgenda
                                        ? "Cambiá a Grilla por horas para acercar"
                                        : `${etiquetaVentanaZoom(duracionEtiquetaZoom)} visibles · ${formatoInstanteVisible(inicioEtiquetaZoom, true)}–${formatoInstanteVisible(finEtiquetaZoom, true)}`}
                                </output>
                                <button
                                    type="button"
                                    aria-label="Acercar calendario"
                                    disabled={zoomBloqueadoAgenda || zoomCalendario?.duracionSegundos <= 1}
                                    onClick={() => cambiarZoom(1)}
                                >+</button>
                                <button
                                    type="button"
                                    className="boton-restablecer-zoom"
                                    disabled={!zoomCalendario && !franjaSeleccionada}
                                    onClick={() => restablecerZoom()}
                                >Restablecer</button>
                            </div>
                            <button
                                type="button"
                                className="boton-edicion-directa"
                                aria-pressed={edicionDirectaHabilitada}
                                onClick={() => cambiarEdicionDirectaHabilitada(estado => !estado)}
                            >{`Edición directa: ${edicionDirectaHabilitada ? "activada" : "desactivada"}`}</button>
                        </div>
                    </div>
                </nav>
            </header>

            {estadoAjuste?.error && (
                <p className="mensaje-ajuste-calendario" role="alert">{estadoAjuste.error}</p>
            )}
            {estadoAjuste?.mensaje && (
                <p className="mensaje-ajuste-calendario" role="status">{estadoAjuste.mensaje}</p>
            )}
            {idAplicacionArmada && (
                <p className="mensaje-ajuste-calendario" role="status">Edición directa está activada. Arrastrá cualquier bloque de esa aplicación para mover todas sus actividades juntas. El modo seguirá activo hasta que lo canceles; cambiar un borde afecta solo esa actividad. <button type="button" onClick={() => cambiarIdAplicacionArmada(null)}>Cancelar movimiento conjunto</button></p>
            )}
            {!zoomCalendario && franjaSeleccionada && (
                <p className="mensaje-ajuste-calendario" role="status">
                    Franja seleccionada: {formatearInstante(franjaSeleccionada.referencia.inicio, { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })} – {formatearInstante(franjaSeleccionada.referencia.fin, { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })}. Toca «Acercar calendario» para enfocarla.
                </p>
            )}
            {!planesDisponibles && (
                <p className="mensaje-ajuste-calendario" role="alert">
                    No se pueden mostrar ni modificar los planes porque los datos guardados no se pudieron cargar.
                </p>
            )}

            {vista === "dia" ? (
                <VistaCalendarioDia
                    escalaCalendario={escalaCalendario}
                    zoom={zoomCalendario}
                    fechaISO={fechaISO}
                    fechaVisible={fechaVisible}
                    fragmentos={zoomCalendario ? fragmentosZoom.filter(fragmento => fragmento.tipoVisual === "registro") : fragmentosDia}
                    fragmentosPlanes={zoomCalendario ? fragmentosZoom.filter(fragmento => fragmento.tipoVisual === "plan") : fragmentosPlanesDia}
                    registros={registros}
                    planes={planes}
                    recurrencias={recurrencias}
                    ahora={ahora}
                    onLienzoZoomChange={rango => cambiarRangoLienzoZoom(rango)}
                    onRangoVisibleChange={(inicio, fin) => {
                        const rango = { inicio, fin }
                        rangoZoomVisibleRef.current = rango
                        cambiarRangoZoomVisible(rango)
                    }}
                    marcadoresSecuenciales={representacionesSecuenciaCronometro.map(item => cloneElement(item.marcador, { "data-instante": item.inicio.getTime() }))}
                    eventos={eventos}
                    onSeleccionar={(registro, fragmento) => {
                        cambiarFranjaSeleccionada(null)
                        cambiarPlanSeleccionado(null)
                        cambiarRegistroSeleccionado(registro)
                        cambiarCentroRegistroSeleccionado(new Date((fragmento.inicio.getTime() + fragmento.fin.getTime()) / 2))
                    }}
                    onSeleccionarPlan={(plan, fragmento) => {
                        cambiarFranjaSeleccionada(null)
                        cambiarRegistroSeleccionado(null)
                        cambiarPlanSeleccionado(plan)
                        cambiarCentroPlanSeleccionado(new Date((fragmento.inicio.getTime() + fragmento.fin.getTime()) / 2))
                    }}
                    onSeleccionarFranja={seleccionarFranja}
                    onAcercarGrupo={(inicio, fin) => cambiarZoom(1, { inicio, fin })}
                    franjaSeleccionada={franjaSeleccionada?.referencia ?? null}
                    onAjustarPlan={ajustarPlanDesdeCalendario}
                    onAjustarRegistro={ajustarRegistroDesdeCalendario}
                    edicionDirectaHabilitada={edicionDirectaHabilitada}
                    idAplicacionArmada={idAplicacionArmada}
                    planActivoSeguimientoId={planActivoSeguimientoId}
                />
            ) : (
                <VistaCalendarioSemana
                    escalaCalendario={escalaCalendario}
                    fechaVisible={fechaVisible}
                    diasSemana={diasSemana}
                    fragmentosSemana={fragmentosSemana}
                    eventos={eventos}
                    registros={registros}
                    onSeleccionar={(registro, fragmento) => {
                        cambiarFranjaSeleccionada(null)
                        cambiarPlanSeleccionado(null)
                        cambiarRegistroSeleccionado(registro)
                        cambiarCentroRegistroSeleccionado(new Date((fragmento.inicio.getTime() + fragmento.fin.getTime()) / 2))
                    }}
                    onSeleccionarPlan={(plan, fragmento) => {
                        cambiarFranjaSeleccionada(null)
                        cambiarRegistroSeleccionado(null)
                        cambiarPlanSeleccionado(plan)
                        cambiarCentroPlanSeleccionado(new Date((fragmento.inicio.getTime() + fragmento.fin.getTime()) / 2))
                    }}
                    onAcercarGrupo={(inicio, fin) => cambiarZoom(1, { inicio, fin })}
                    onAjustarPlan={ajustarPlanDesdeCalendario}
                    onAjustarRegistro={ajustarRegistroDesdeCalendario}
                    edicionDirectaHabilitada={edicionDirectaHabilitada}
                    idAplicacionArmada={idAplicacionArmada}
                    planActivoSeguimientoId={planActivoSeguimientoId}
                    formatoMovil={formatoSemanaMovil}
                    cambiarFormatoMovil={cambiarFormatoSemanaMovil}
                    esViewportMovil={esViewportMovil}
                    zoom={zoomCalendario}
                    onRangoVisibleChange={(inicio, fin) => {
                        const rango = { inicio, fin }
                        rangoZoomVisibleRef.current = rango
                        cambiarRangoZoomVisible(rango)
                    }}
                />
            )}
            {vista === "dia" && representacionesSecuenciaCronometro
                .find(item => item.id === idAplicacionCronometroSeleccionada)?.detalle}
            {formulario && (
                <FormularioRegistro
                    key={formulario.registro?.id ?? `nuevo-${fechaISO}`}
                    registro={formulario.registro ?? null}
                    fechaSeleccionada={fechaSeleccionada}
                    eventos={eventos}
                    tareas={tareas}
                    categorias={categorias}
                    ordenEventos={ordenEventos}
                    cambiarOrdenEventos={cambiarOrdenEventos}
                    onCrear={crearDesdeCalendario}
                    onEditar={editarDesdeCalendario}
                    onCancelar={() => cambiarFormulario(null)}
                />
            )}

            {formularioPlan && (
                <FormularioPlan
                    key={formularioPlan.plan?.id ?? "nuevo-plan-" + fechaISO}
                    plan={formularioPlan.plan ?? null}
                    fechaSeleccionada={fechaSeleccionada}
                    eventos={eventos}
                    tareas={tareas}
                    categorias={categorias}
                    ordenEventos={ordenEventos}
                    cambiarOrdenEventos={cambiarOrdenEventos}
                    onGuardar={guardarPlanDesdeFormulario}
                    onCrearRecurrencia={crearRecurrenciaDesdeFormulario}
                    onCancelar={() => cambiarFormularioPlan(null)}
                />
            )}

            {!formulario && registroSeleccionado && (
                <DetalleRegistro
                    registro={registroSeleccionado}
                    tareas={tareas}
                    categorias={categorias}
                    onEditar={editarRegistro}
                    onEliminar={eliminarDesdeDetalle}
                    onCerrar={() => cambiarRegistroSeleccionado(null)}
                />
            )}
            {!formularioPlan && !formulario && planSeleccionado && (
                <DetallePlan
                    plan={planSeleccionado}
                    evento={eventos.find(evento => evento.id === planSeleccionado.eventoId)}
                    categorias={categorias}
                    onEditar={evento => {
                        focoPlanRef.current = evento.currentTarget
                        cambiarFormularioPlan({ tipo: "editar", plan: planSeleccionado })
                        cambiarPlanSeleccionado(null)
                    }}
                    onEliminar={eliminarPlanSeleccionado}
                    onEliminarRecurrencia={eliminarSerieSeleccionada}
                    onEliminarAplicacion={eliminarAplicacionSeleccionada}
                    onCerrar={() => cambiarPlanSeleccionado(null)}
                    seguimientoActivo={Boolean(seguimientoPlanificacion?.estado)}
                    planActivoSeguimiento={planSeleccionado.id === planActivoSeguimientoId}
                    onSeguirPlan={(id, modo) => {
                        const resultado = seguimientoPlanificacion?.empezar(id, modo, planesVisibles, eventos, tareas)
                        if (resultado?.ok) cambiarPlanSeleccionado(null)
                        return resultado
                    }}
                    onMoverAplicacion={() => {
                        cambiarIdAplicacionArmada(planSeleccionado.idAplicacionPlantilla)
                        cambiarEdicionDirectaHabilitada(true)
                        cambiarPlanSeleccionado(null)
                    }}
                    onIniciarSesionFocus={() => onIniciarSesionFocus(planSeleccionado)}
                />
            )}
        </section>
    )
})
