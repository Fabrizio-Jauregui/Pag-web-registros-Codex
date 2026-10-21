import { useState } from "react"
import { formatearInstante } from "../../domain/tiempo/historial.js"

const opciones = { dateStyle: "full", timeStyle: "short" }

export function DetallePlan({ plan, evento, onEditar, onEliminar, onEliminarAplicacion, onEliminarRecurrencia, onCerrar, onMoverAplicacion, onSeguirPlan, seguimientoActivo = false, planActivoSeguimiento = false }) {
    const [mostrarOpcionesSeguimiento, cambiarMostrarOpcionesSeguimiento] = useState(false)
    const [errorSeguimiento, cambiarErrorSeguimiento] = useState("")
    const [alcanceEliminar, cambiarAlcanceEliminar] = useState("solo")
    function empezarSeguimiento(modo) {
        const resultado = onSeguirPlan(plan.id, modo)
        if (!resultado?.ok) cambiarErrorSeguimiento(resultado?.error ?? "No se pudo iniciar el seguimiento.")
        else cambiarErrorSeguimiento("")
    }
    const nombre = evento?.nombre ?? plan.nombre
    return (
        <section className="detalle-plan" aria-labelledby="titulo-detalle-plan">
            <header>
                <div>
                    <h3 id="titulo-detalle-plan">Plan: {nombre}</h3>
                    <p>Actividad planificada{evento ? ` · Plantilla: ${evento.nombre}` : ""}</p>
                </div>
                <button type="button" aria-label="Cerrar detalle del plan" onClick={onCerrar}>Cerrar</button>
            </header>
            {plan.idRecurrencia && <p>Serie semanal · Aparición del {new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(`${plan.fechaRecurrencia}T00:00:00`))}</p>}
            <dl>
                <div><dt>Inicio</dt><dd><time dateTime={plan.inicio.toISOString()}>{formatearInstante(plan.inicio, opciones)}</time></dd></div>
                <div><dt>Fin</dt><dd><time dateTime={plan.fin.toISOString()}>{formatearInstante(plan.fin, opciones)}</time></dd></div>
            </dl>
            {!seguimientoActivo && (
                <div className="acciones-seguir-plan">
                    {!mostrarOpcionesSeguimiento
                        ? <button type="button" onClick={() => cambiarMostrarOpcionesSeguimiento(true)}>Seguir planificación</button>
                        : <>
                            <p>¿Desde dónde querés comenzar?</p>
                            <button type="button" onClick={() => empezarSeguimiento("actual")}>Desde este evento</button>
                            <button type="button" onClick={() => empezarSeguimiento("primero")}>Desde el primero del día</button>
                            <button type="button" onClick={() => cambiarMostrarOpcionesSeguimiento(false)}>Cancelar</button>
                        </>}
                    {errorSeguimiento && <p role="alert">{errorSeguimiento}</p>}
                </div>
            )}
            {planActivoSeguimiento
                ? <p role="status">Este evento está en curso y permanece bloqueado hasta que termine.</p>
                : <div className="acciones-detalle-plan">
                {plan.idAplicacionPlantilla && <button type="button" onClick={onMoverAplicacion}>Mover aplicación completa</button>}
                <button type="button" onClick={onEditar}>Editar plan</button>
                {plan.idRecurrencia ? <>
                    <label><span>Eliminar</span><select value={alcanceEliminar} onChange={evento => cambiarAlcanceEliminar(evento.target.value)}>
                        <option value="solo">Solo esta aparición</option><option value="siguientes">Esta y las siguientes</option><option value="toda">Toda la serie</option>
                    </select></label>
                    <button type="button" onClick={() => onEliminarRecurrencia(alcanceEliminar)}>Eliminar selección</button>
                </> : <button type="button" onClick={onEliminar}>Eliminar plan</button>}
                {plan.idAplicacionPlantilla && (
                    <button type="button" onClick={onEliminarAplicacion}>Eliminar aplicación completa</button>
                )}
            </div>}
        </section>
    )
}
