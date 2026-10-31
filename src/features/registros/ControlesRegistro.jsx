import { SelectorOrigenRegistro } from "../comun/SelectorOrigenRegistro.jsx"

export function ControlesRegistro({
    origen = {},
    cambiarOrigen = () => {},
    eventos = [],
    categorias = [],
    tareas = [],
    estado,
    manejarPlay,
    manejarPause,
    manejarStop,
    puedeDetener,
    bloqueado = false,
    ordenEventos = "ultimo-uso",
    cambiarOrdenEventos = () => {}
}) {
    const sinOrigen = !origen.tipo || ((origen.tipo === "evento" && !origen.eventoId) || (origen.tipo === "tarea" && !origen.tareaId) || (origen.tipo === "puntual" && !origen.nombre?.trim()))
    return (
        <div className="controles-temporizador">
            <SelectorOrigenRegistro valor={origen} onChange={cambiarOrigen} eventos={eventos} tareas={tareas} categorias={categorias} ordenEventos={ordenEventos} cambiarOrdenEventos={cambiarOrdenEventos} disabled={estado !== "Inactivo" || bloqueado} />

            {sinOrigen
                ? <p className="ayuda-temporizador" role="status">Elegí una plantilla, una tarea o nombrá una actividad puntual.</p>
                : <p className="ayuda-temporizador" role="status">El registro conservará el nombre de la actividad elegida.</p>}

            <p className={`estado-temporizador estado-temporizador-${estado.toLowerCase().replaceAll(" ", "-")}`}>
                Estado actual: <strong>{estado}</strong>
            </p>

            <div className="acciones-temporizador">
                <button
                    type="button"
                    className="boton-iniciar-temporizador"
                    disabled={estado === "En curso" || bloqueado || (estado === "Inactivo" && sinOrigen)}
                    onClick={manejarPlay}
                >
                    {estado === "Pausado" ? "Reanudar" : "Iniciar"}
                </button>

                <button
                    type="button"
                    className="boton-pausar-temporizador"
                    disabled={estado !== "En curso" || bloqueado}
                    onClick={manejarPause}
                >
                    Pausar
                </button>

                <button
                    type="button"
                    className="boton-finalizar-temporizador"
                    disabled={estado === "Inactivo" || !puedeDetener || bloqueado}
                    onClick={manejarStop}
                >
                    Finalizar
                </button>
            </div>

            {estado !== "Inactivo" && !puedeDetener && (
                <p className="ayuda-temporizador" role="status">Podrás finalizarla después de registrar al menos 1 segundo.</p>
            )}
        </div>
    )
}
