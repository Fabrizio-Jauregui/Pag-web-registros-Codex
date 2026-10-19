import { useRef, useState } from "react"
import { BloqueRegistro } from "./BloqueRegistro.jsx"
import { BloquePlan } from "./BloquePlan.jsx"
import { MarcoAplicacionPlanificacion } from "./MarcoAplicacionPlanificacion.jsx"

const horasDelDia = Array.from({ length: 24 }, (_, hora) => hora)

export function VistaCalendarioDia({
    escalaCalendario,
    fechaISO,
    fechaVisible,
    fragmentos,
    fragmentosPlanes = [],
    eventos = [],
    onSeleccionar,
    onSeleccionarPlan = () => {},
    onSeleccionarFranja = () => {},
    franjaSeleccionada = null,
    onAjustarPlan,
    onAjustarRegistro,
    edicionDirectaHabilitada,
    idAplicacionArmada = null,
    ejeTiempoRelativo = false
}) {
    const gestoFranjaRef = useRef(null)
    const [franjaVista, cambiarFranjaVista] = useState(null)
    const [seleccionEnCurso, cambiarSeleccionEnCurso] = useState(false)
    const inicioDiaMs = new Date(`${fechaISO}T00:00:00`).getTime()
    const franjaConfirmada = franjaSeleccionada ? {
        inicio: (franjaSeleccionada.inicio.getTime() - inicioDiaMs) / 1000,
        fin: (franjaSeleccionada.fin.getTime() - inicioDiaMs) / 1000
    } : null
    const franjaVisible = franjaConfirmada ?? (seleccionEnCurso ? franjaVista : null)

    function segundosBajoPuntero(evento) {
        const capa = evento.currentTarget.querySelector(".capa-registros-dia")
        if (!capa) return 0
        const alturaHora = Number.parseFloat(getComputedStyle(capa).getPropertyValue("--altura-hora"))
        const segundos = (evento.clientY - capa.getBoundingClientRect().top) / ((alturaHora || 64) / 3600)
        return Math.max(0, Math.min(86400, segundos))
    }

    function iniciarSeleccionFranja(evento) {
        if (evento.target.closest?.(".bloque-registro, .bloque-plan")
            || (!evento.target.closest?.(".calendario-horas, .calendario-franja, .capa-registros-dia")
                && evento.target !== evento.currentTarget)
            || !evento.isPrimary
            || (evento.pointerType === "mouse" && evento.button !== 0)) return
        const inicio = segundosBajoPuntero(evento)
        gestoFranjaRef.current = { pointerId: evento.pointerId, inicio, fin: inicio, rect: evento.currentTarget.getBoundingClientRect() }
        evento.currentTarget.setPointerCapture(evento.pointerId)
        cambiarSeleccionEnCurso(true)
        cambiarFranjaVista({ inicio, fin: inicio })
    }

    function moverSeleccionFranja(evento) {
        const gesto = gestoFranjaRef.current
        if (!gesto || gesto.pointerId !== evento.pointerId) return
        const fin = segundosBajoPuntero(evento)
        gesto.fin = fin
        cambiarFranjaVista({ inicio: Math.min(gesto.inicio, fin), fin: Math.max(gesto.inicio, fin) })
    }

    function terminarSeleccionFranja(evento) {
        const gesto = gestoFranjaRef.current
        if (!gesto || gesto.pointerId !== evento.pointerId) return
        gestoFranjaRef.current = null
        cambiarSeleccionEnCurso(false)
        const fin = segundosBajoPuntero(evento)
        const inicioSeg = Math.round(Math.min(gesto.inicio, fin))
        let finSeg = Math.round(Math.max(gesto.inicio, fin))
        if (finSeg <= inicioSeg) finSeg = Math.min(86400, inicioSeg + 60)
        const dia = new Date(`${fechaISO}T00:00:00`)
        onSeleccionarFranja(new Date(dia.getTime() + inicioSeg * 1000), new Date(dia.getTime() + finSeg * 1000))
    }

    return (
        <div className="calendario-dia-scroll" style={escalaCalendario}
            onPointerDown={iniciarSeleccionFranja} onPointerMove={moverSeleccionFranja}
            onPointerUp={terminarSeleccionFranja} onPointerCancel={() => {
                gestoFranjaRef.current = null
                cambiarSeleccionEnCurso(false)
                cambiarFranjaVista(null)
            }}>
            <ol className="calendario-horas" aria-label={ejeTiempoRelativo ? "Tiempo transcurrido desde el inicio de la plantilla" : `Horas del ${fechaVisible}`}>
                {horasDelDia.map(horaDelDia => {
                    const horaFormateada = String(horaDelDia).padStart(2, "0")
                    return (
                        <li className="calendario-hora" key={horaDelDia}>
                        {ejeTiempoRelativo
                            ? <span className="calendario-etiqueta-hora" aria-label={horaDelDia === 0 ? "Inicio de la plantilla" : `${horaDelDia} horas desde el inicio`}>{horaDelDia === 0 ? "Inicio" : `+${horaFormateada}:00`}</span>
                            : <time className="calendario-etiqueta-hora" dateTime={`${fechaISO}T${horaFormateada}:00`}>{horaFormateada}:00</time>}
                            <div className="calendario-franja" aria-hidden="true" />
                        </li>
                    )
                })}
            </ol>
            <div className="capa-registros-dia" role="group" aria-label={"Registros del " + fechaVisible}>
                {franjaVisible && <div className="seleccion-franja-zoom" aria-hidden="true" style={{
                    top: `${franjaVisible.inicio / 86400 * 100}%`,
                    height: `${Math.max(1, franjaVisible.fin - franjaVisible.inicio) / 86400 * 100}%`
                }} />}
                {fragmentos.map(fragmento => (
                    <BloqueRegistro
                        key={fragmento.id}
                        fragmento={fragmento}
                        onSeleccionar={onSeleccionar}
                        onAjustarRegistro={onAjustarRegistro}
                        edicionDirectaHabilitada={edicionDirectaHabilitada}
                    />
                ))}
                {fragmentosPlanes.map(fragmento => (
                    <BloquePlan
                        key={fragmento.id}
                        fragmento={fragmento}
                        evento={eventos.find(evento => evento.id === fragmento.plan.eventoId)}
                        onSeleccionar={onSeleccionarPlan}
                        edicionDirectaHabilitada={edicionDirectaHabilitada}
                        onAjustarPlan={onAjustarPlan}
                        tiempoRelativo={ejeTiempoRelativo}
                    />
                ))}
                <MarcoAplicacionPlanificacion
                    fragmentos={fragmentosPlanes}
                    idAplicacion={idAplicacionArmada}
                />
            </div>
        </div>
    )
}
