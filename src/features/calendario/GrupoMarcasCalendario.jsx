import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { obtenerResumenRegistro, formatearInstante } from "../../domain/tiempo/historial.js"
import { formatearDuracion } from "../../domain/tiempo/CalculosDuracion.js"
import { obtenerTopMarcador } from "./presentacionMarcasCalendario.js"

const formatoFechaHora = { dateStyle: "short", timeStyle: "medium" }
const formatoFechaLarga = new Intl.DateTimeFormat("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
})

function fechaAccesible(fecha) {
    if (!fecha) return ""
    if (fecha instanceof Date) return formatoFechaLarga.format(fecha)
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return formatoFechaLarga.format(new Date(`${fecha}T12:00:00`))
    return fecha
}

function claveActividad(elemento) {
    const entidad = elemento.tipo === "registro" ? elemento.fragmento.registro : elemento.fragmento.plan
    return `${elemento.tipo}-${entidad?.id ?? elemento.fragmento.id}`
}

function consolidarActividades(elementos) {
    const actividades = new Map()
    for (const elemento of elementos) {
        const clave = claveActividad(elemento)
        if (!actividades.has(clave)) {
            actividades.set(clave, { ...elemento, fragmentos: [] })
        }
        actividades.get(clave).fragmentos.push(elemento.fragmento)
    }
    return [...actividades.values()].map(actividad => ({
        ...actividad,
        fragmentos: actividad.fragmentos.sort((a, b) => a.inicio - b.inicio)
    })).sort((a, b) => a.fragmentos[0].inicio - b.fragmentos[0].inicio)
}

function datosElemento(actividad, eventos) {
    const { tipo, fragmento } = actividad
    if (tipo === "registro") {
        const registro = fragmento.registro
        const segmentos = registro.segmentos ?? actividad.fragmentos.map(item => item.segmento)
        const inicio = segmentos[0]?.inicio ?? actividad.fragmentos[0].inicio
        const fin = segmentos.at(-1)?.fin ?? null
        const resumen = obtenerResumenRegistro(registro)
        return {
            nombre: registro.nombre,
            estado: registro.estado,
            color: registro.colorEvento ?? "#4F46E5",
            inicio,
            fin,
            finTexto: fin ? formatearInstante(fin, formatoFechaHora) : "ahora",
            duracion: formatearDuracion(resumen.efectivo),
            pausa: resumen.pausado > 0 ? ` · ${formatearDuracion(resumen.pausado)} en pausa` : "",
            tipoTexto: registro.origenFocus ? "Registro Focus" : "Registro"
        }
    }

    const plan = fragmento.plan
    const evento = eventos.find(item => item.id === plan.eventoId)
    const inicio = plan.inicio ?? actividad.fragmentos[0].inicio
    const fin = plan.fin ?? actividad.fragmentos.at(-1).fin
    return {
        nombre: evento?.nombre ?? plan.nombre,
        estado: "Planificado",
        color: evento?.color ?? plan.colorEvento ?? "#0F766E",
        inicio,
        fin,
        finTexto: formatearInstante(fin, formatoFechaHora),
        duracion: formatearDuracion(Math.max(0, (fin.getTime() - inicio.getTime()) / 1000)),
        pausa: "",
        tipoTexto: plan.tipoPlanificacion === "focus" ? "Sesión Focus planificada" : "Plan"
    }
}

