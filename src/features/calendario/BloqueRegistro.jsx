import { useRef, useState } from "react"

import { useReloj } from "../../app/useReloj.js"
import { ESTADO_REGISTRO_FINALIZADO } from "../../domain/registros/registros.js"
import { formatearInstante } from "../../domain/tiempo/historial.js"
import {
    ajustarExtremoSegmentosRegistro,
    desplazarSegmentosRegistro
} from "./ajustesRegistroCalendario.js"

const opcionesHora = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
const formatoFechaSemana = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long"
})

function hora(instante) {
    return formatearInstante(instante, opcionesHora)
}

function diferenciaDias(fechaInicial, fechaFinal) {
    const instanteUTC = fecha => {
        const [anio, mes, dia] = fecha.split("-").map(Number)
        return Date.UTC(anio, mes - 1, dia)
    }

    return Math.round((instanteUTC(fechaFinal) - instanteUTC(fechaInicial)) / 86400000)
}

function fechaBajoPuntero(evento, fechaPorDefecto) {
    const elemento = document.elementFromPoint(evento.clientX, evento.clientY)
    return elemento?.closest("[data-fecha]")?.dataset.fecha ?? fechaPorDefecto
}

function BloqueRegistroBase({
    fragmento,
    onSeleccionar,
    onAjustarRegistro,
    edicionDirectaHabilitada,
    permiteCambiarDia,
    ahora
}) {
    const gestoRef = useRef(null)
    const ignorarClickRef = useRef(false)
    const [vistaGesto, cambiarVistaGesto] = useState(null)
    const { registro, segmento, minutosInicio, abierto, carril, cantidadCarriles } = fragmento
    let minutosFin = fragmento.minutosFin

    if (abierto && ahora) {
        const finDinamico = Math.min(
            Math.max(ahora.getTime(), fragmento.inicio.getTime() + 1000),
            fragmento.finMaximoVisible.getTime()
        )
        const finFecha = new Date(finDinamico)
        minutosFin = finDinamico === fragmento.finMaximoVisible.getTime()
            ? 1440
            : finFecha.getHours() * 60 + finFecha.getMinutes()
                + finFecha.getSeconds() / 60 + finFecha.getMilliseconds() / 60000
    }

    const top = (minutosInicio / 1440) * 100
    const height = ((minutosFin - minutosInicio) / 1440) * 100
    const color = registro.colorEvento ?? "#4F46E5"
    const finalizado = registro.estado === ESTADO_REGISTRO_FINALIZADO
    const esPrimerSegmento = fragmento.indiceSegmento === 0
        && fragmento.inicio.getTime() === registro.segmentos[0].inicio.getTime()
    const esUltimoSegmento = fragmento.indiceSegmento === registro.segmentos.length - 1
        && fragmento.fin.getTime() === registro.segmentos.at(-1).fin?.getTime()
    const contextoDia = permiteCambiarDia
        ? formatoFechaSemana.format(fragmento.inicio) + ", "
        : ""
    const etiqueta = registro.nombre + ", " + contextoDia + segmento.tipo + ", "
        + hora(fragmento.inicio) + " a " + (abierto ? "ahora" : hora(fragmento.fin))

    function iniciarGesto(evento) {
        if (!edicionDirectaHabilitada || !finalizado || !evento.isPrimary || (evento.pointerType === "mouse" && evento.button !== 0)) {
            return
        }

        const calendario = evento.currentTarget.closest(".calendario-dia-scroll, .calendario-semana-scroll")
        const alturaHora = Number.parseFloat(
            getComputedStyle(calendario).getPropertyValue("--altura-hora")
        )
        const caja = evento.currentTarget.getBoundingClientRect()
        const control = evento.target instanceof Element
            ? evento.target.closest("[data-extremo]")
            : null
        let modo = control?.dataset.extremo ?? "mover"

        if (modo !== "mover" && caja.height < 24) {
            modo = "mover"
        }

        gestoRef.current = {
            idPuntero: evento.pointerId,
            xInicial: evento.clientX,
            yInicial: evento.clientY,
            fechaInicial: fragmento.fechaISO,
            pixelesPorMinuto: Number.isFinite(alturaHora) && alturaHora > 0
                ? alturaHora / 60
                : 64 / 60,
            modo,
            arrastrado: false
        }
        evento.currentTarget.setPointerCapture(evento.pointerId)
    }

    function moverGesto(evento) {
        const gesto = gestoRef.current

        if (!gesto || gesto.idPuntero !== evento.pointerId) {
            return
        }

        const desplazamientoX = evento.clientX - gesto.xInicial
        const desplazamientoY = evento.clientY - gesto.yInicial

        if (!gesto.arrastrado && Math.hypot(desplazamientoX, desplazamientoY) < 4) {
            return
        }

        gesto.arrastrado = true
        cambiarVistaGesto({
            modo: gesto.modo,
            x: desplazamientoX,
            y: desplazamientoY
        })
    }

    function terminarGesto(evento) {
        const gesto = gestoRef.current

        if (!gesto || gesto.idPuntero !== evento.pointerId) {
            return
        }

        gestoRef.current = null
        cambiarVistaGesto(null)

        if (!gesto.arrastrado) {
            return
        }

        ignorarClickRef.current = true
        setTimeout(() => { ignorarClickRef.current = false }, 0)

        const minutos = Math.round(
            (evento.clientY - gesto.yInicial) / gesto.pixelesPorMinuto
        )
        const fechaFinal = permiteCambiarDia
            ? fechaBajoPuntero(evento, gesto.fechaInicial)
            : gesto.fechaInicial
        const dias = permiteCambiarDia
            ? diferenciaDias(gesto.fechaInicial, fechaFinal)
            : 0

        guardarAjuste(gesto.modo, dias, minutos)
    }

    function cancelarGesto(evento) {
        if (gestoRef.current?.idPuntero !== evento.pointerId) {
            return
        }

        gestoRef.current = null
        cambiarVistaGesto(null)
    }

    function guardarAjuste(modo, dias, minutos) {
        const segmentos = modo === "mover"
            ? desplazarSegmentosRegistro(registro, { dias, minutos })
            : ajustarExtremoSegmentosRegistro(registro, {
                extremo: modo,
                dias,
                minutos
            })

        if (segmentos) {
            onAjustarRegistro(registro, segmentos, modo)
        }
    }

    function ajustarConTeclado(evento) {
        if (!edicionDirectaHabilitada || !finalizado) {
            return
        }

        let modo = "mover"
        let dias = 0
        let minutos = 0

        if (permiteCambiarDia && evento.altKey && ["ArrowLeft", "ArrowRight"].includes(evento.key)) {
            dias = evento.key === "ArrowLeft" ? -1 : 1
        } else if (["ArrowUp", "ArrowDown"].includes(evento.key)) {
            const direccion = evento.key === "ArrowUp" ? -1 : 1
            minutos = direccion
            modo = evento.altKey ? "inicio" : evento.shiftKey ? "fin" : "mover"
        } else {
            return
        }

        evento.preventDefault()
        evento.stopPropagation()
        guardarAjuste(modo, dias, minutos)
    }

    const style = {
        top: `${top}%`,
        height: `${height}%`,
        left: `calc(${(carril * 100) / cantidadCarriles}% + 2px)`,
        width: `calc(${100 / cantidadCarriles}% - 4px)`,
        "--color-evento": color
    }

    if (vistaGesto?.modo === "mover") {
        style.transform = `translate(${vistaGesto.x}px, ${vistaGesto.y}px)`
    } else if (vistaGesto?.modo === "inicio") {
        style.top = `calc(${top}% + ${vistaGesto.y}px)`
        style.height = `calc(${height}% - ${vistaGesto.y}px)`
    } else if (vistaGesto?.modo === "fin") {
        style.height = `calc(${height}% + ${vistaGesto.y}px)`
    }

    return (
        <button
            className={`bloque-registro ${segmento.tipo === "Pausado" ? "bloque-registro-pausado" : ""} ${finalizado && edicionDirectaHabilitada ? "bloque-registro-editable" : ""} ${vistaGesto ? "bloque-registro-arrastrando" : ""}`}
            type="button"
            style={style}
            aria-label={etiqueta}
            aria-description={finalizado && edicionDirectaHabilitada
                ? "Arrastrá para mover. Flechas arriba y abajo: mover un minuto. Mayúsculas más flecha: cambiar el fin. Alt más flecha: cambiar el inicio. En vista semanal, Alt más flecha izquierda o derecha: mover de día."
                : undefined}
            aria-keyshortcuts={finalizado && edicionDirectaHabilitada
                ? "ArrowUp ArrowDown Shift+ArrowUp Shift+ArrowDown Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight"
                : undefined}
            title={etiqueta}
            onPointerDown={iniciarGesto}
            onPointerMove={moverGesto}
            onPointerUp={terminarGesto}
            onPointerCancel={cancelarGesto}
            onKeyDown={ajustarConTeclado}
            onClick={() => {
                if (ignorarClickRef.current) {
                    ignorarClickRef.current = false
                    return
                }
                onSeleccionar(registro, fragmento)
            }}
        >
            {finalizado && edicionDirectaHabilitada && esPrimerSegmento && (
                <span className="control-bloque-registro control-bloque-inicio" data-extremo="inicio" aria-hidden="true" />
            )}
            {height > 2.8 ? (
                <>
                    <span>{registro.nombre}</span>
                    <small className="estado-bloque-registro">
                        {segmento.tipo === "Pausado" ? "En pausa" : "En curso"} · {hora(fragmento.inicio)} – {abierto ? "ahora" : hora(fragmento.fin)}
                    </small>
                </>
            ) : (
                <span>{segmento.tipo === "Pausado" ? "En pausa" : "En curso"} · {registro.nombre}</span>
            )}
            {finalizado && edicionDirectaHabilitada && esUltimoSegmento && (
                <span className="control-bloque-registro control-bloque-fin" data-extremo="fin" aria-hidden="true" />
            )}
        </button>
    )
}

function BloqueRegistroEnVivo(props) {
    const ahora = useReloj()
    return <BloqueRegistroBase {...props} ahora={ahora} />
}

export function BloqueRegistro({ fragmento, onSeleccionar, onAjustarRegistro, edicionDirectaHabilitada = false, permiteCambiarDia = false }) {
    const props = { fragmento, onSeleccionar, onAjustarRegistro, edicionDirectaHabilitada, permiteCambiarDia }
    return fragmento.abierto
        ? <BloqueRegistroEnVivo {...props} />
        : <BloqueRegistroBase {...props} />
}
