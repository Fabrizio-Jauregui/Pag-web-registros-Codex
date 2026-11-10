import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { formatearDuracion } from "../../domain/tiempo/CalculosDuracion.js"
import { formatearInstante, obtenerResumenRegistro } from "../../domain/tiempo/historial.js"
import { obtenerDuracionLegible, obtenerTopMarcador } from "./presentacionMarcasCalendario.js"

const formatoFechaHora = { dateStyle: "short", timeStyle: "medium" }

function duracionPlan(segundos) {
    const horas = Math.floor(segundos / 3600)
    const minutos = Math.floor(segundos % 3600 / 60)
    const resto = Math.floor(segundos % 60)
    return [horas, minutos, resto].map(valor => String(valor).padStart(2, "0")).join(":")
}

function claveActividad(elemento) {
    return elemento.tipo === "registro"
        ? `registro-${elemento.fragmento.registro.id}`
        : `plan-${elemento.fragmento.plan.id}`
}

function agruparFragmentosPorActividad(grupo) {
    const actividades = new Map()
    for (const elemento of grupo) {
        const clave = claveActividad(elemento)
        if (!actividades.has(clave)) actividades.set(clave, { ...elemento, fragmentos: [] })
        actividades.get(clave).fragmentos.push(elemento.fragmento)
    }
    return [...actividades.values()].map(actividad => ({
        ...actividad,
        fragmentos: actividad.fragmentos.sort((a, b) => a.inicio - b.inicio),
        fragmento: actividad.fragmentos[0]
    }))
}

function datosActividad(actividad, eventos) {
    const { tipo, fragmento } = actividad
    if (tipo === "registro") {
        const registro = fragmento.registro
        const primero = registro.segmentos[0]
        const ultimo = registro.segmentos.at(-1)
        const finAbierto = ultimo.fin === null
        const estado = registro.estado === "Pausado" ? "En pausa" : registro.estado
        const resumen = obtenerResumenRegistro(registro)
        return {
            nombre: registro.nombre,
            estado,
            color: registro.colorEvento ?? "#4F46E5",
            inicio: primero.inicio,
            finTexto: finAbierto
                ? estado === "En pausa" ? "en pausa" : "ahora"
                : formatearInstante(ultimo.fin, formatoFechaHora),
            duracionTexto: `Tiempo efectivo ${formatearDuracion(resumen.efectivo)}${resumen.pausado > 0 ? ` · pausas ${formatearDuracion(resumen.pausado)}` : ""}`,
            tipoTexto: registro.origenFocus ? "Registro de sesión Focus" : "Registro"
        }
    }

    const plan = fragmento.plan
    const evento = eventos.find(item => item.id === plan.eventoId)
    return {
        nombre: evento?.nombre ?? plan.nombre,
        estado: "Planificado",
        color: evento?.color ?? plan.colorEvento ?? "#0F766E",
        inicio: plan.inicio,
        finTexto: formatearInstante(plan.fin, formatoFechaHora),
        duracionTexto: `Duración ${duracionPlan(obtenerDuracionLegible({ inicio: plan.inicio, fin: plan.fin }))}`,
        tipoTexto: plan.tipoPlanificacion === "focus" ? "Sesión Focus planificada" : "Plan"
    }
}