export function GrupoMarcasCalendario({
    grupo,
    eventos = [],
    onSeleccionar,
    onAcercar = () => {},
    altoLienzo = 0,
    anchoLienzo = 0,
    fechaColumna = null
}) {
    const botonRef = useRef(null)
    const popupRef = useRef(null)
    const [abierto, cambiarAbierto] = useState(false)
    const [posicion, cambiarPosicion] = useState({ left: 12, top: 12 })
    const actividades = consolidarActividades(grupo.elementos)
    const cantidad = actividades.length
    const sustantivo = cantidad === 1 ? "actividad" : "actividades"
    const fraseCantidad = `${cantidad} ${sustantivo} ${cantidad === 1 ? "cercana" : "cercanas"}`
    const fechaTexto = fechaAccesible(fechaColumna)
    const etiquetaContexto = fechaTexto ? ` del ${fechaTexto}` : ""
    const altoObjetivo = 28
    const anchoIndicador = Math.max(32, String(cantidad).length * 9 + 22)
    const left = Math.max(0, anchoLienzo - anchoIndicador)
    const top = obtenerTopMarcador(grupo.yIndicador, altoLienzo, altoObjetivo)
    const centroIndicador = top + altoObjetivo / 2
    const centroAncla = grupo.yRepresentativo
    const xAncla = Math.max(0, Math.min(grupo.xRepresentativo, anchoLienzo))
    const xLinea = Math.min(xAncla, left)
    const anchoLinea = Math.abs(left - xAncla)
    const topConectorVertical = Math.min(centroIndicador, centroAncla)
    const altoConectorVertical = Math.abs(centroIndicador - centroAncla)
    const inicioTramo = new Date(Math.min(...grupo.elementos.map(elemento => elemento.fragmento.inicio.getTime())))
    const finTramo = new Date(Math.max(...grupo.elementos.map(elemento => elemento.fragmento.fin.getTime())))

    useLayoutEffect(() => {
        if (!abierto || !botonRef.current) return

        function ubicar() {
            const caja = botonRef.current?.getBoundingClientRect()
            if (!caja) return
            const ancho = Math.min(360, window.innerWidth - 24)
            const altoEstimado = Math.min(460, window.innerHeight * 0.68)
            const leftPopup = Math.max(12, Math.min(caja.left - ancho + caja.width, window.innerWidth - ancho - 12))
            const topPopup = caja.bottom + altoEstimado + 12 <= window.innerHeight
                ? caja.bottom + 8
                : Math.max(12, caja.top - altoEstimado - 8)
            cambiarPosicion({ left: leftPopup, top: topPopup })
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
                aria-label={fraseCantidad}
                style={posicion}
            >
                <header>
                    <strong>{fraseCantidad}</strong>
                    <button type="button" aria-label="Cerrar lista" onClick={() => cambiarAbierto(false)}>×</button>
                </header>
                <ul>
                    {actividades.map(actividad => {
                        const datos = datosElemento(actividad, eventos)
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
                                        <small>{formatearInstante(datos.inicio, formatoFechaHora)}–{datos.finTexto} · {datos.duracion}{datos.pausa}</small>
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
                <footer>
                    <button type="button" onClick={() => {
                        cambiarAbierto(false)
                        onAcercar(inicioTramo, finTramo)
                    }}>Acercar al tramo</button>
                </footer>
            </section>
        </>,
        document.body
    )

    return (
        <>
            {anchoLinea > 0 && <span
                className="indicador-borde-conector-horizontal"
                aria-hidden="true"
                style={{ left: `${xLinea}px`, width: `${anchoLinea}px`, top: `${centroAncla}px` }}
            />}
            {altoConectorVertical > 0.5 && <span
                className="indicador-borde-conector-vertical"
                aria-hidden="true"
                style={{ left: `${left}px`, top: `${topConectorVertical}px`, height: `${altoConectorVertical}px` }}
            />}
            <button
                ref={botonRef}
                className="grupo-marcas-boton indicador-borde-boton"
                type="button"
                style={{ top: `${top}px`, left: `${left}px`, width: `${anchoIndicador}px` }}
                aria-label={`Ver ${fraseCantidad}${etiquetaContexto}`}
                aria-haspopup="dialog"
                aria-expanded={abierto}
                onClick={() => cambiarAbierto(estado => !estado)}
            >{cantidad}</button>
            {popup}
        </>
    )
}
