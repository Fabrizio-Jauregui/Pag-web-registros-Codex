import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useReloj } from "../../app/useReloj.js"
import { BloquesCalendario } from "./BloquesCalendario.jsx"
import { MarcoAplicacionPlanificacion } from "./MarcoAplicacionPlanificacion.jsx"

const horasDelDia = Array.from({ length: 24 }, (_, hora) => hora)
const pasosMarcas = [1, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400]

function formatoMarca(instante, segundos) {
    return new Intl.DateTimeFormat("es-AR", segundos < 60
        ? { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }
        : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instante)
}

export function VistaCalendarioDia({
    escalaCalendario: escalaCalendarioBase,
    fechaISO,
    fechaVisible,
    fragmentos,
    fragmentosPlanes = [],
    registros = [],
    planes = [],
    recurrencias = [],
    ahora = new Date(),
    onLienzoZoomChange = () => {},
    marcadoresSecuenciales = [],
    eventos = [],
    onSeleccionar,
    onSeleccionarPlan = () => {},
    onAcercarAgrupacion = () => {},
    onSeleccionarFranja = () => {},
    franjaSeleccionada = null,
    onAjustarPlan,
    onAjustarRegistro,
    edicionDirectaHabilitada,
    idAplicacionArmada = null,
    planActivoSeguimientoId = null,
    ejeTiempoRelativo = false,
    zoom = null,
    onRangoVisibleChange = () => {}
}) {
    const reloj = useReloj()
    const gestoFranjaRef = useRef(null)
    const calendarioRef = useRef(null)
    const inicioPendienteRef = useRef(null)
    const onLienzoZoomChangeRef = useRef(onLienzoZoomChange)
    const onRangoVisibleChangeRef = useRef(onRangoVisibleChange)
    const duracionVistaSegundos = zoom?.duracionSegundos ?? 86400
    const [altoViewport, cambiarAltoViewport] = useState(360)
    const [inicioLienzo, cambiarInicioLienzo] = useState(null)
    const [franjaVista, cambiarFranjaVista] = useState(null)
    const [seleccionEnCurso, cambiarSeleccionEnCurso] = useState(false)
    const franjaVisible = franjaSeleccionada ?? (seleccionEnCurso ? franjaVista : null)

    useLayoutEffect(() => {
        onRangoVisibleChangeRef.current = onRangoVisibleChange
        onLienzoZoomChangeRef.current = onLienzoZoomChange
    })

    useLayoutEffect(() => {
        const calendario = calendarioRef.current
        if (!calendario) return
        function medir() { cambiarAltoViewport(calendario.clientHeight || 360) }
        medir()
        const observador = new ResizeObserver(medir)
        observador.observe(calendario)
        return () => observador.disconnect()
    }, [])

    useLayoutEffect(() => {
        if (!zoom) {
            if (calendarioRef.current) calendarioRef.current.scrollTop = 0
            return
        }
        // El estado de inicio conserva el recentering al cambiar el zoom.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        cambiarInicioLienzo(new Date(zoom.inicio.getTime() - zoom.duracionSegundos * 1000))
        if (calendarioRef.current) calendarioRef.current.scrollTop = altoViewport
    }, [zoom, altoViewport])

    useLayoutEffect(() => {
        if (!zoom?.id || !inicioLienzo) return
        onLienzoZoomChangeRef.current({
            inicio: inicioLienzo,
            fin: new Date(inicioLienzo.getTime() + duracionVistaSegundos * 3000)
        })
    }, [zoom?.id, inicioLienzo, duracionVistaSegundos])

    useLayoutEffect(() => {
        if (inicioPendienteRef.current === null || !calendarioRef.current) return
        calendarioRef.current.scrollTop = inicioPendienteRef.current
        inicioPendienteRef.current = null
    }, [inicioLienzo])

    const inicioDia = useMemo(() => new Date(`${fechaISO}T00:00:00`), [fechaISO])
    const pixelesPorSegundo = altoViewport / duracionVistaSegundos
    const duracionLienzoSegundos = zoom ? duracionVistaSegundos * 3 : 86400
    const inicioTemporal = zoom
        ? inicioLienzo ?? new Date(zoom.inicio.getTime() - duracionVistaSegundos * 1000)
        : inicioDia
    const finTemporal = new Date(inicioTemporal.getTime() + duracionLienzoSegundos * 1000)
    const escalaTemporal = {
        inicio: inicioTemporal,
        duracionSegundos: duracionLienzoSegundos,
        pixelesPorSegundo
    }
    const estiloCalendario = {
        ...escalaCalendarioBase,
        "--altura-hora": `${pixelesPorSegundo * 3600}px`,
        "--altura-dia": `${altoViewport * (zoom ? 3 : 1)}px`,
        "--alto-viewport-calendario": `${altoViewport}px`
    }

    function informarRangoVisible() {
        const calendario = calendarioRef.current
        if (!zoom || !calendario || !inicioLienzo) return
        const inicio = new Date(inicioLienzo.getTime() + calendario.scrollTop / pixelesPorSegundo * 1000)
        const fin = new Date(inicio.getTime() + duracionVistaSegundos * 1000)
        onRangoVisibleChangeRef.current(inicio, fin)

        const alto = calendario.clientHeight
        if (calendario.scrollTop < alto * 0.5) {
            cambiarInicioLienzo(new Date(inicioLienzo.getTime() - duracionVistaSegundos * 1000))
            inicioPendienteRef.current = calendario.scrollTop + alto
        } else if (calendario.scrollTop > alto * 1.5) {
            cambiarInicioLienzo(new Date(inicioLienzo.getTime() + duracionVistaSegundos * 1000))
            inicioPendienteRef.current = calendario.scrollTop - alto
        }
    }

    function generarMarcas() {
        if (!zoom) return horasDelDia.map(hora => ({
            instante: new Date(inicioDia.getTime() + hora * 3600_000),
            y: hora * altoViewport / 24,
            alto: altoViewport / 24,
            etiqueta: `${String(hora).padStart(2, "0")}:00`
        }))
        const objetivo = duracionVistaSegundos / 4
        const paso = pasosMarcas.find(valor => valor >= objetivo) ?? pasosMarcas.at(-1)
        const pasoMs = paso * 1000
        const primera = Math.ceil(inicioTemporal.getTime() / pasoMs) * pasoMs
        const marcas = []
        for (let ms = primera; ms < finTemporal.getTime(); ms += pasoMs) {
            const instante = new Date(ms)
            marcas.push({
                instante,
                y: (ms - inicioTemporal.getTime()) / 1000 * pixelesPorSegundo,
                alto: paso * pixelesPorSegundo,
                etiqueta: formatoMarca(instante, paso)
            })
        }
        return marcas
    }

    const marcas = generarMarcas()
    const marcasDeFecha = []
    if (zoom) {
        const siguienteMedianoche = new Date(inicioTemporal)
        siguienteMedianoche.setHours(0, 0, 0, 0)
        if (siguienteMedianoche <= inicioTemporal) siguienteMedianoche.setDate(siguienteMedianoche.getDate() + 1)
        while (siguienteMedianoche < finTemporal) {
            marcasDeFecha.push(new Date(siguienteMedianoche))
            siguienteMedianoche.setDate(siguienteMedianoche.getDate() + 1)
        }
    }

    function instanteBajoPuntero(evento) {
        const capa = evento.currentTarget.querySelector(".capa-registros-dia")
        if (!capa) return inicioDia
        const relativo = (evento.clientY - capa.getBoundingClientRect().top) / pixelesPorSegundo
        const instante = new Date(Math.round((inicioTemporal.getTime() + relativo * 1000) / 1000) * 1000)
        return zoom ? instante : new Date(Math.max(inicioDia.getTime(), Math.min(inicioDia.getTime() + 86400_000, instante.getTime())))
    }

    function iniciarSeleccionFranja(evento) {
        if (evento.target.closest?.(".bloque-registro, .bloque-plan, .marcador-secuencia-cronometro, .grupo-marcas-boton")
            || (!evento.target.closest?.(".calendario-horas, .calendario-franja, .capa-registros-dia")
                && evento.target !== evento.currentTarget)
            || !evento.isPrimary
            || (evento.pointerType === "mouse" && evento.button !== 0)) return
        const inicio = instanteBajoPuntero(evento)
        gestoFranjaRef.current = { pointerId: evento.pointerId, inicio, fin: inicio }
        evento.currentTarget.setPointerCapture(evento.pointerId)
        cambiarSeleccionEnCurso(true)
        cambiarFranjaVista({ inicio, fin: inicio })
    }

    function moverSeleccionFranja(evento) {
        const gesto = gestoFranjaRef.current
        if (!gesto || gesto.pointerId !== evento.pointerId) return
        const fin = instanteBajoPuntero(evento)
        gesto.fin = fin
        cambiarFranjaVista({
            inicio: new Date(Math.min(gesto.inicio.getTime(), fin.getTime())),
            fin: new Date(Math.max(gesto.inicio.getTime(), fin.getTime()))
        })
    }

    function terminarSeleccionFranja(evento) {
        const gesto = gestoFranjaRef.current
        if (!gesto || gesto.pointerId !== evento.pointerId) return
        gestoFranjaRef.current = null
        cambiarSeleccionEnCurso(false)
        const fin = instanteBajoPuntero(evento)
        const inicio = new Date(Math.min(gesto.inicio.getTime(), fin.getTime()))
        let final = new Date(Math.max(gesto.inicio.getTime(), fin.getTime()))
        if (final <= inicio) final = new Date(inicio.getTime() + 60_000)
        onSeleccionarFranja(inicio, final)
    }

    return (
        <div ref={calendarioRef} className={`calendario-dia-scroll ${zoom ? "calendario-dia-zoom-activo" : ""}`} style={estiloCalendario}
            onPointerDown={iniciarSeleccionFranja} onPointerMove={moverSeleccionFranja}
            onScroll={informarRangoVisible}
            onPointerUp={terminarSeleccionFranja} onPointerCancel={() => {
                gestoFranjaRef.current = null
                cambiarSeleccionEnCurso(false)
                cambiarFranjaVista(null)
            }}>
            <ol className="calendario-horas" style={{ height: `${altoViewport * (zoom ? 3 : 1)}px` }} aria-label={ejeTiempoRelativo ? "Tiempo transcurrido desde el inicio de la plantilla" : `Horas del ${fechaVisible}`}>
                {marcas.map(({ instante, y, alto, etiqueta }) => (
                    <li className={`calendario-hora ${zoom ? "calendario-hora-zoom" : ""}`} key={instante.getTime()} style={zoom ? { top: `${y}px`, height: `${alto}px` } : undefined}>
                        {ejeTiempoRelativo
                            ? <span className="calendario-etiqueta-hora">{etiqueta}</span>
                            : <time className="calendario-etiqueta-hora" dateTime={instante.toISOString()}>{etiqueta}</time>}
                        <div className="calendario-franja" aria-hidden="true" />
                    </li>
                ))}
            </ol>
            <div className="capa-registros-dia" style={{ height: `${altoViewport * (zoom ? 3 : 1)}px` }} role="group" aria-label={"Registros del " + fechaVisible}>
                {reloj.getTime() >= inicioTemporal.getTime() && reloj.getTime() <= finTemporal.getTime() && <time
                    className="linea-hora-actual"
                    dateTime={reloj.toISOString()}
                    aria-label={`Hora actual: ${new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(reloj)}`}
                    style={{ top: `${(reloj.getTime() - inicioTemporal.getTime()) / 1000 * pixelesPorSegundo}px` }}
                ><span>Ahora · {new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(reloj)}</span></time>}
                {franjaVisible && <div className="seleccion-franja-zoom" aria-hidden="true" style={{
                    top: `${(franjaVisible.inicio.getTime() - inicioTemporal.getTime()) / 1000 * pixelesPorSegundo}px`,
                    height: `${(franjaVisible.fin.getTime() - franjaVisible.inicio.getTime()) / 1000 * pixelesPorSegundo}px`
                }} />}
                {marcasDeFecha.map(marca => <div key={marca.getTime()} className="calendario-separador-dia-zoom" aria-hidden="true" style={{ top: `${(marca.getTime() - inicioTemporal.getTime()) / 1000 * pixelesPorSegundo}px` }}><time>{new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(marca)}</time></div>)}
                <BloquesCalendario
                    fragmentosRegistros={fragmentos}
                    fragmentosPlanes={fragmentosPlanes}
                    registros={registros}
                    planes={planes}
                    recurrencias={recurrencias}
                    ahora={ahora}
                    eventos={eventos}
                    onSeleccionarRegistro={onSeleccionar}
                    onSeleccionarPlan={onSeleccionarPlan}
                    onAcercarAgrupacion={onAcercarAgrupacion}
                    onAjustarRegistro={onAjustarRegistro}
                    onAjustarPlan={onAjustarPlan}
                    edicionDirectaHabilitada={edicionDirectaHabilitada}
                    planActivoSeguimientoId={planActivoSeguimientoId}
                    escalaTemporal={escalaTemporal}
                />
                <MarcoAplicacionPlanificacion
                    fragmentos={fragmentosPlanes}
                    idAplicacion={idAplicacionArmada}
                    escalaTemporal={escalaTemporal}
                />
                {marcadoresSecuenciales.map(marcador => {
                    if (!zoom) return marcador
                    const inicio = Number(marcador.props["data-instante"])
                    if (!Number.isFinite(inicio)) return marcador
                    return { ...marcador, props: { ...marcador.props, style: { ...marcador.props.style, top: `${(inicio - inicioTemporal.getTime()) / 1000 * pixelesPorSegundo}px` } } }
                })}
            </div>
        </div>
    )
}
