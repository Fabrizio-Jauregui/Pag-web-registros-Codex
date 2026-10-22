import { useState } from "react"
import { formatearDuracion } from "../../domain/tiempo/CalculosDuracion.js"
import { useReloj } from "../../app/useReloj.js"
import { FormularioPlan } from "../calendario/FormularioPlan.jsx"
import "./SeguimientoPlanificacion.css"

function valorLocal(fecha) {
    const dos = valor => String(valor).padStart(2, "0")
    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
}

export function PanelSeguimientoPlanificacion({
    seguimiento,
    planes = [],
    eventos = [],
    onCrearPlan,
    onCrearRecurrencia,
    onActualizarPlan,
    onEliminarPlan,
    onEliminarRecurrencia,
    onReordenar
}) {
    const reloj = useReloj()
    const [administrando, cambiarAdministrando] = useState(false)
    const [formularioPlan, cambiarFormularioPlan] = useState(null)
    const [errorCola, cambiarErrorCola] = useState("")
    const {
        estado, error, mensaje, elementoActual, elementoSiguiente, elementoPosterior, segundosRestantes
    } = seguimiento
    if (!estado) return <>
        {error && <p className="seguimiento-plan-error" role="alert">{error}</p>}
        {mensaje && <p className="seguimiento-plan-mensaje" role="status">{mensaje}</p>}
    </>

    const eventosActivos = estado.registrosActivos ?? []
    const esAplicacionParalela = Boolean(estado.idAplicacionPlantilla)
    const actual = estado.indiceActual + 1
    const idsEnCurso = new Set(eventosActivos.map(item => item.planId))
    const idsCerrados = new Set([...(estado.finalizados ?? []), ...(estado.eventosOmitidos ?? [])])
    const proximos = esAplicacionParalela
        ? estado.secuencia.filter((item, indice) => indice !== estado.indiceActual
            && !idsEnCurso.has(item.planId) && !idsCerrados.has(item.planId))
        : estado.secuencia.slice(estado.indiceActual + 1)
    const fechaSeguimiento = new Date(estado.secuencia[0].inicioPrevisto)
    const ahoraMs = reloj.getTime()
    const modoManual = estado.modoAvance === "manual"
    const excedido = estado.estado === "En curso" && elementoActual
        && ahoraMs >= Date.parse(eventosActivos[0]?.finBloque ?? estado.finBloque)
    const segundosExcedidos = excedido
        ? Math.floor((ahoraMs - Date.parse(eventosActivos[0]?.finBloque ?? estado.finBloque)) / 1000)
        : 0
    const comienzoEstimado = estado.estado === "Pausado"
        ? new Date(ahoraMs + estado.restanteMs)
        : new Date(Math.max(ahoraMs, Date.parse(estado.finBloque)))
    const finElementoAnterior = formularioPlan?.indiceInsercion > 0
        ? Date.parse(proximos[formularioPlan.indiceInsercion - 1]?.finPrevisto ?? "")
        : Number.NaN
    const inicioPredeterminado = Number.isFinite(finElementoAnterior)
        ? new Date(Math.max(ahoraMs, finElementoAnterior))
        : comienzoEstimado
    const valoresIniciales = formularioPlan && !formularioPlan.plan
        ? {
            nombre: "",
            eventoId: "",
            inicio: valorLocal(inicioPredeterminado),
            fin: valorLocal(new Date(inicioPredeterminado.getTime() + 30 * 60_000))
        }
        : null

    function abrirNuevoPlan(indiceInsercion) {
        cambiarErrorCola("")
        cambiarFormularioPlan({ plan: null, indiceInsercion })
    }

    function guardarPlan(cambios) {
        const resultado = formularioPlan.plan
            ? onActualizarPlan?.(formularioPlan.plan, cambios)
            : onCrearPlan?.(cambios, formularioPlan.indiceInsercion)
        if (!resultado?.ok) {
            cambiarErrorCola(resultado?.error ?? "No se pudo guardar el plan.")
            return resultado ?? { ok: false }
        }
        cambiarErrorCola("")
        cambiarFormularioPlan(null)
        return resultado
    }

    function crearRecurrencia(cambios) {
        const resultado = onCrearRecurrencia?.(cambios, formularioPlan.indiceInsercion)
        if (!resultado?.ok) {
            cambiarErrorCola(resultado?.error ?? "No se pudo crear la recurrencia.")
            return resultado ?? { ok: false }
        }
        cambiarErrorCola("")
        cambiarFormularioPlan(null)
        return resultado
    }

    function moverPlan(indice, desplazamiento) {
        const nuevos = proximos.map(item => item.planId)
        const destino = indice + desplazamiento
        if (destino < 0 || destino >= nuevos.length) return
        ;[nuevos[indice], nuevos[destino]] = [nuevos[destino], nuevos[indice]]
        const resultado = onReordenar?.(nuevos)
        if (!resultado?.ok) cambiarErrorCola(resultado?.error ?? "No se pudo reordenar la cola.")
        else cambiarErrorCola("")
    }

    function eliminarPlan(planId) {
        const plan = planes.find(item => item.id === planId)
        if (!plan) {
            cambiarErrorCola("No se encontró ese evento en el calendario.")
            return
        }
        if (!window.confirm(`¿Querés quitar “${plan.nombre}” de la planificación?`)) return
        const resultado = plan.idRecurrencia
            ? onEliminarRecurrencia?.(plan)
            : onEliminarPlan?.(plan)
        if (!resultado?.ok) cambiarErrorCola(resultado?.error ?? "No se pudo eliminar el plan.")
        else cambiarErrorCola("")
    }
    return (
        <section className="panel-seguimiento-plan" aria-labelledby="titulo-seguimiento-plan">
            <header>
                <div>
                    <h2 id="titulo-seguimiento-plan">Siguiendo la planificación</h2>
                    <p>{esAplicacionParalela
                        ? `${eventosActivos.length} evento${eventosActivos.length === 1 ? "" : "s"} en curso · ${estado.secuencia.length} en la planificación`
                        : `Evento ${actual} de ${estado.secuencia.length}`}</p>
                </div>
                <span className={`seguimiento-plan-estado seguimiento-plan-estado-${estado.estado === "Pausado" ? "pausado" : "activo"}`}>
                    {estado.estado}
                </span>
            </header>
            <h3>{esAplicacionParalela
                ? `En curso: ${eventosActivos.map(activo => estado.secuencia.find(item => item.planId === activo.planId)?.nombre).filter(Boolean).join(" · ") || elementoActual?.nombre}`
                : elementoActual?.nombre}</h3>
            {!esAplicacionParalela && <>
                <p className="seguimiento-plan-restante">
                    {estado.estado === "Pausado" ? "Tiempo restante" : excedido && modoManual ? "Tiempo excedido" : "Tiempo restante"}: <strong>{formatearDuracion(excedido && modoManual ? segundosExcedidos : segundosRestantes)}</strong>
                </p>
                <progress max={elementoActual?.duracionMs ?? 1}
                    value={estado.estado === "Pausado"
                        ? Math.max(0, (elementoActual?.duracionMs ?? 0) - estado.restanteMs)
                        : Math.max(0, (elementoActual?.duracionMs ?? 0) - Math.max(0, Date.parse(estado.finBloque) - reloj.getTime()))}
                    aria-label="Progreso del evento actual" />
            </>}
            {elementoSiguiente && (
                <p className="seguimiento-plan-siguiente">Próximo: {elementoSiguiente.nombre}</p>
            )}
            {esAplicacionParalela && (
                <fieldset className="seguimiento-plan-modo" aria-label="Modo de avance de la planificación">
                    <legend>Al cumplirse la duración prevista</legend>
                    <label>
                        <input type="radio" name="modo-avance-planificacion" value="manual"
                            checked={modoManual} onChange={() => seguimiento.cambiarModoAvance("manual")} />
                        Manual: seguir registrando y mostrar el tiempo excedido
                    </label>
                    <label>
                        <input type="radio" name="modo-avance-planificacion" value="automatico"
                            checked={!modoManual} onChange={() => seguimiento.cambiarModoAvance("automatico")} />
                        Automático: finalizar el evento al cumplirse su duración
                    </label>
                </fieldset>
            )}
            {esAplicacionParalela && eventosActivos.length > 0 && (
                <section aria-label={eventosActivos.length > 1 ? "Eventos registrándose en paralelo" : "Evento registrándose"}>
                    <h4>{eventosActivos.length > 1 ? "En curso en paralelo" : "Evento registrándose"}</h4>
                    <ul>{eventosActivos.map(activo => {
                        const item = estado.secuencia.find(elemento => elemento.planId === activo.planId)
                        const restante = estado.estado === "Pausado"
                            ? activo.restanteMs
                            : Date.parse(activo.finBloque) - ahoraMs
                        const excedidoEvento = restante < 0 && modoManual && estado.estado === "En curso"
                        const segundosEvento = Math.floor(Math.abs(restante) / 1000)
                        return <li key={activo.planId}>
                            <strong>{item?.nombre}</strong>
                            <span>{excedidoEvento ? "Tiempo excedido" : estado.estado === "Pausado" ? "Tiempo restante" : "Tiempo previsto restante"}: {formatearDuracion(segundosEvento)}</span>
                            <button type="button" onClick={() => seguimiento.finalizarEvento(activo.planId)}>
                                Finalizar “{item?.nombre ?? "evento"}”
                            </button>
                        </li>
                    })}</ul>
                </section>
            )}
            {(estado.eventosOmitidos ?? []).length > 0 && (
                <p className="seguimiento-plan-omitidos">
                    Omitidos en esta sesión: {estado.eventosOmitidos
                        .map(planId => estado.secuencia.find(item => item.planId === planId)?.nombre)
                        .filter(Boolean)
                        .join(", ")}
                </p>
            )}
            {error && <p className="seguimiento-plan-error" role="alert">{error}</p>}
            {mensaje && <p className="seguimiento-plan-mensaje" role="status">{mensaje}</p>}
            <div className="seguimiento-plan-acciones">
                {estado.estado === "En curso"
                    ? <button type="button" onClick={seguimiento.pausar}>Pausar</button>
                    : <button type="button" onClick={seguimiento.reanudar}>Continuar</button>}
                {!esAplicacionParalela && <button type="button" onClick={seguimiento.finalizarYContinuar}>
                    {elementoSiguiente ? "Finalizar y continuar con el próximo" : "Finalizar secuencia"}
                </button>}
                {!esAplicacionParalela && elementoSiguiente && (
                    <button type="button" onClick={seguimiento.finalizarYOmitirSiguiente}>
                        {elementoPosterior
                            ? `Finalizar, omitir “${elementoSiguiente.nombre}” y continuar con “${elementoPosterior.nombre}”`
                            : `Finalizar y omitir “${elementoSiguiente.nombre}”`}
                    </button>
                )}
                <button type="button" className="seguimiento-plan-detener" onClick={seguimiento.dejarDeSeguir}>
                    Dejar de seguir
                </button>
            </div>
            <details className="seguimiento-plan-gestion" open={administrando} onToggle={evento => cambiarAdministrando(evento.currentTarget.open)}>
                    <summary>Editar próximos eventos</summary>
                    {errorCola && <p className="seguimiento-plan-error" role="alert">{errorCola}</p>}
                    {proximos.length > 0 ? <ol aria-label="Próximos eventos de la planificación">
                        {proximos.map((item, indice) => {
                            const plan = planes.find(elemento => elemento.id === item.planId)
                            const inicio = new Date(item.inicioPrevisto)
                            const fin = new Date(item.finPrevisto)
                            const hora = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" })
                            return <li key={item.planId}>
                                <div>
                                    <strong>{item.nombre}</strong>
                                    <span>{hora.format(inicio)}–{hora.format(fin)} · {formatearDuracion(Math.round(item.duracionMs / 1000))}</span>
                                </div>
                                <div className="seguimiento-plan-item-acciones">
                                    <button type="button" aria-label={`Mover ${item.nombre} antes`} disabled={indice === 0} onClick={() => moverPlan(indice, -1)}>↑</button>
                                    <button type="button" aria-label={`Mover ${item.nombre} después`} disabled={indice === proximos.length - 1} onClick={() => moverPlan(indice, 1)}>↓</button>
                                    <button type="button" disabled={!plan} onClick={() => plan && cambiarFormularioPlan({ plan })}>Editar</button>
                                    <button type="button" disabled={!plan} onClick={() => eliminarPlan(item.planId)}>Eliminar</button>
                                    {esAplicacionParalela && <button type="button"
                                        aria-label={`Omitir ${item.nombre} en este seguimiento`}
                                        onClick={() => {
                                            if (!seguimiento.omitirEvento(item.planId)) cambiarErrorCola("No se pudo omitir el evento en este seguimiento.")
                                            else cambiarErrorCola("")
                                        }}>
                                        Omitir de esta sesión
                                    </button>}
                                </div>
                                <button type="button" className="seguimiento-plan-insertar" onClick={() => abrirNuevoPlan(indice + 1)}>
                                    Agregar después de {item.nombre}
                                </button>
                            </li>
                        })}
                    </ol> : <p>Todavía no hay eventos después del actual.</p>}
                    <button type="button" onClick={() => abrirNuevoPlan(0)}>Agregar como próximo evento</button>
                    <button type="button" onClick={() => abrirNuevoPlan(proximos.length)}>Agregar al final</button>
            </details>
            {formularioPlan && (
                <FormularioPlan
                    key={formularioPlan.plan?.id ?? `nuevo-plan-seguimiento-${formularioPlan.indiceInsercion}`}
                    plan={formularioPlan.plan ?? null}
                    fechaSeleccionada={fechaSeguimiento}
                    eventos={eventos}
                    valoresIniciales={valoresIniciales}
                    onGuardar={guardarPlan}
                    onCrearRecurrencia={crearRecurrencia}
                    onCancelar={() => cambiarFormularioPlan(null)}
                />
            )}
        </section>
    )
}
