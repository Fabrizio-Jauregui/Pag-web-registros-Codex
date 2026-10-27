import { ordenarPlantillasEventos, OPCIONES_ORDEN_PLANTILLAS_EVENTOS } from "../../domain/eventos/ordenPlantillasEventos.js"

export function ControlesRegistro({
    nombre,
    cambiarNombre,
    eventos = [],
    tareas = [],
    tareaId = "",
    cambiarTareaId = () => {},
    eventoId = "",
    cambiarEventoId = () => {},
    estado,
    manejarPlay,
    manejarPause,
    manejarStop,
    puedeDetener,
    bloqueado = false,
    idPrefix = "",
    ordenEventos = "ultimo-uso",
    cambiarOrdenEventos = () => {}
}) {
    const idNombre = idPrefix ? `${idPrefix}-nombre-registro` : "nombre-registro"
    const idEvento = idPrefix ? `${idPrefix}-evento-registro` : "evento-registro"
    const idTarea = idPrefix ? `${idPrefix}-tarea-registro` : "tarea-registro"
    const idOrdenEventos = idPrefix ? `${idPrefix}-orden-eventos-registro` : "orden-eventos-registro"
    const eventosOrdenados = ordenarPlantillasEventos(eventos, ordenEventos)
    return (
        <div className="controles-temporizador">
            <label htmlFor={idNombre}>
                <span>Nombre del temporizador</span>
                <input
                    id={idNombre}
                    type="text"
                    value={nombre}
                    disabled={estado !== "Inactivo" || bloqueado || Boolean(eventoId)}
                    onChange={e => cambiarNombre(e.target.value)}
                />
            </label>

            <label htmlFor={idTarea}>
                <span>Tarea (opcional)</span>
                <select
                    id={idTarea}
                    value={tareaId}
                    disabled={estado !== "Inactivo" || bloqueado}
                    onChange={evento => cambiarTareaId(evento.target.value)}
                >
                    <option value="">Sin tarea</option>
                    {tareas.map(tarea => <option value={tarea.id} key={tarea.id}>{tarea.rutaNombre ?? tarea.nombre} · {tarea.estado}</option>)}
                </select>
            </label>

            <label htmlFor={idOrdenEventos}>
                <span>Ordenar plantillas</span>
                <select
                    id={idOrdenEventos}
                    value={ordenEventos}
                    onChange={evento => cambiarOrdenEventos(evento.target.value)}
                >
                    {OPCIONES_ORDEN_PLANTILLAS_EVENTOS.map(opcion => (
                        <option value={opcion.valor} key={opcion.valor}>{opcion.etiqueta}</option>
                    ))}
                </select>
            </label>

            <label htmlFor={idEvento}>
                <span>Plantilla de evento</span>
                <select
                    id={idEvento}
                    value={eventoId}
                    disabled={estado !== "Inactivo" || bloqueado}
                    onChange={evento => cambiarEventoId(evento.target.value)}
                >
                    <option value="">Sin plantilla</option>
                    {eventosOrdenados.map(plantilla => (
                        <option value={plantilla.id} key={plantilla.id}>{plantilla.nombre}</option>
                    ))}
                </select>
            </label>

            <p className={`estado-temporizador estado-temporizador-${estado.toLowerCase().replaceAll(" ", "-")}`}>
                Estado actual: <strong>{estado}</strong>
            </p>

            <div className="acciones-temporizador">
                <button
                    type="button"
                    className="boton-iniciar-temporizador"
                    disabled={estado === "En curso" || bloqueado}
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
