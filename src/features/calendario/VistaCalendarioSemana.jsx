import { useState } from "react"
import { formatearFechaISO } from "../../domain/tiempo/FechaCalendario.js"
import { BloqueRegistro } from "./BloqueRegistro.jsx"
import { BloquePlan } from "./BloquePlan.jsx"
import { MarcoAplicacionPlanificacion } from "./MarcoAplicacionPlanificacion.jsx"
import { TiempoTotal } from "./TiempoTotal.jsx"

const horasDelDia = Array.from({ length: 24 }, (_, hora) => hora)
const formatoDiaSemana = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric" })
const formatoFechaLarga = new Intl.DateTimeFormat("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
})
const formatoHora = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

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
    planActivoSeguimientoId = null
}) {
    const [formatoMovil, cambiarFormatoMovil] = useState("agenda")
    const actividadesPorDia = fragmentosSemana.map(columna => {
        const actividades = [
            ...columna.fragmentos.map(fragmento => ({ tipo: "registro", fragmento, instante: fragmento.inicio })),
            ...columna.planes.map(fragmento => ({ tipo: "plan", fragmento, instante: fragmento.inicio }))
        ].sort((a, b) => a.instante - b.instante)
        return { ...columna, actividades }
    })

    return (
        <div className={`calendario-semana-scroll calendario-semana-formato-${formatoMovil}`} style={escalaCalendario}>
            <div className="selector-formato-semana" role="group" aria-label="Formato semanal">
                <button type="button" aria-pressed={formatoMovil === "agenda"} onClick={() => cambiarFormatoMovil("agenda")}>Agenda</button>
                <button type="button" aria-pressed={formatoMovil === "grilla"} onClick={() => cambiarFormatoMovil("grilla")}>Grilla por horas</button>
            </div>
            <p className="ayuda-desplazamiento-semana">Deslizá horizontalmente para ver todos los días de la semana.</p>
            <div className="agenda-semana-movil" aria-label={`Agenda de la semana: ${fechaVisible}`}>
                {actividadesPorDia.map((dia, indice) => (
                    <section className="agenda-semana-dia" aria-labelledby={`agenda-semana-dia-${dia.fecha}`} key={dia.fecha}>
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

                {horasDelDia.map(horaDelDia => {
                    const hora = String(horaDelDia).padStart(2, "0")
                    return (
                        <div className="calendario-fila-semanal" role="row" aria-label={`${hora}:00`} key={horaDelDia}>
                            <div className="calendario-celda-hora" role="rowheader">
                                <time dateTime={`${hora}:00`}>{hora}:00</time>
                            </div>
                            {diasSemana.map(dia => {
                                const fecha = formatearFechaISO(dia)
                                return <div className="calendario-celda-semanal" role="cell" aria-label={`${formatoFechaLarga.format(dia)}, ${hora}:00`} data-fecha={fecha} key={`${fecha}-${horaDelDia}`} />
                            })}
                        </div>
                    )
                })}

                </div>
                <div className="capa-registros-semana" role="group" aria-label="Actividades de la semana">
                    {fragmentosSemana.map(columna => (
                        <div
                            className="columna-registros-semana"
                            role="group"
                            aria-label={"Actividades del " + formatoFechaLarga.format(
                                diasSemana.find(dia => formatearFechaISO(dia) === columna.fecha)
                            )}
                            data-fecha={columna.fecha}
                            key={columna.fecha}
                        >
                            {columna.fragmentos.map(fragmento => (
                                <BloqueRegistro
                                    key={fragmento.id}
                                    fragmento={fragmento}
                                    onSeleccionar={onSeleccionar}
                                    onAjustarRegistro={onAjustarRegistro}
                                    edicionDirectaHabilitada={edicionDirectaHabilitada}
                                    permiteCambiarDia
                                />
                            ))}
                            {columna.planes.map(fragmento => (
                                <BloquePlan
                                    key={fragmento.id}
                                    fragmento={fragmento}
                                    evento={eventos.find(evento => evento.id === fragmento.plan.eventoId)}
                                    onSeleccionar={onSeleccionarPlan}
                                    onAjustarPlan={onAjustarPlan}
                                    edicionDirectaHabilitada={edicionDirectaHabilitada && fragmento.plan.id !== planActivoSeguimientoId}
                                    estaEnSeguimiento={fragmento.plan.id === planActivoSeguimientoId}
                                    permiteCambiarDia
                                />
                            ))}
                            <MarcoAplicacionPlanificacion
                                fragmentos={columna.planes}
                                idAplicacion={idAplicacionArmada}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