export function GrupoMarcasCalendario({
    grupo,
    eventos = [],
    onSeleccionar,
    onAcercar = () => {},
    altoLienzo = 0,
    anchoLienzo = 0
}) {
    const botonRef = useRef(null)
    const popupRef = useRef(null)
    const [abierto, cambiarAbierto] = useState(false)
    const [posicion, cambiarPosicion] = useState({ left: 12, top: 12 })
    const actividades = useMemo(() => agruparFragmentosPorActividad(grupo), [grupo])

    useLayoutEffect(() => {
        if (!abierto || !botonRef.current) return

        function ubicar() {
            const caja = botonRef.current?.getBoundingClientRect()
            if (!caja) return
            const ancho = Math.min(360, window.innerWidth - 24)
            const altoEstimado = Math.min(460, window.innerHeight * 0.68)
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
        if (abierto) popupRef.current?.querySelector("button")?.focus()
    }, [abierto])

    const popup = abierto && createPortal(
        <>
            <div className="grupo-marcas-fondo" aria-hidden="true" onPointerDown={() => cambiarAbierto(false)} />
            <section
                className="grupo-marcas-popup"
                ref={popupRef}
                role="dialog"
                aria-modal="false"
                aria-label={`${actividades.length} actividades agrupadas`}
                style={posicion}
            >
                <header>
                    <strong>{actividades.length} {actividades.length === 1 ? "actividad agrupada" : "actividades agrupadas"}</strong>
                    <button type="button" aria-label="Cerrar lista" onClick={() => cambiarAbierto(false)}>×</button>
                </header>
                <ul>
                    {actividades.map(actividad => {
                        const datos = datosActividad(actividad, eventos)
                        return (
                            <li key={claveActividad(actividad)}>
                                <button type="button" onClick={() => {
                                    onSeleccionar(actividad.tipo, actividad.fragmento)
                                    cambiarAbierto(false)
                                }}>
                                    <span className={`grupo-marcas-color grupo-marcas-color-${actividad.tipo}`} style={{ "--color-marca": datos.color }} aria-hidden="true" />
                                    <span className="grupo-marcas-datos">
                                        <strong>{datos.nombre}</strong>
                                        <small>{datos.tipoTexto} · {datos.estado}</small>
                                        <small>{formatearInstante(datos.inicio, formatoFechaHora)}–{datos.finTexto} · {datos.duracionTexto}</small>
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
                <button
                    type="button"
                    className="grupo-marcas-acercar"
                    onClick={() => {
                        const inicio = new Date(Math.min(...grupo.map(elemento => elemento.fragmento.inicio.getTime())))
                        const fin = new Date(Math.max(...grupo.map(elemento => elemento.fragmento.fin.getTime())))
                        onAcercar(inicio, fin)
                        cambiarAbierto(false)
                    }}
                >Acercar a la agrupación</button>
            </section>
        </>,
        document.body
    )

    const inicioY = Math.min(...grupo.map(elemento => elemento.y))
    const finY = Math.max(...grupo.map(elemento => elemento.y + elemento.alto))
    const altoFranja = Math.max(2, finY - inicioY)
    const inicioX = Math.min(...grupo.map(elemento => elemento.izquierda))
    const finX = Math.max(...grupo.map(elemento => elemento.derecha))
    const anchoFranja = Math.max(2, finX - inicioX)
    const anchoObjetivo = Math.max(28, anchoFranja)
    const altoObjetivo = Math.max(28, altoFranja)
    const centroX = (inicioX + finX) / 2
    const centroY = (inicioY + finY) / 2
    const left = Math.max(0, Math.min(centroX - anchoObjetivo / 2, anchoLienzo - anchoObjetivo))
    const top = obtenerTopMarcador(centroY, altoLienzo, altoObjetivo)
    const actividadesNarrativas = actividades.length === 1 ? "actividad" : "actividades"

    return (
        <>
            <button
                ref={botonRef}
                className="grupo-marcas-boton"
                type="button"
                style={{ left: `${left}px`, top: `${top}px`, width: `${anchoObjetivo}px`, height: `${altoObjetivo}px` }}
                aria-label={`Abrir agrupación de ${actividades.length} ${actividadesNarrativas}`}
                aria-haspopup="dialog"
                aria-expanded={abierto}
                onClick={() => cambiarAbierto(estado => !estado)}
            >
                <span
                    className="grupo-marcas-franja"
                    aria-hidden="true"
                    style={{
                        left: `${inicioX - left}px`,
                        top: `${inicioY - top}px`,
                        width: `${anchoFranja}px`,
                        height: `${altoFranja}px`
                    }}
                />
            </button>
            {popup}
        </>
    )
}
