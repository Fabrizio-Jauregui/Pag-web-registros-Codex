import { useRef, useState } from "react"

import { formatearInstante } from "../../domain/tiempo/historial.js"

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
    permiteCambiarDia = false,
    tiempoRelativo = false
}) {
    const gestoRef = useRef(null)
    const ignorarClickRef = useRef(false)
    const [vistaGesto, cambiarVistaGesto] = useState(null)
    const { plan, minutosInicio, minutosFin, carril, cantidadCarriles } = fragmento
    const nombre = evento?.nombre ?? plan.nombre
    const color = evento?.color ?? plan.colorEvento ?? "#0F766E"
    const contextoDia = permiteCambiarDia ? formatoFechaSemana.format(fragmento.inicio) + ", " : ""
    const segundosDesdeInicio = fragmento.plan.inicio.getHours() * 3600 + fragmento.plan.inicio.getMinutes() * 60 + fragmento.plan.inicio.getSeconds()
    const duracionSegundos = Math.round((fragmento.plan.fin.getTime() - fragmento.plan.inicio.getTime()) / 1000)
    const etiqueta = tiempoRelativo
        ? `Planificado: ${nombre}, inicio +${duracionRelativa(segundosDesdeInicio)}, duración ${duracionRelativa(duracionSegundos)}`
        : `Planificado: ${nombre}, ${contextoDia}${formatearInstante(fragmento.inicio, opcionesHora)} a ${formatearInstante(fragmento.fin, opcionesHora)}`
    const top = (minutosInicio / 1440) * 100
    const height = ((minutosFin - minutosInicio) / 1440) * 100
    const esExtremoInicio = fragmento.inicio.getTime() === plan.inicio.getTime()
    const esExtremoFin = fragmento.fin.getTime() === plan.fin.getTime()
    const atajosTeclado = "ArrowUp ArrowDown Shift+ArrowUp Shift+ArrowDown Alt+ArrowUp Alt+ArrowDown"
        + (permiteCambiarDia ? " Alt+ArrowLeft Alt+ArrowRight" : "")

    function iniciarGesto(eventoPuntero) {
        if (!edicionDirectaHabilitada || !eventoPuntero.isPrimary || (eventoPuntero.pointerType === "mouse" && eventoPuntero.button !== 0)) return
        const calendario = eventoPuntero.currentTarget.closest(".calendario-dia-scroll, .calendario-semana-scroll")
        const alturaHora = Number.parseFloat(getComputedStyle(calendario).getPropertyValue("--altura-hora"))
        const caja = eventoPuntero.currentTarget.getBoundingClientRect()
        const control = eventoPuntero.target instanceof Element ? eventoPuntero.target.closest("[data-extremo]") : null
        let modo = control?.dataset.extremo ?? "mover"
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
        guardarAjuste(modo, 0, eventoTeclado.key === "ArrowUp" ? -1 : 1)
    }

    const style = {
        top: `${top}%`,
        height: `${height}%`,
        left: `calc(${(carril * 100) / cantidadCarriles}% + 2px)`,
        width: `calc(${100 / cantidadCarriles}% - 4px)`,
        "--color-plan": color
    }
    if (vistaGesto?.modo === "mover") style.transform = `translate(${vistaGesto.x}px, ${vistaGesto.y}px)`
    else if (vistaGesto?.modo === "inicio") {
        style.top = `calc(${top}% + ${vistaGesto.y}px)`
        style.height = `calc(${height}% - ${vistaGesto.y}px)`
    } else if (vistaGesto?.modo === "fin") style.height = `calc(${height}% + ${vistaGesto.y}px)`

    return (
        <button
            type="button"
            className={`bloque-plan ${edicionDirectaHabilitada ? "bloque-plan-editable" : ""} ${vistaGesto ? "bloque-plan-arrastrando" : ""}`}
            style={style}
            aria-label={etiqueta}
            aria-description={edicionDirectaHabilitada
                ? `Arrastrá para mover. Flechas arriba y abajo: mover un minuto. Mayúsculas más flecha: cambiar el fin. Alt más flecha: cambiar el inicio.${permiteCambiarDia ? " En vista semanal, Alt más flecha izquierda o derecha: mover de día." : ""}`
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
            {edicionDirectaHabilitada && esExtremoInicio && <span className="control-bloque-registro control-bloque-plan control-bloque-inicio" data-extremo="inicio" aria-hidden="true" />}
            <span aria-hidden="true">Plan: {nombre}</span>
            {height > 1.5 && <small aria-hidden="true">
                {tiempoRelativo
                    ? `+${duracionRelativa(segundosDesdeInicio)} · ${duracionRelativa(duracionSegundos)} de duración`
                    : `${formatearInstante(fragmento.inicio, opcionesHora)} – ${formatearInstante(fragmento.fin, opcionesHora)}`}
            </small>}
            {edicionDirectaHabilitada && esExtremoFin && <span className="control-bloque-registro control-bloque-plan control-bloque-fin" data-extremo="fin" aria-hidden="true" />}
        </button>
    )
}
