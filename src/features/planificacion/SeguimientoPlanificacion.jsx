import { formatearDuracion } from "../../domain/tiempo/CalculosDuracion.js"
import { useReloj } from "../../app/useReloj.js"
import "./SeguimientoPlanificacion.css"

export function PanelSeguimientoPlanificacion({ seguimiento }) {
    const reloj = useReloj()
    const { estado, error, elementoActual, segundosRestantes } = seguimiento
    if (!estado) return error ? <p className="seguimiento-plan-error" role="alert">{error}</p> : null

    const actual = estado.indiceActual + 1
    return (
        <section className="panel-seguimiento-plan" aria-labelledby="titulo-seguimiento-plan">
            <header>
                <div>
                    <h2 id="titulo-seguimiento-plan">Siguiendo la planificación</h2>
                    <p>Evento {actual} de {estado.secuencia.length}</p>
                </div>
                <span className={`seguimiento-plan-estado seguimiento-plan-estado-${estado.estado === "Pausado" ? "pausado" : "activo"}`}>
                    {estado.estado}
                </span>
            </header>
            <h3>{elementoActual?.nombre}</h3>
            <p className="seguimiento-plan-restante">
                {estado.estado === "Pausado" ? "Tiempo restante" : "Termina en"}: <strong>{formatearDuracion(segundosRestantes)}</strong>
            </p>
            <progress max={elementoActual?.duracionMs ?? 1}
                value={estado.estado === "Pausado"
                    ? Math.max(0, (elementoActual?.duracionMs ?? 0) - estado.restanteMs)
                    : Math.max(0, (elementoActual?.duracionMs ?? 0) - Math.max(0, Date.parse(estado.finBloque) - reloj.getTime()))}
                aria-label="Progreso del evento actual" />
            {estado.secuencia.length > actual && (
                <p className="seguimiento-plan-siguiente">Siguiente: {estado.secuencia[actual].nombre}</p>
            )}
            {error && <p className="seguimiento-plan-error" role="alert">{error}</p>}
            <div className="seguimiento-plan-acciones">
                {estado.estado === "En curso"
                    ? <button type="button" onClick={seguimiento.pausar}>Pausar</button>
                    : <button type="button" onClick={seguimiento.reanudar}>Continuar</button>}
                <button type="button" onClick={seguimiento.saltar}>Saltar evento</button>
                <button type="button" className="seguimiento-plan-detener" onClick={seguimiento.dejarDeSeguir}>
                    Dejar de seguir
                </button>
            </div>
        </section>
    )
}
