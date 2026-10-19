import { useRef, useState } from "react"

import { formatearInstante } from "../../domain/tiempo/historial.js"
import { ESTADO_REGISTRO_FINALIZADO } from "../../domain/registros/registros.js"
import { ajustarExtremoSegmentosRegistro, desplazarSegmentosRegistro } from "./ajustesRegistroCalendario.js"

const formatoHora = { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }
const formatoFechaHora = { dateStyle: "short", timeStyle: "medium" }

function formatoExacto(instante) {
    return formatearInstante(instante, formatoHora)
}

function obtenerFragmentos(fragmentosCalendario, inicioTramo, finTramo) {
    return fragmentosCalendario.flatMap(fragmento => {
        const inicioVisible = new Date(Math.max(fragmento.inicio.getTime(), inicioTramo.getTime()))
        const finVisible = new Date(Math.min(fragmento.fin.getTime(), finTramo.getTime()))
        if (finVisible <= inicioVisible) return []
        return [{
            ...fragmento,
            tipo: fragmento.tipoVisual,
            inicioReal: fragmento.inicio,
            finReal: fragmento.fin,
            inicioVisible,
            finVisible
        }]
    })
}

function pasoMarcas(ventanaSegundos) {
    if (ventanaSegundos <= 10) return 1
    if (ventanaSegundos <= 60) return 5
    if (ventanaSegundos <= 300) return 10
    if (ventanaSegundos <= 1800) return 30
    if (ventanaSegundos <= 7200) return 300
    return 1800
}

function ajustarSegmentosPorSegundos(registro, modo, segundos) {
    const desplazamiento = { segundos }
    return modo === "mover"
        ? desplazarSegmentosRegistro(registro, desplazamiento)
        : ajustarExtremoSegmentosRegistro(registro, { extremo: modo, ...desplazamiento })
}

