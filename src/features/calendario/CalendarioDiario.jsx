import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"

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
import { DetalleTramo } from "./DetalleTramo.jsx"
import { DetalleRegistro } from "./DetalleRegistro.jsx"
import { TiempoTotal } from "./TiempoTotal.jsx"
import { VistaCalendarioDia } from "./VistaCalendarioDia.jsx"
import { VistaCalendarioSemana } from "./VistaCalendarioSemana.jsx"
import { FormularioPlan } from "./FormularioPlan.jsx"
import { DetallePlan } from "./DetallePlan.jsx"
import {
    ALTURA_HORA_BASE,
    VENTANAS_ZOOM_SEGUNDOS
} from "./zoomCalendario.js"
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

function obtenerVentanaPlan(plan) {
    const ventanas = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800, 57600, 86400]
    const duracion = (plan.fin.getTime() - plan.inicio.getTime()) / 1000
    return ventanas.find(ventana => ventana >= duracion * 1.25) ?? ventanas.at(-1)
}

function etiquetaVentanaZoom(segundos) {
    if (segundos < 60) return `${segundos} ${segundos === 1 ? "segundo" : "segundos"}`
    if (segundos % 3600 === 0) return `${segundos / 3600} h`
    return `${segundos / 60} min`
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
    seguimientoPlanificacion = null
}, referencia) {
    const [vista, cambiarVista] = useState("dia")
    const [fechaSeleccionada, cambiarFechaSeleccionada] = useState(
        () => fechaInicial ? new Date(fechaInicial.getFullYear(), fechaInicial.getMonth(), fechaInicial.getDate()) : obtenerFechaLocalHoy()
    )
    const [alturaHoraDia] = useState(ALTURA_HORA_BASE)
    const [alturaHoraSemana] = useState(ALTURA_HORA_BASE)
    const [registroSeleccionado, cambiarRegistroSeleccionado] = useState(null)
    const [centroRegistroSeleccionado, cambiarCentroRegistroSeleccionado] = useState(null)
    const [formulario, cambiarFormulario] = useState(null)
    const [tramoDetallado, cambiarTramoDetallado] = useState(null)
    const [franjaSeleccionada, cambiarFranjaSeleccionada] = useState(null)
    const [estadoAjuste, cambiarEstadoAjuste] = useState(null)
    const [edicionDirectaHabilitada, cambiarEdicionDirectaHabilitada] = useState(false)
    const [idAplicacionArmada, cambiarIdAplicacionArmada] = useState(null)
    const [planSeleccionado, cambiarPlanSeleccionado] = useState(null)
    const [centroPlanSeleccionado, cambiarCentroPlanSeleccionado] = useState(null)
    const [formularioPlan, cambiarFormularioPlan] = useState(null)
    const focoPlanRef = useRef(null)
    const formularioPlanAbiertoRef = useRef(false)
    const focoAlCerrarFormularioRef = useRef(null)
    const formularioAbiertoRef = useRef(false)


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
            cambiarTramoDetallado(null)
            cambiarEstadoAjuste(null)
            cambiarFormulario({ tipo: "crear" })
        },
        abrirNuevaPlanificacion(origen) {
            cambiarFranjaSeleccionada(null)
            focoPlanRef.current = origen
            cambiarPlanSeleccionado(null)
            cambiarCentroPlanSeleccionado(null)
            cambiarRegistroSeleccionado(null)
            cambiarTramoDetallado(null)
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
    const planesVisibles = [...planes, ...generarAparicionesRecurrencia(
        recurrencias, vista === "dia" ? fechaSeleccionada : diasSemana[0],
        vista === "dia" ? fechaSeleccionada : diasSemana[6]
    )]
    const planActivoSeguimientoId = seguimientoPlanificacion?.estado
        ? seguimientoPlanificacion.estado.secuencia[seguimientoPlanificacion.estado.indiceActual]?.planId
        : null
    const aplicacionesCronometroDia = vista === "dia" ? [...new Map(planesVisibles
        .filter(plan => plan.modoSeguimientoPlanificacion === "cronometro"
            && plan.inicio.getFullYear() === fechaSeleccionada.getFullYear()
            && plan.inicio.getMonth() === fechaSeleccionada.getMonth()
            && plan.inicio.getDate() === fechaSeleccionada.getDate())
        .map(plan => [plan.idAplicacionPlantilla, plan])).values()]
        .map(ancla => ({ ancla, actividades: planesVisibles.filter(plan => plan.idAplicacionPlantilla === ancla.idAplicacionPlantilla && plan.modoSeguimientoPlanificacion === "cronometro")
            .sort((a, b) => a.ordenSeguimiento - b.ordenSeguimiento || a.id.localeCompare(b.id)) })) : []
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
        return {
            fecha: formatearFechaISO(dia),
            fragmentos: combinados.filter(fragmento => fragmento.tipoVisual === "registro"),
            planes: combinados.filter(fragmento => fragmento.tipoVisual === "plan")
        }
    })
    const fragmentosCalendario = vista === "dia"
        ? fragmentosCombinadosDia
        : fragmentosSemana.flatMap(columna => [...columna.fragmentos, ...columna.planes])
    const alturaHora = vista === "dia" ? alturaHoraDia : alturaHoraSemana
    const escalaCalendario = {
        "--altura-hora": `${alturaHora}px`,
        "--altura-dia": `${alturaHora * 24}px`
    }

    function cambiarZoom(direccion) {
        const ventanaActual = tramoDetallado?.ventanaSegundos ?? VENTANAS_ZOOM_SEGUNDOS.at(-1)
        const indiceActual = VENTANAS_ZOOM_SEGUNDOS.indexOf(ventanaActual)
        let indiceSiguiente = Math.max(0, Math.min(VENTANAS_ZOOM_SEGUNDOS.length - 1, indiceActual - direccion))
        let referencia = tramoDetallado?.referencia
        let centro = tramoDetallado?.centro ?? new Date(fechaSeleccionada.getTime() + 12 * 60 * 60 * 1000)
        let tipo = tramoDetallado?.tipo ?? "calendario"

        if (direccion > 0 && !tramoDetallado && (registroSeleccionado || planSeleccionado || franjaSeleccionada)) {
            referencia = registroSeleccionado ?? planSeleccionado ?? franjaSeleccionada.referencia
            centro = registroSeleccionado
                ? centroRegistroSeleccionado ?? obtenerCentroRegistro(registroSeleccionado, new Date())
                : planSeleccionado
                    ? centroPlanSeleccionado ?? new Date((planSeleccionado.inicio.getTime() + planSeleccionado.fin.getTime()) / 2)
                    : franjaSeleccionada.centro
            const ventana = franjaSeleccionada?.ventanaSegundos
                ?? (registroSeleccionado ? 300 : obtenerVentanaPlan(planSeleccionado))
            indiceSiguiente = VENTANAS_ZOOM_SEGUNDOS.indexOf(ventana)
            tipo = franjaSeleccionada ? "franja" : planSeleccionado ? "plan" : "registro"
            cambiarFranjaSeleccionada(null)
        }
        const siguiente = VENTANAS_ZOOM_SEGUNDOS[indiceSiguiente]
        if (siguiente === VENTANAS_ZOOM_SEGUNDOS.at(-1)) {
            cambiarTramoDetallado(null)
            return
        }
        if (!referencia) referencia = tramoDetallado?.referencia ?? { id: "calendario", fecha: fechaISO }
        cambiarTramoDetallado({ referencia, centro, ventanaSegundos: siguiente, tipo })
    }

    function restablecerZoom() {
        cambiarTramoDetallado(null)
        cambiarFranjaSeleccionada(null)
    }

    function seleccionarFranja(inicio, fin) {
        const duracion = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / 1000))
        const ventanas = VENTANAS_ZOOM_SEGUNDOS
        const ventanaSegundos = ventanas.find(ventana => ventana >= duracion * 1.25) ?? ventanas.at(-1)
        cambiarRegistroSeleccionado(null)
        cambiarPlanSeleccionado(null)
        cambiarFranjaSeleccionada({
            referencia: { id: "franja-seleccionada", inicio, fin },
            centro: new Date((inicio.getTime() + fin.getTime()) / 2),
            ventanaSegundos
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
            cambiarTramoDetallado(null)
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
            cambiarTramoDetallado(null)
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
        cambiarTramoDetallado(null)
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
        cambiarTramoDetallado(null)
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

        if (registro.eventoId && !evento) {
            cambiarEstadoAjuste({
                error: "No se pudo ajustar el registro porque su plantilla vinculada no está disponible."
            })
            return
        }

        const resultado = onEditarRegistro(registro.id, {
            nombre: registro.nombre,
            evento,
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
        if (plan.eventoId && !evento) {
            cambiarEstadoAjuste({ error: "No se pudo ajustar la planificación porque su plantilla vinculada no está disponible." })
            return
        }
        const resultado = onActualizarPlan(plan.idRecurrencia ?? plan.id, {
            nombre: plan.nombre,
            evento,
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
                                    disabled={!tramoDetallado}
                                    onClick={() => cambiarZoom(-1)}
                                >−</button>
                                <output aria-live="polite">{tramoDetallado ? etiquetaVentanaZoom(tramoDetallado.ventanaSegundos) : "24 h"}</output>
                                <button
                                    type="button"
                                    aria-label="Acercar calendario"
                                    disabled={tramoDetallado?.ventanaSegundos === VENTANAS_ZOOM_SEGUNDOS[0]}
                                    onClick={() => cambiarZoom(1)}
                                >+</button>
                                <button
                                    type="button"
                                    className="boton-restablecer-zoom"
                                    disabled={!tramoDetallado && !franjaSeleccionada}
                                    onClick={restablecerZoom}
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
            {!tramoDetallado && franjaSeleccionada && (
                <p className="mensaje-ajuste-calendario" role="status">
                    Franja seleccionada: {formatearInstante(franjaSeleccionada.referencia.inicio, { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })} – {formatearInstante(franjaSeleccionada.referencia.fin, { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })}. Toca «Acercar calendario» para enfocarla.
                </p>
            )}
            {!planesDisponibles && (
                <p className="mensaje-ajuste-calendario" role="alert">
                    No se pueden mostrar ni modificar los planes porque los datos guardados no se pudieron cargar.
                </p>
            )}

            {tramoDetallado ? (
                <DetalleTramo
                    tramo={tramoDetallado}
                    fragmentosCalendario={fragmentosCalendario}
                    eventos={eventos}
                    tareas={tareas}
                    edicionDirectaHabilitada={edicionDirectaHabilitada}
                    onAjustarRegistro={ajustarRegistroDesdeCalendario}
                    onAjustarPlan={ajustarPlanDesdeCalendario}
                />
            ) : vista === "dia" ? (
                <VistaCalendarioDia
                    escalaCalendario={escalaCalendario}
                    fechaISO={fechaISO}
                    fechaVisible={fechaVisible}
                    fragmentos={fragmentosDia}
                    fragmentosPlanes={fragmentosPlanesDia}
                    tarjetasSecuenciales={aplicacionesCronometroDia.map(({ ancla, actividades }) => {
                        const sesion = seguimientoPlanificacion?.estado?.idAplicacionPlantilla === ancla.idAplicacionPlantilla ? seguimientoPlanificacion.estado : null
                        const primero = actividades[0]
                        const horaAncla = formatearInstante(ancla.inicio, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
                        const iniciar = (planId, modo) => {
                            const resultado = seguimientoPlanificacion?.empezar(planId, modo, planesVisibles, eventos)
                            cambiarEstadoAjuste(resultado?.ok ? { mensaje: "Empezó el seguimiento de la planificación." } : { error: resultado?.error ?? "No se pudo iniciar el cronómetro." })
                        }
                        return <section className="tarjeta-secuencia-cronometro" key={ancla.idAplicacionPlantilla} style={{ top: `${((ancla.inicio.getHours() * 3600 + ancla.inicio.getMinutes() * 60 + ancla.inicio.getSeconds()) / 86400) * 100}%` }} aria-label={`Planificación ${ancla.plantillaOrigenNombre}`}>
                            <header><div><h3>{ancla.plantillaOrigenNombre}</h3><p>Secuencia sin duraciones · inicio previsto {horaAncla}</p></div><span>{sesion ? "En seguimiento" : "Pendiente"}</span></header>
                            <ol>{actividades.map(plan => {
                                const elemento = sesion?.secuencia.find(item => item.planId === plan.id)
                                const activo = sesion?.registrosActivos?.find(item => item.planId === plan.id)
                                const completado = sesion?.finalizados?.includes(plan.id)
                                const omitido = sesion?.eventosOmitidos?.includes(plan.id)
                                return <li key={plan.id} className={activo ? "secuencia-cronometro-activo" : ""}>
                                    <span>{elemento?.nombre ?? eventos.find(evento => evento.id === plan.eventoId)?.nombre ?? plan.nombre}</span>
                                    <span>{activo ? "En curso" : completado ? "Finalizado" : omitido ? "Omitido" : "Pendiente"}</span>
                                    {!sesion && <button type="button" onClick={() => iniciar(plan.id, "actual")}>Iniciar este evento</button>}
                                </li>
                            })}</ol>
                            {!sesion && actividades.filter(plan => (plan.grupoCronometro ?? 0) === (primero.grupoCronometro ?? 0)).length > 1
                                && <button type="button" className="secuencia-cronometro-iniciar-grupo" onClick={() => iniciar(primero.id, "grupo")}>Iniciar juntos los eventos de la primera etapa</button>}
                            {sesion && <p>Los cronómetros de los eventos activos continúan por separado. Podés iniciar la siguiente etapa desde el panel de seguimiento.</p>}
                        </section>
                    })}
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
                    onAjustarPlan={ajustarPlanDesdeCalendario}
                    onAjustarRegistro={ajustarRegistroDesdeCalendario}
                    edicionDirectaHabilitada={edicionDirectaHabilitada}
                    idAplicacionArmada={idAplicacionArmada}
                    planActivoSeguimientoId={planActivoSeguimientoId}
                />
            )}
            {formulario && (
                <FormularioRegistro
                    key={formulario.registro?.id ?? `nuevo-${fechaISO}`}
                    registro={formulario.registro ?? null}
                    fechaSeleccionada={fechaSeleccionada}
                    eventos={eventos}
                    tareas={tareas}
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
                    onGuardar={guardarPlanDesdeFormulario}
                    onCrearRecurrencia={crearRecurrenciaDesdeFormulario}
                    onCancelar={() => cambiarFormularioPlan(null)}
                />
            )}

            {!tramoDetallado && !formulario && registroSeleccionado && (
                <DetalleRegistro
                    registro={registroSeleccionado}
                    tareas={tareas}
                    onEditar={editarRegistro}
                    onEliminar={eliminarDesdeDetalle}
                    onCerrar={() => cambiarRegistroSeleccionado(null)}
                />
            )}
            {!formularioPlan && !formulario && !tramoDetallado && planSeleccionado && (
                <DetallePlan
                    plan={planSeleccionado}
                    evento={eventos.find(evento => evento.id === planSeleccionado.eventoId)}
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
                        const resultado = seguimientoPlanificacion?.empezar(id, modo, planesVisibles, eventos)
                        if (resultado?.ok) cambiarPlanSeleccionado(null)
                        return resultado
                    }}
                    onMoverAplicacion={() => {
                        cambiarIdAplicacionArmada(planSeleccionado.idAplicacionPlantilla)
                        cambiarEdicionDirectaHabilitada(true)
                        cambiarPlanSeleccionado(null)
                    }}
                />
            )}
        </section>
    )
})
