import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { formatearInstante } from "../../domain/tiempo/historial.js"
import { obtenerDuracionLegible } from "./presentacionMarcasCalendario.js"

const formatoFechaHora = { dateStyle: "short", timeStyle: "medium" }

function duracion(segundos) {
    const horas = Math.floor(segundos / 3600)
    const minutos = Math.floor(segundos % 3600 / 60)
    const resto = Math.floor(segundos % 60)
    return [horas, minutos, resto].map(valor => String(valor).padStart(2, "0")).join(":")
}

function datosElemento(elemento, eventos) {
    const { tipo, fragmento } = elemento
    if (tipo === "registro") {
        const estado = fragmento.segmento.tipo === "Pausado"
            ? "En pausa"
            : fragmento.abierto
                ? "En curso"
                : "Finalizado"
        return {
            nombre: fragmento.registro.nombre,
            estado,
            color: fragmento.registro.colorEvento ?? "#4F46E5",
            inicio: fragmento.inicio,
            fin: fragmento.fin,
            finTexto: fragmento.abierto ? "ahora" : formatearInstante(fragmento.fin, formatoFechaHora),
            tipoTexto: "Registro"
        }
    }

    const evento = eventos.find(item => item.id === fragmento.plan.eventoId)
    return {
        nombre: evento?.nombre ?? fragmento.plan.nombre,
        estado: "Planificado",
        color: evento?.color ?? fragmento.plan.colorEvento ?? "#0F766E",
        inicio: fragmento.inicio,
        fin: fragmento.fin,
        finTexto: formatearInstante(fragmento.fin, formatoFechaHora),
        tipoTexto: fragmento.plan.tipoPlanificacion === "focus" ? "Sesión Focus planificada" : "Plan"
    }
}

export function GrupoMarcasCalendario({ grupo, eventos = [], onSeleccionar }) {
    const botonRef = useRef(null)
    const popupRef = useRef(null)
    const [abierto, cambiarAbierto] = useState(false)
    const [posicion, cambiarPosicion] = useState({ left: 12, top: 12 })

    useLayoutEffect(() => {
        if (!abierto || !botonRef.current) return

        function ubicar() {
            const caja = botonRef.current?.getBoundingClientRect()
            if (!caja) return
            const ancho = Math.min(360, window.innerWidth - 24)
            const altoEstimado = Math.min(420, window.innerHeight * 0.6)
            const left = Math.max(12, Math.min(caja.left, window.innerWidth - ancho - 12))
            const top = caja.bottom + altoEstimado + 12 <= window.innerHeight
                ? caja.bottom + 8
                : Math.max(12, caja.top - altoEstimado - 8)
            cambiarPosicion({ left, top })
        }

        ubicar()
        window.addEventListener("resize", ubicar)
        window.addEventListener("scroll", ubicar, true)
        function cerrarFuera(evento) {
            if (!popupRef.current?.contains(evento.target) && !botonRef.current?.contains(evento.target)) {
                cambiarAbierto(false)
            }
        }
        function cerrarEscape(evento) {
            if (evento.key === "Escape") {
                cambiarAbierto(false)
                botonRef.current?.focus()
            }
        }
        document.addEventListener("pointerdown", cerrarFuera)
        document.addEventListener("keydown", cerrarEscape)
        return () => {
            window.removeEventListener("resize", ubicar)
            window.removeEventListener("scroll", ubicar, true)
            document.removeEventListener("pointerdown", cerrarFuera)
            document.removeEventListener("keydown", cerrarEscape)
        }
    }, [abierto])

    useEffect(() => {
        if (!abierto) return
        popupRef.current?.querySelector("button")?.focus()
    }, [abierto])

    const popup = abierto && createPortal(
        <>
            <div className="grupo-marcas-fondo" aria-hidden="true" onPointerDown={() => cambiarAbierto(false)} />
            <section
                className="grupo-marcas-popup"
                ref={popupRef}
                role="dialog"
                aria-modal="false"
                aria-label={`${grupo.length} actividades cercanas`}
                style={posicion}
            >
                <header>
                    <strong>{grupo.length} actividades cercanas</strong>
                    <button type="button" aria-label="Cerrar lista" onClick={() => cambiarAbierto(false)}>×</button>
                </header>
                <ul>
                    {grupo.map(elemento => {
                        const datos = datosElemento(elemento, eventos)
                        const segundos = obtenerDuracionLegible(elemento.fragmento)
                        return (
                            <li key={`${elemento.tipo}-${elemento.fragmento.id}`}>
                                <button type="button" onClick={() => {
                                    onSeleccionar(elemento.tipo, elemento.fragmento)
                                    cambiarAbierto(false)
                                }}>
                                    <span className={`grupo-marcas-color grupo-marcas-color-${elemento.tipo}`} style={{ "--color-marca": datos.color }} aria-hidden="true" />
                                    <span className="grupo-marcas-datos">
                                        <strong>{datos.nombre}</strong>
                                        <small>{datos.tipoTexto} · {datos.estado}</small>
                                        <small>{formatearInstante(datos.inicio, formatoFechaHora)}–{datos.finTexto} · {duracion(segundos)}</small>
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </section>
        </>,
        document.body
    )

    return (
        <>
            <button
                ref={botonRef}
                className="grupo-marcas-boton"
                type="button"
                style={{ top: `${grupo[0].y}px`, left: `${grupo[0].x}px` }}
                aria-label={`Ver ${grupo.length} actividades cercanas`}
                aria-haspopup="dialog"
                aria-expanded={abierto}
                onClick={() => cambiarAbierto(estado => !estado)}
            >
                <span aria-hidden="true">{grupo.length}</span>
            </button>
            {popup}
        </>
    )
}