export function DetalleTramo({ tramo, fragmentosCalendario = [], eventos = [], edicionDirectaHabilitada, onAjustarRegistro, onAjustarPlan }) {
    const gestoRef = useRef(null)
    const [desplazamientoVista, cambiarDesplazamientoVista] = useState(null)
    const ventanaSegundos = tramo.ventanaSegundos
    const duracionMs = ventanaSegundos * 1000
    const inicioTramo = new Date(tramo.centro.getTime() - duracionMs / 2)
    const finTramo = new Date(tramo.centro.getTime() + duracionMs / 2)
    const pixelesPorSegundo = Math.min(10, 9000 / ventanaSegundos)
    const altoTramo = ventanaSegundos * pixelesPorSegundo
    const paso = pasoMarcas(ventanaSegundos)
    const primeraMarca = Math.ceil(inicioTramo.getTime() / (paso * 1000)) * paso * 1000
    const marcas = []
    for (let instante = primeraMarca; instante <= finTramo.getTime(); instante += paso * 1000) {
        marcas.push(new Date(instante))
    }
    const fragmentos = obtenerFragmentos(fragmentosCalendario, inicioTramo, finTramo)

    function iniciarMovimiento(evento, fragmento) {
        const elemento = fragmento.tipo === "plan" ? fragmento.plan : fragmento.registro
        if (!edicionDirectaHabilitada
            || (fragmento.tipo === "registro" && elemento.estado !== ESTADO_REGISTRO_FINALIZADO)
            || !evento.isPrimary
            || (evento.pointerType === "mouse" && evento.button !== 0)) return

        gestoRef.current = {
            pointerId: evento.pointerId,
            y: evento.clientY,
            elemento,
            tipo: fragmento.tipo,
            modo: evento.target instanceof Element
                ? evento.target.closest("[data-extremo]")?.dataset.extremo ?? "mover"
                : "mover",
            arrastrando: false
        }
        evento.currentTarget.setPointerCapture(evento.pointerId)
    }

    function moverMovimiento(evento) {
        const gesto = gestoRef.current
        if (!gesto || gesto.pointerId !== evento.pointerId) return
        const deltaY = evento.clientY - gesto.y
        if (!gesto.arrastrando && Math.abs(deltaY) < 4) return
        gesto.arrastrando = true
        cambiarDesplazamientoVista({ id: gesto.elemento.id, y: deltaY, modo: gesto.modo })
    }

    function terminarMovimiento(evento) {
        const gesto = gestoRef.current
        if (!gesto || gesto.pointerId !== evento.pointerId) return
        gestoRef.current = null
        cambiarDesplazamientoVista(null)
        if (!gesto.arrastrando) return

        const segundos = Math.round((evento.clientY - gesto.y) / pixelesPorSegundo)
        if (segundos === 0) return
        if (gesto.tipo === "plan") {
            const cambios = gesto.modo === "mover"
                ? {
                    inicio: new Date(gesto.elemento.inicio.getTime() + segundos * 1000),
                    fin: new Date(gesto.elemento.fin.getTime() + segundos * 1000)
                }
                : {
                    inicio: gesto.modo === "inicio"
                        ? new Date(gesto.elemento.inicio.getTime() + segundos * 1000)
                        : gesto.elemento.inicio,
                    fin: gesto.modo === "fin"
                        ? new Date(gesto.elemento.fin.getTime() + segundos * 1000)
                        : gesto.elemento.fin
                }
            onAjustarPlan?.(gesto.elemento, cambios, gesto.modo)
            return
        }
        const segmentos = ajustarSegmentosPorSegundos(gesto.elemento, gesto.modo, segundos)
        if (!segmentos) return
        onAjustarRegistro(gesto.elemento, segmentos, gesto.modo)
    }

    function ajustarComTeclado(evento, elemento, tipo) {
        if (!edicionDirectaHabilitada || (tipo === "registro" && elemento.estado !== ESTADO_REGISTRO_FINALIZADO)
            || !["ArrowUp", "ArrowDown"].includes(evento.key)) return
        evento.preventDefault()
        const modo = evento.altKey ? "inicio" : evento.shiftKey ? "fin" : "mover"
        const segundos = evento.key === "ArrowUp" ? -1 : 1
        if (tipo === "plan") {
            const cambios = modo === "mover"
                ? { inicio: new Date(elemento.inicio.getTime() + segundos * 1000), fin: new Date(elemento.fin.getTime() + segundos * 1000) }
                : { inicio: modo === "inicio" ? new Date(elemento.inicio.getTime() + segundos * 1000) : elemento.inicio,
                    fin: modo === "fin" ? new Date(elemento.fin.getTime() + segundos * 1000) : elemento.fin }
            onAjustarPlan?.(elemento, cambios, modo)
            return
        }
        const segmentos = ajustarSegmentosPorSegundos(elemento, modo, segundos)
        if (!segmentos) return
        onAjustarRegistro(elemento, segmentos, modo)
    }

    function cancelarMovimiento(evento) {
        if (gestoRef.current?.pointerId !== evento.pointerId) return
        gestoRef.current = null
        cambiarDesplazamientoVista(null)
    }

    return (
        <div className="calendario-dia-scroll calendario-zoom-ventana">
            <div
                className="detalle-tramo-scroll calendario-zoom-contenido"
                role="group"
                aria-label="Calendario con zoom; con edición directa podés mover registros y ajustar sus extremos"
            >
                <div className="detalle-tramo-linea" style={{ height: `${altoTramo}px` }}>
                    {marcas.map(marca => (
                        <div className="marca-tiempo-tramo" key={marca.getTime()} style={{ top: `${((marca.getTime() - inicioTramo.getTime()) / 1000) * pixelesPorSegundo}px` }}>
                            <time dateTime={marca.toISOString()}>{formatoExacto(marca)}</time>
                        </div>
                    ))}
                    {fragmentos.map(fragmento => {
                        const arriba = ((fragmento.inicioVisible.getTime() - inicioTramo.getTime()) / 1000) * pixelesPorSegundo
                        const alto = ((fragmento.finVisible.getTime() - fragmento.inicioVisible.getTime()) / 1000) * pixelesPorSegundo
                        const left = `calc(${(fragmento.carril * 100) / fragmento.cantidadCarriles}% + 76px)`
                        const width = `calc(${100 / fragmento.cantidadCarriles}% - 82px)`

                        if (fragmento.tipo === "plan") {
                            const evento = eventos.find(elemento => elemento.id === fragmento.plan.eventoId)
                            const nombre = evento?.nombre ?? fragmento.plan.nombre
                            const editable = edicionDirectaHabilitada
                            const desplazamiento = desplazamientoVista?.id === fragmento.plan.id ? desplazamientoVista : null
                            const esInicioReal = fragmento.inicioReal.getTime() === fragmento.plan.inicio.getTime()
                            const esFinReal = fragmento.finReal.getTime() === fragmento.plan.fin.getTime()
                            const arribaVisible = desplazamiento?.modo === "inicio" ? arriba + desplazamiento.y : arriba
                            const altoVisible = desplazamiento?.modo === "inicio"
                                ? alto - desplazamiento.y
                                : desplazamiento?.modo === "fin" ? alto + desplazamiento.y : alto
                            return (
                                <div className={`bloque-detalle-plan ${editable ? "bloque-detalle-tramo-editable" : ""} ${desplazamiento ? "bloque-detalle-tramo-arrastrando" : ""}`} key={fragmento.id}
                                    aria-label={`Planificado: ${nombre}, ${formatoExacto(fragmento.inicioReal)} a ${formatoExacto(fragmento.finReal)}`}
                                    aria-description={editable ? "Arrastrá para mover. Flechas: mover un segundo. Mayúsculas más flecha: ajustar el fin. Alt más flecha: ajustar el inicio." : undefined}
                                    tabIndex={editable ? 0 : undefined} role={editable ? "group" : "img"}
                                    style={{ top: `${arribaVisible}px`, height: `${altoVisible}px`, left, width, "--color-plan": evento?.color ?? fragmento.plan.colorEvento ?? "#0F766E", transform: desplazamiento ? `translateY(${desplazamiento.y}px)` : undefined }}
                                    onPointerDown={evento => iniciarMovimiento(evento, fragmento)} onPointerMove={moverMovimiento}
                                    onPointerUp={terminarMovimiento} onPointerCancel={cancelarMovimiento}
                                    onKeyDown={evento => ajustarComTeclado(evento, fragmento.plan, "plan")}>
                                    {editable && esInicioReal && <span className="control-bloque-detalle control-bloque-detalle-inicio" data-extremo="inicio" aria-hidden="true" />}
                                    <span>{nombre}</span>
                                    <small>{formatoExacto(fragmento.inicioReal)} – {formatoExacto(fragmento.finReal)}</small>
                                    {editable && esFinReal && <span className="control-bloque-detalle control-bloque-detalle-fin" data-extremo="fin" aria-hidden="true" />}
                                </div>
                            )
                        }

                        const etiqueta = `${fragmento.registro.nombre}, ${fragmento.segmento.tipo}, ${formatearInstante(fragmento.inicioReal, formatoFechaHora)} a ${fragmento.abierto ? "en curso" : formatearInstante(fragmento.finReal, formatoFechaHora)}`
                        const editable = edicionDirectaHabilitada && fragmento.registro.estado === ESTADO_REGISTRO_FINALIZADO
                        const esInicioReal = fragmento.inicioReal.getTime() === fragmento.registro.segmentos[0].inicio.getTime()
                        const esFinReal = fragmento.segmento === fragmento.registro.segmentos.at(-1)
                            && fragmento.segmento.fin !== null
                            && fragmento.finReal.getTime() === fragmento.segmento.fin.getTime()
                        const desplazamientoEsDeEsteTramo = desplazamientoVista?.id === fragmento.registro.id
                            && (desplazamientoVista.modo === "mover"
                                || (desplazamientoVista.modo === "inicio" && esInicioReal)
                                || (desplazamientoVista.modo === "fin" && esFinReal))
                        const desplazamiento = desplazamientoEsDeEsteTramo ? desplazamientoVista : null
                        const arribaVisible = desplazamiento?.modo === "inicio" ? arriba + desplazamiento.y : arriba
                        const altoVisible = desplazamiento?.modo === "inicio"
                            ? alto - desplazamiento.y
                            : desplazamiento?.modo === "fin" ? alto + desplazamiento.y : alto

                        return (
                            <div className={`bloque-detalle-tramo ${fragmento.segmento.tipo === "Pausado" ? "bloque-registro-pausado" : ""} ${editable ? "bloque-detalle-tramo-editable" : ""} ${desplazamiento ? "bloque-detalle-tramo-arrastrando" : ""}`}
                                key={fragmento.id}
                                style={{ top: `${arribaVisible}px`, height: `${altoVisible}px`, left, width,
                                    "--color-evento": fragmento.registro.colorEvento ?? "#4F46E5",
                                    transform: desplazamiento ? `translateY(${desplazamiento.y}px)` : undefined }}
                                aria-label={etiqueta}
                                aria-description={editable ? "Arrastrá para mover. Flechas: mover un segundo. Mayúsculas más flecha: ajustar el fin. Alt más flecha: ajustar el inicio." : undefined}
                                title={etiqueta} data-registro-id={fragmento.registro.id} tabIndex={editable ? 0 : undefined}
                                role={editable ? "group" : undefined}
                                onPointerDown={evento => iniciarMovimiento(evento, fragmento)}
                                onPointerMove={moverMovimiento} onPointerUp={terminarMovimiento}
                                onPointerCancel={cancelarMovimiento}
                                onKeyDown={evento => ajustarComTeclado(evento, fragmento.registro, "registro")}>
                                {editable && esInicioReal && <span className="control-bloque-detalle control-bloque-detalle-inicio" data-extremo="inicio" aria-hidden="true" />}
                                <span className="bloque-detalle-tramo-nombre">{fragmento.registro.nombre}</span>
                                <span className="bloque-detalle-tramo-estado">{fragmento.segmento.tipo === "Pausado" ? "En pausa" : "En curso"}</span>
                                {editable && esFinReal && <span className="control-bloque-detalle control-bloque-detalle-fin" data-extremo="fin" aria-hidden="true" />}
                            </div>
                        )
                    })}
                </div>
            </div>

        </div>
    )
}
