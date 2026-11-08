import { useRef, useState } from "react"

import { formatearInstante } from "../../domain/tiempo/historial.js"
import { ALTURA_HORA_BASE } from "./zoomCalendario.js"

const opcionesHora = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
const duracionRelativa = segundos => `${String(Math.floor(segundos / 3600)).padStart(2, "0")}:${String(Math.floor(segundos % 3600 / 60)).padStart(2, "0")}:${String(Math.floor(segundos % 60)).padStart(2, "0")}`

const formatoFechaSemana = new Intl.DateTimeFormat("es-AR", {
    weekday: "long", day: "numeric", month: "long"
})

function fechaBajoPuntero(evento, fechaPorDefecto) {
    const elemento = document.elementFromPoint(evento.clientX, evento.clientY)
    return elemento?.closest("[data-fecha]")?.dataset.fecha ?? fechaPorDefecto
}

function diferenciaDias(fechaInicial, fechaFinal) {
    const instanteUTC = fecha => {
        const [anio, mes, dia] = fecha.split("-").map(Number)
        return Date.UTC(anio, mes - 1, dia)
    }
    return Math.round((instanteUTC(fechaFinal) - instanteUTC(fechaInicial)) / 86400000)
}

export function BloquePlan({
    fragmento,
    evento,
    onSeleccionar,
    onAjustarPlan,
    edicionDirectaHabilitada,
    estaEnSeguimiento = false,
    permiteCambiarDia = false,
    tiempoRelativo = false,
    compacto = false,
    anchoCarril = 0,
    escalaTemporal = null
}) {
    const gestoRef = useRef(null)
    const ignorarClickRef = useRef(false)
    const [vistaGesto, cambiarVistaGesto] = useState(null)
    const { plan, minutosInicio, minutosFin, carril, cantidadCarriles } = fragmento
    const nombre = evento?.nombre ?? plan.nombre
    const color = evento?.color ?? plan.colorEvento ?? "#0F766E"
    const contextoDia = permiteCambiarDia ? formatoFechaSemana.format(fragmento.inicio) + ", " : ""
    const etiquetaOrden = Number.isInteger(plan.ordenSeguimiento)
        ? `Orden de seguimiento ${plan.ordenSeguimiento + 1}. `
        : ""
    const segundosDesdeInicio = fragmento.plan.inicio.getHours() * 3600 + fragmento.plan.inicio.getMinutes() * 60 + fragmento.plan.inicio.getSeconds()
    const duracionSegundos = Math.round((fragmento.plan.fin.getTime() - fragmento.plan.inicio.getTime()) / 1000)
    const etiqueta = tiempoRelativo
        ? `${etiquetaOrden}${plan.tipoPlanificacion === "focus" ? "Sesión Focus planificada" : "Planificado"}: ${nombre}, inicio +${duracionRelativa(segundosDesdeInicio)}, duración ${duracionRelativa(duracionSegundos)}`
        : `${etiquetaOrden}${plan.tipoPlanificacion === "focus" ? "Sesión Focus planificada" : "Planificado"}: ${nombre}, ${contextoDia}${formatearInstante(fragmento.inicio, opcionesHora)} a ${formatearInstante(fragmento.fin, opcionesHora)}`
    const top = escalaTemporal
        ? ((fragmento.inicio.getTime() - escalaTemporal.inicio.getTime()) / (escalaTemporal.duracionSegundos * 1000)) * 100
        : (minutosInicio / 1440) * 100
    const height = escalaTemporal
        ? ((fragmento.fin.getTime() - fragmento.inicio.getTime()) / (escalaTemporal.duracionSegundos * 1000)) * 100
        : ((minutosFin - minutosInicio) / 1440) * 100
    const altoVisual = escalaTemporal
        ? (fragmento.fin.getTime() - fragmento.inicio.getTime()) / 1000 * escalaTemporal.pixelesPorSegundo
        : (minutosFin - minutosInicio) * ALTURA_HORA_BASE / 60
    const muestraNombre = altoVisual >= 28 && anchoCarril >= 120
    const muestraHorario = altoVisual >= 44 && anchoCarril >= 150
    const esExtremoInicio = fragmento.inicio.getTime() === plan.inicio.getTime()
    const esExtremoFin = fragmento.fin.getTime() === plan.fin.getTime()
    const esFocus = plan.tipoPlanificacion === "focus"
    const atajosTeclado = "ArrowUp ArrowDown Shift+ArrowUp Shift+ArrowDown Alt+ArrowUp Alt+ArrowDown"
        + (permiteCambiarDia ? " Alt+ArrowLeft Alt+ArrowRight" : "")

    function iniciarGesto(eventoPuntero) {
        if (!edicionDirectaHabilitada || !eventoPuntero.isPrimary || (eventoPuntero.pointerType === "mouse" && eventoPuntero.button !== 0)) return
        const calendario = eventoPuntero.currentTarget.closest(".calendario-dia-scroll, .calendario-semana-scroll")
        const alturaHora = Number.parseFloat(getComputedStyle(calendario).getPropertyValue("--altura-hora"))
        const caja = eventoPuntero.currentTarget.getBoundingClientRect()
        const control = eventoPuntero.target instanceof Element ? eventoPuntero.target.closest("[data-extremo]") : null
        let modo = control?.dataset.extremo ?? "mover"
        if (esFocus && modo !== "mover") return
        if (modo !== "mover" && caja.height < 24) modo = "mover"
        gestoRef.current = {
            idPuntero: eventoPuntero.pointerId,
            xInicial: eventoPuntero.clientX,
            yInicial: eventoPuntero.clientY,
            fechaInicial: fragmento.fechaISO,
            pixelesPorMinuto: Number.isFinite(alturaHora) && alturaHora > 0 ? alturaHora / 60 : 64 / 60,
            modo,
            arrastrado: false
        }
        eventoPuntero.currentTarget.setPointerCapture(eventoPuntero.pointerId)
    }

    function moverGesto(eventoPuntero) {
        const gesto = gestoRef.current
        if (!gesto || gesto.idPuntero !== eventoPuntero.pointerId) return
        const x = eventoPuntero.clientX - gesto.xInicial
        const y = eventoPuntero.clientY - gesto.yInicial
        if (!gesto.arrastrado && Math.hypot(x, y) < 4) return
        gesto.arrastrado = true
        cambiarVistaGesto({ modo: gesto.modo, x, y })
    }

    function terminarGesto(eventoPuntero) {
        const gesto = gestoRef.current
        if (!gesto || gesto.idPuntero !== eventoPuntero.pointerId) return
        gestoRef.current = null
        cambiarVistaGesto(null)
        if (!gesto.arrastrado) return
        ignorarClickRef.current = true
        setTimeout(() => { ignorarClickRef.current = false }, 0)
        const minutos = Math.round((eventoPuntero.clientY - gesto.yInicial) / gesto.pixelesPorMinuto)
        const fechaFinal = permiteCambiarDia
            ? fechaBajoPuntero(eventoPuntero, gesto.fechaInicial)
            : gesto.fechaInicial
        const dias = permiteCambiarDia ? diferenciaDias(gesto.fechaInicial, fechaFinal) : 0
        guardarAjuste(gesto.modo, dias, minutos)
    }

    function cancelarGesto(eventoPuntero) {
        if (gestoRef.current?.idPuntero !== eventoPuntero.pointerId) return
        gestoRef.current = null
        cambiarVistaGesto(null)
    }

    function guardarAjuste(modo, dias, minutos) {
        if (!dias && !minutos) return
        const inicio = new Date(plan.inicio)
        const fin = new Date(plan.fin)
        if (modo === "mover") {
            inicio.setDate(inicio.getDate() + dias)
            fin.setDate(fin.getDate() + dias)
            inicio.setMinutes(inicio.getMinutes() + minutos)
            fin.setMinutes(fin.getMinutes() + minutos)
        } else if (modo === "inicio") {
            inicio.setDate(inicio.getDate() + dias)
            inicio.setMinutes(inicio.getMinutes() + minutos)
        } else {
            fin.setDate(fin.getDate() + dias)
            fin.setMinutes(fin.getMinutes() + minutos)
        }
        onAjustarPlan(plan, { inicio, fin }, modo)
    }

    function ajustarComTeclado(eventoTeclado) {
        if (!edicionDirectaHabilitada) return
        if (permiteCambiarDia && eventoTeclado.altKey && ["ArrowLeft", "ArrowRight"].includes(eventoTeclado.key)) {
            eventoTeclado.preventDefault()
            eventoTeclado.stopPropagation()
            guardarAjuste("mover", eventoTeclado.key === "ArrowLeft" ? -1 : 1, 0)
            return
        }
        if (!["ArrowUp", "ArrowDown"].includes(eventoTeclado.key)) return
        eventoTeclado.preventDefault()
        eventoTeclado.stopPropagation()
        const modo = eventoTeclado.altKey ? "inicio" : eventoTeclado.shiftKey ? "fin" : "mover"
        if (esFocus && modo !== "mover") return
        guardarAjuste(modo, 0, eventoTeclado.key === "ArrowUp" ? -1 : 1)
    }

    const style = {
        top: `${top}%`,
        height: `${height}%`,
        left: `calc(${(carril * 100) / cantidadCarriles}% + 2px)`,
        width: `calc(${100 / cantidadCarriles}% - 4px)`,
        "--color-plan": color
    }
    if (compacto) {
        style.height = "28px"
        style.width = "28px"
        style.left = `calc(${((carril + 0.5) * 100) / cantidadCarriles}%)`
        style.transform = "translateX(-50%)"
    }
    if (esFocus) {
        const total = plan.configuracionFocus.bloques.reduce((suma, bloque) => suma + bloque.minutos, 0)
        let acumulado = 0
        const paradas = plan.configuracionFocus.bloques.flatMap(bloque => {
            const desde = acumulado / total * 100
            acumulado += bloque.minutos
            const hasta = acumulado / total * 100
            const colorBloque = plan.configuracionFocus.colores?.[bloque.tipo]
                ?? (bloque.tipo === "concentracion" ? "#6366f1" : "#10b981")
            const tono = `color-mix(in srgb, ${colorBloque}, white 68%)`
            return [`${tono} ${desde}%`, `${tono} ${hasta}%`]
        })
        style.background = `linear-gradient(to bottom, ${paradas.join(", ")})`
    }
    if (vistaGesto?.modo === "mover") style.transform = compacto
        ? `translate(calc(-50% + ${vistaGesto.x}px), ${vistaGesto.y}px)`
        : `translate(${vistaGesto.x}px, ${vistaGesto.y}px)`
    else if (vistaGesto?.modo === "inicio") {
        style.top = `calc(${top}% + ${vistaGesto.y}px)`
        style.height = `calc(${height}% - ${vistaGesto.y}px)`
    } else if (vistaGesto?.modo === "fin") style.height = `calc(${height}% + ${vistaGesto.y}px)`

    return (
        <button
            type="button"
            className={`bloque-plan ${compacto ? "bloque-plan-compacto" : ""} ${!compacto && !muestraNombre ? "bloque-plan-sin-texto" : ""} ${edicionDirectaHabilitada ? "bloque-plan-editable" : ""} ${estaEnSeguimiento ? "bloque-plan-en-seguimiento" : ""} ${vistaGesto ? "bloque-plan-arrastrando" : ""}`}
            style={style}
            aria-label={etiqueta}
            aria-description={edicionDirectaHabilitada
                ? `Arrastrá para mover. Flechas arriba y abajo: mover un minuto. Mayúsculas más flecha: cambiar el fin. Alt más flecha: cambiar el inicio.${permiteCambiarDia ? " En vista semanal, Alt más flecha izquierda o derecha: mover de día." : ""}`
                : estaEnSeguimiento ? "Evento actual del seguimiento; sus horarios y datos están protegidos hasta que termine."
                    : undefined}
            aria-keyshortcuts={edicionDirectaHabilitada
                ? atajosTeclado
                : undefined}
            title={etiqueta}
            onPointerDown={iniciarGesto}
            onPointerMove={moverGesto}
            onPointerUp={terminarGesto}
            onPointerCancel={cancelarGesto}
            onKeyDown={ajustarComTeclado}
            onClick={() => {
                if (ignorarClickRef.current) {
                    ignorarClickRef.current = false
                    return
                }
                onSeleccionar(plan, fragmento)
            }}
        >
            {compacto && <span className="marca-bloque-compacto marca-bloque-plan" aria-hidden="true" />}
            {!compacto && edicionDirectaHabilitada && !esFocus && esExtremoInicio && <span className="control-bloque-registro control-bloque-plan control-bloque-inicio" data-extremo="inicio" aria-hidden="true" />}
            {!compacto && muestraNombre && <span aria-hidden="true">{esFocus ? `Sesión Focus: ${nombre}` : `Plan: ${nombre}`}</span>}
            {!compacto && muestraNombre && muestraHorario && esFocus && <small aria-hidden="true">{plan.configuracionFocus.bloques.map(bloque => bloque.tipo === "concentracion" ? "Concentración" : "Descanso").join(" · ")}</small>}
            {!compacto && muestraNombre && muestraHorario && Number.isInteger(plan.ordenSeguimiento) && <small className="bloque-plan-orden" aria-hidden="true">Orden {plan.ordenSeguimiento + 1}</small>}
            {!compacto && muestraNombre && muestraHorario && <small aria-hidden="true">
                {tiempoRelativo
                    ? `+${duracionRelativa(segundosDesdeInicio)} · ${duracionRelativa(duracionSegundos)} de duración`
                    : `${formatearInstante(fragmento.inicio, opcionesHora)} – ${formatearInstante(fragmento.fin, opcionesHora)}`}
            </small>}
            {!compacto && edicionDirectaHabilitada && !esFocus && esExtremoFin && <span className="control-bloque-registro control-bloque-plan control-bloque-fin" data-extremo="fin" aria-hidden="true" />}
        </button>
    )
}
