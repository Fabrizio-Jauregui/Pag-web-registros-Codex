import { useLayoutEffect, useRef, useState } from "react"
import { useReloj } from "../../app/useReloj.js"
import { formatearFechaISO } from "../../domain/tiempo/FechaCalendario.js"
import { BloquesCalendario } from "./BloquesCalendario.jsx"
import { MarcoAplicacionPlanificacion } from "./MarcoAplicacionPlanificacion.jsx"
import { TiempoTotal } from "./TiempoTotal.jsx"

const formatoDiaSemana = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric" })
const formatoFechaLarga = new Intl.DateTimeFormat("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
})
const formatoHora = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const pasosMarcas = [1, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400]

export function VistaCalendarioSemana({
    escalaCalendario,
    fechaVisible,
    diasSemana,
    fragmentosSemana,
    eventos,
    registros,
    onSeleccionar,
    onSeleccionarPlan,
    onAjustarPlan,
    onAjustarRegistro,
    edicionDirectaHabilitada,
    idAplicacionArmada = null,
    planActivoSeguimientoId = null,
    formatoMovil = "agenda",
    cambiarFormatoMovil = () => {},
    esViewportMovil = false,
    zoom = null,
    onRangoVisibleChange = () => {}
}) {
    const reloj = useReloj()
    const calendarioRef = useRef(null)
    const selectorRef = useRef(null)
    const ayudaRef = useRef(null)
    const scrollPendienteRef = useRef(null)
    const onRangoVisibleChangeRef = useRef(onRangoVisibleChange)
    const [altoViewport, cambiarAltoViewport] = useState(360)
    const [altoSelector, cambiarAltoSelector] = useState(0)
    const [inicioLienzo, cambiarInicioLienzo] = useState(null)
    const duracionVistaSegundos = zoom?.duracionSegundos ?? 86400
    const anclaDia = zoom ? new Date(zoom.inicio.getFullYear(), zoom.inicio.getMonth(), zoom.inicio.getDate()) : diasSemana[0]
    const segundosAncla = zoom
        ? (zoom.inicio.getTime() - new Date(zoom.inicio.getFullYear(), zoom.inicio.getMonth(), zoom.inicio.getDate()).getTime()) / 1000
        : 0
    const inicioSegundosLienzo = zoom ? inicioLienzo ?? segundosAncla - duracionVistaSegundos : 0
    const duracionLienzoSegundos = zoom ? duracionVistaSegundos * 3 : 86400
    const pixelesPorSegundo = altoViewport / duracionVistaSegundos

    useLayoutEffect(() => { onRangoVisibleChangeRef.current = onRangoVisibleChange })

    useLayoutEffect(() => {
        const raiz = calendarioRef.current
        if (!raiz) return
        function medir() {
            function medirAlturaEnFlujo(elemento) {
                if (!elemento || getComputedStyle(elemento).display === "none") return 0
                const estilos = getComputedStyle(elemento)
                return elemento.getBoundingClientRect().height
                    + (Number.parseFloat(estilos.marginTop) || 0)
                    + (Number.parseFloat(estilos.marginBottom) || 0)
            }
            const alturaSelector = selectorRef.current && getComputedStyle(selectorRef.current).display !== "none"
                ? selectorRef.current.clientHeight
                : 0
            const alturaSelectorEnFlujo = medirAlturaEnFlujo(selectorRef.current)
            const alturaAyuda = medirAlturaEnFlujo(ayudaRef.current)
            cambiarAltoSelector(alturaSelector)
            cambiarAltoViewport(Math.max(120, raiz.clientHeight - alturaSelectorEnFlujo - alturaAyuda - 84))
        }
        const observador = new ResizeObserver(medir)
        observador.observe(raiz)
        if (selectorRef.current) observador.observe(selectorRef.current)
        if (ayudaRef.current) observador.observe(ayudaRef.current)
        const raf = requestAnimationFrame(medir)
        return () => {
            cancelAnimationFrame(raf)
            observador.disconnect()
        }
    }, [])

    useLayoutEffect(() => {
        if (!zoom) {
            if (calendarioRef.current) calendarioRef.current.scrollTop = 0
            return
        }
        // Recentrar el lienzo cuando cambia la ventana o su escala.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        cambiarInicioLienzo(segundosAncla - duracionVistaSegundos)
        if (calendarioRef.current) calendarioRef.current.scrollTop = altoViewport
    }, [zoom, altoViewport, altoSelector, segundosAncla, duracionVistaSegundos])

    useLayoutEffect(() => {
        if (scrollPendienteRef.current === null || !calendarioRef.current) return
        calendarioRef.current.scrollTop = scrollPendienteRef.current
        scrollPendienteRef.current = null
    }, [inicioLienzo])

    function generarMarcasSemana() {
        if (!zoom) return Array.from({ length: 24 }, (_, hora) => ({
            segundo: hora * 3600,
            y: hora * altoViewport / 24,
            alto: altoViewport / 24,
            etiqueta: `${String(hora).padStart(2, "0")}:00`
        }))
        const paso = pasosMarcas.find(valor => valor >= duracionVistaSegundos / 4) ?? pasosMarcas.at(-1)
        const primera = Math.ceil(inicioSegundosLienzo / paso) * paso
        const marcas = []
        for (let segundo = primera; segundo < inicioSegundosLienzo + duracionLienzoSegundos; segundo += paso) {
            const instante = new Date(anclaDia.getTime() + segundo * 1000)
            marcas.push({
                segundo,
                y: (segundo - inicioSegundosLienzo) * pixelesPorSegundo,
                alto: paso * pixelesPorSegundo,
                etiqueta: paso < 60 ? new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(instante) : formatoHora.format(instante)
            })
        }
        return marcas
    }

    const marcasSemana = generarMarcasSemana()
    const estiloCalendario = {
        ...escalaCalendario,
        "--altura-hora": `${altoViewport / 24}px`,
        "--altura-dia": `${altoViewport * (zoom ? 3 : 1)}px`,
        "--alto-selector-semana": `${altoSelector}px`
    }

    function escalaColumna(columna) {
        const fecha = diasSemana.find(dia => formatearFechaISO(dia) === columna.fecha)
        const inicioDia = new Date(fecha)
        inicioDia.setHours(0, 0, 0, 0)
        return {
            inicio: new Date(inicioDia.getTime() + (zoom ? inicioSegundosLienzo * 1000 : 0)),
            duracionSegundos: duracionLienzoSegundos,
            pixelesPorSegundo
        }
    }

    function cambiarRangoPorScroll() {
        const raiz = calendarioRef.current
        if (!zoom || !raiz || inicioLienzo === null) return
        const scrollTemporal = raiz.scrollTop
        const inicio = new Date(anclaDia.getTime() + (inicioLienzo + scrollTemporal / pixelesPorSegundo) * 1000)
        const fin = new Date(inicio.getTime() + duracionVistaSegundos * 1000)
        onRangoVisibleChangeRef.current(inicio, fin)
        if (scrollTemporal < altoViewport * 0.5) {
            cambiarInicioLienzo(inicioLienzo - duracionVistaSegundos)
            scrollPendienteRef.current = raiz.scrollTop + altoViewport
        } else if (scrollTemporal > altoViewport * 1.5) {
            cambiarInicioLienzo(inicioLienzo + duracionVistaSegundos)
            scrollPendienteRef.current = raiz.scrollTop - altoViewport
        }
    }

    const marcarMedianoches = []
    if (zoom) {
        let segundo = Math.ceil(inicioSegundosLienzo / 86400) * 86400
        if (segundo <= inicioSegundosLienzo) segundo += 86400
        while (segundo < inicioSegundosLienzo + duracionLienzoSegundos) {
            marcarMedianoches.push(segundo)
            segundo += 86400
        }
    }
    const actividadesPorDia = fragmentosSemana.map(columna => {
        const actividades = [
            ...columna.fragmentos.map(fragmento => ({ tipo: "registro", fragmento, instante: fragmento.inicio })),
            ...columna.planes.map(fragmento => ({ tipo: "plan", fragmento, instante: fragmento.inicio }))
        ].sort((a, b) => a.instante - b.instante)
        return { ...columna, actividades }
    })

    return (
        <div ref={calendarioRef} onScroll={cambiarRangoPorScroll} className={`calendario-semana-scroll calendario-semana-formato-${formatoMovil} ${zoom ? "calendario-semana-zoom-activo" : ""}`} style={{ ...estiloCalendario, height: esViewportMovil && formatoMovil === "agenda" ? "auto" : "min(max(76vh, 360px), 1000px)" }}>
            <div ref={selectorRef} className="selector-formato-semana" role="group" aria-label="Formato semanal">
                <button type="button" aria-pressed={formatoMovil === "agenda"} onClick={() => cambiarFormatoMovil("agenda")}>Agenda</button>
                <button type="button" aria-pressed={formatoMovil === "grilla"} onClick={() => cambiarFormatoMovil("grilla")}>Grilla por horas</button>
            </div>
            <p ref={ayudaRef} className="ayuda-desplazamiento-semana">Deslizá horizontalmente para ver todos los días de la semana.</p>
            <div className="agenda-semana-movil" aria-label={`Agenda de la semana: ${fechaVisible}`}>
                {actividadesPorDia.map((dia, indice) => (
                    <section className="agenda-semana-dia" data-fecha={dia.fecha} aria-labelledby={`agenda-semana-dia-${dia.fecha}`} key={dia.fecha}>
                        <h3 id={`agenda-semana-dia-${dia.fecha}`}>
                            <time dateTime={dia.fecha}>{formatoFechaLarga.format(diasSemana[indice])}</time>
                        </h3>
                        {dia.actividades.length === 0
                            ? <p className="agenda-semana-vacia">Sin registros ni planificaciones.</p>
                            : <ul>{dia.actividades.map(({ tipo, fragmento }) => {
                                if (tipo === "registro") {
                                    const { registro, segmento, abierto, inicio, fin } = fragmento
                                    const estado = segmento.tipo === "Pausado" ? "En pausa" : "En curso"
                                    return <li key={`registro-${fragmento.id}`}>
                                        <button type="button" className="agenda-semana-actividad agenda-semana-registro"
                                            style={{ "--color-agenda": registro.colorEvento ?? "#4f46e5" }}
                                            aria-label={`${registro.nombre}, ${estado}, ${formatoHora.format(inicio)} a ${abierto ? "ahora" : formatoHora.format(fin)}`}
                                            onClick={() => onSeleccionar(registro, fragmento)}>
                                            <strong>{registro.nombre}</strong>
                                            <span>{formatoHora.format(inicio)}–{abierto ? "ahora" : formatoHora.format(fin)} · {estado}</span>
                                        </button>
                                    </li>
                                }
                                const { plan, inicio, fin } = fragmento
                                return <li key={`plan-${fragmento.id}`}>
                                    <button type="button" className="agenda-semana-actividad agenda-semana-plan"
                                        aria-label={`Planificado: ${plan.nombre}, ${formatoHora.format(inicio)} a ${formatoHora.format(fin)}`}
                                        onClick={() => onSeleccionarPlan(plan, fragmento)}>
                                        <strong>{plan.nombre}</strong>
                                        <span>{formatoHora.format(inicio)}–{formatoHora.format(fin)} · Planificado</span>
                                    </button>
                                </li>
                            })}</ul>}
                    </section>
                ))}
            </div>
            <div className={`calendario-semana ${formatoMovil === "grilla" ? "calendario-semana-movil-visible" : ""}`} role="group" aria-label={"Calendario semanal: " + fechaVisible}>
                <div
                    className="calendario-grilla-semanal"
                    role="table"
                    aria-label={"Semana del " + fechaVisible + "; grilla de horas"}
                    style={zoom ? { position: "relative", height: `${84 + altoViewport * 3}px` } : undefined}
                >
                <div className="calendario-fila-semanal calendario-cabecera-semanal" role="row">
                    <div className="calendario-celda-hora" role="columnheader">Hora</div>
                    {diasSemana.map(dia => {
                        const fecha = formatearFechaISO(dia)
                        return (
                            <div className="calendario-celda-dia" role="columnheader" key={fecha}>
                                <time dateTime={fecha}>{formatoDiaSemana.format(dia)}</time>
                                <TiempoTotal
                                    as="small"
                                    className="tiempo-total-semana"
                                    registros={registros}
                                    fecha={dia}
                                    etiquetaAccesible="Tiempo total registrado"
                                />
                            </div>
                        )
                    })}
                </div>

                {marcasSemana.map((marca, indiceMarca) => {
                    const hora = marca.etiqueta
                    return (
                        <div className={`calendario-fila-semanal ${zoom ? "calendario-fila-semanal-zoom" : ""}`} role="row" aria-label={hora} key={`${marca.segundo}-${indiceMarca}`} style={zoom ? { position: "absolute", top: `${84 + marca.y}px`, left: 0, right: 0, height: `${marca.alto}px`, minHeight: `${marca.alto}px` } : undefined}>
                            <div className="calendario-celda-hora" role="rowheader">
                                <time>{hora}</time>
                            </div>
                            {diasSemana.map(dia => {
                                const fecha = formatearFechaISO(dia)
                                return <div className="calendario-celda-semanal" role="cell" aria-label={`${formatoFechaLarga.format(dia)}, ${hora}`} data-fecha={fecha} key={`${fecha}-${indiceMarca}`} />
                            })}
                        </div>
                    )
                })}

                </div>
                <div className="capa-registros-semana" role="group" aria-label="Actividades de la semana" style={{ height: `${altoViewport * (zoom ? 3 : 1)}px` }}>
                    {marcarMedianoches.map(segundo => {
                        const fechaMarca = new Date(anclaDia.getTime() + segundo * 1000)
                        return <div key={segundo} className="calendario-separador-dia-semana" aria-hidden="true" style={{ top: `${(segundo - inicioSegundosLienzo) * pixelesPorSegundo}px` }}><time>{formatoFechaLarga.format(fechaMarca)}</time></div>
                    })}
                    {fragmentosSemana.map(columna => (
                        (() => {
                        const escalaTemporal = escalaColumna(columna)
                        const dentroLienzo = fragmento => !escalaTemporal
                            || (fragmento.fin.getTime() > escalaTemporal.inicio.getTime()
                                && fragmento.inicio.getTime() < escalaTemporal.inicio.getTime() + escalaTemporal.duracionSegundos * 1000)
                        const fragmentosColumna = (zoom ? (columna.fragmentosExtendidos ?? columna.fragmentos) : columna.fragmentos).filter(dentroLienzo)
                        const planesColumna = (zoom ? (columna.planesExtendidos ?? columna.planes) : columna.planes).filter(dentroLienzo)
                        return (
                        <div
                            className="columna-registros-semana"
                            role="group"
                            aria-label={"Actividades del " + formatoFechaLarga.format(
                                diasSemana.find(dia => formatearFechaISO(dia) === columna.fecha)
                            )}
                            data-fecha={columna.fecha}
                            key={columna.fecha}
                        >
                            {columna.fecha === `${reloj.getFullYear()}-${String(reloj.getMonth() + 1).padStart(2, "0")}-${String(reloj.getDate()).padStart(2, "0")}` && reloj.getTime() >= (escalaTemporal?.inicio.getTime() ?? 0) && reloj.getTime() <= (escalaTemporal?.inicio.getTime() ?? Infinity) + duracionLienzoSegundos * 1000 && <time
                                className="linea-hora-actual"
                                dateTime={reloj.toISOString()}
                                aria-label={`Hora actual: ${formatoHora.format(reloj)}`}
                                style={{ top: zoom ? `${(reloj.getTime() - escalaTemporal.inicio.getTime()) / 1000 * pixelesPorSegundo}px` : `${((reloj.getHours() * 3600 + reloj.getMinutes() * 60 + reloj.getSeconds()) / 86400) * 100}%` }}
                            ><span>Ahora · {formatoHora.format(reloj)}</span></time>}
                            <BloquesCalendario
                                fragmentosRegistros={fragmentosColumna}
                                fragmentosPlanes={planesColumna}
                                eventos={eventos}
                                onSeleccionarRegistro={onSeleccionar}
                                onSeleccionarPlan={onSeleccionarPlan}
                                onAjustarRegistro={onAjustarRegistro}
                                onAjustarPlan={onAjustarPlan}
                                edicionDirectaHabilitada={edicionDirectaHabilitada}
                                permiteCambiarDia
                                planActivoSeguimientoId={planActivoSeguimientoId}
                                escalaTemporal={escalaTemporal}
                            />
                            <MarcoAplicacionPlanificacion
                                fragmentos={planesColumna}
                                idAplicacion={idAplicacionArmada}
                                escalaTemporal={escalaTemporal}
                            />
                        </div>
                        )
                        })()
                    ))}
                </div>
            </div>
        </div>
    )
}
