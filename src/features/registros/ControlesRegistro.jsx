import { SelectorOrigenActividad } from "../comun/SelectorOrigenActividad.jsx"

export function ControlesRegistro({
    nombre,
    cambiarNombre,
    eventos = [],
    categorias = [],
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
    const sinOrigen = !eventoId && !tareaId
    const eventoSeleccionado = eventos.find(item => item.id === eventoId)
    const tareaSeleccionada = tareas.find(item => item.id === tareaId)
    return (
        <div className="controles-temporizador">
            <label htmlFor={idNombre}>
                <span>Nombre del registro</span>
                <input
                    id={idNombre}
                    type="text"
                    value={eventoSeleccionado?.nombre ?? tareaSeleccionada?.nombre ?? nombre}
                    disabled
                    onChange={e => cambiarNombre(e.target.value)}
                />
            </label>

            <SelectorOrigenActividad
                tipo="tarea"
                etiqueta="Tarea"
                opciones={tareas}
                value={tareaId}
                emptyLabel="Sin tarea"
                disabled={estado !== "Inactivo" || bloqueado || Boolean(eventoId)}
                onChange={opcion => cambiarTareaId(opcion?.id ?? "")}
            />

            <SelectorOrigenActividad
                tipo="evento"
                etiqueta="Plantilla de evento"
                opciones={eventos}
                categorias={categorias}
                value={eventoId}
                emptyLabel="Sin plantilla"
                ordenEventos={ordenEventos}
                cambiarOrdenEventos={cambiarOrdenEventos}
                disabled={estado !== "Inactivo" || bloqueado || Boolean(tareaId)}
                onChange={opcion => cambiarEventoId(opcion?.id ?? "")}
            />

            {sinOrigen
                ? <p className="ayuda-temporizador" role="status">Elegí una tarea o una plantilla de evento para iniciar el registro.</p>
                : <p className="ayuda-temporizador" role="status">El registro se guardará con el nombre de la {eventoId ? "plantilla de evento" : "tarea"} seleccionada.</p>}

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
