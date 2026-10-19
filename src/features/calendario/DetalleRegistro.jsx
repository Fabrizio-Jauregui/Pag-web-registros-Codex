import { formatearDuracion } from "../../domain/tiempo/CalculosDuracion.js"
import { obtenerResumenRegistro, formatearInstante } from "../../domain/tiempo/historial.js"
import { ESTADO_REGISTRO_FINALIZADO } from "../../domain/registros/registros.js"
import { useReloj } from "../../app/useReloj.js"

function hora(instante) {
    return formatearInstante(instante, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
}

function DetalleRegistroContenido({ registro, ahora, tareas = [], onEditar, onEliminar, onCerrar }) {
    const resumen = obtenerResumenRegistro(registro, ahora)
    const tarea = tareas.find(item => item.id === registro.tareaId)

    return (
        <section className="detalle-registro-calendario" aria-labelledby="titulo-detalle-calendario">
            <header>
                <div>
                    <h3 id="titulo-detalle-calendario">{registro.nombre}</h3>
                    <p>
                        {formatearInstante(registro.segmentos[0].inicio, { dateStyle: "full" })}
                        {registro.eventoId && " · Vinculado a una plantilla de evento"}
                        {registro.tareaId && ` · Tarea: ${tarea?.nombre ?? registro.tareaNombre ?? "Tarea no disponible"}`}
                    </p>
                </div>
                <button type="button" onClick={onCerrar} aria-label="Cerrar detalle">Cerrar</button>
            </header>

            <p>Estado: <strong>{registro.estado}</strong></p>
            <dl className="detalle-registro-metricas">
                <div><dt>Tiempo efectivo</dt><dd>{formatearDuracion(resumen.efectivo)}</dd></div>
                <div><dt>Tiempo pausado</dt><dd>{formatearDuracion(resumen.pausado)}</dd></div>
                <div><dt>Tiempo transcurrido</dt><dd>{formatearDuracion(resumen.transcurrido)}</dd></div>
            </dl>

            <h4>Segmentos</h4>
            <ol className="detalle-registro-segmentos">
                {registro.segmentos.map((segmento, indice) => (
                    <li key={`${registro.id}-${indice}`}>
                        <span>{segmento.tipo}</span>
                        <time dateTime={segmento.inicio.toISOString()}>{hora(segmento.inicio)}</time>
                        <span>–</span>
                        {segmento.fin ? <time dateTime={segmento.fin.toISOString()}>{hora(segmento.fin)}</time> : <span>En curso</span>}
                    </li>
                ))}
            </ol>

            {registro.motivoCancelacion && <p>Motivo: {registro.motivoCancelacion}</p>}
            {registro.estado === ESTADO_REGISTRO_FINALIZADO && (
                <>
                    <button type="button" onClick={evento => onEditar(registro, evento)}>Editar registro</button>
                    <button type="button" onClick={() => onEliminar(registro)}>Eliminar registro</button>
                </>
            )}
        </section>
    )
}

function DetalleRegistroEnVivo(props) {
    const ahora = useReloj()
    return <DetalleRegistroContenido {...props} ahora={ahora} />
}

export function DetalleRegistro({ registro, tareas = [], onEditar, onEliminar, onCerrar }) {
    const props = { registro, tareas, onEditar, onEliminar, onCerrar }
    return registro.segmentos.at(-1).fin === null
        ? <DetalleRegistroEnVivo {...props} />
        : <DetalleRegistroContenido {...props} ahora={new Date()} />
}
