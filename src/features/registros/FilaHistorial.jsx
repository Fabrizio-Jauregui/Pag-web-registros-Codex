import { useState } from "react"

import { formatearDuracion } from "../../domain/tiempo/CalculosDuracion.js"
import { formatearInstante, obtenerResumenRegistro } from "../../domain/tiempo/historial.js"
import { useReloj } from "../../app/useReloj.js"

function formatearHora(instante) {
    return formatearInstante(instante, {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    })
}

function FilaHistorialContenido({ registro, ahora, tareas = [], categorias = [], onEditar, onEliminar }) {
    const [expandido, cambiarExpandido] = useState(false)
    const inicio = registro.segmentos[0].inicio
    const fin = registro.segmentos.at(-1).fin
    const resumen = obtenerResumenRegistro(registro, ahora)
    const abierto = fin === null
    const idDetalle = "detalle-historial-" + registro.id
    const tarea = tareas.find(item => item.id === registro.tareaId)

    return (
        <li className="historial-fila">
            <details
                open={expandido}
                onToggle={evento => cambiarExpandido(evento.currentTarget.open)}
            >
                <summary
                    aria-expanded={expandido}
                    aria-controls={idDetalle}
                >
                    <span className="historial-resumen-principal">
                        <strong>{registro.nombre}</strong>
                        <span>{formatearInstante(inicio, { dateStyle: "medium" })}</span>
                    </span>
                    <span className="historial-resumen-secundario">
                        <span>{formatearHora(inicio)} – {fin ? formatearHora(fin) : "En curso"}</span>
                        <span className={`historial-estado ${abierto ? "esta-abierto" : ""}`}>{registro.estado}</span>
                    </span>
                </summary>

                <div className="historial-detalle" id={idDetalle}>
                    <dl className="historial-metricas">
                        <div><dt>Tiempo efectivo</dt><dd>{formatearDuracion(resumen.efectivo)}</dd></div>
                        <div><dt>Tiempo pausado</dt><dd>{formatearDuracion(resumen.pausado)}</dd></div>
                        {resumen.sinClasificar > 0 && <div><dt>Tiempo sin registrar</dt><dd>{formatearDuracion(resumen.sinClasificar)}</dd></div>}
                        <div><dt>Tiempo transcurrido</dt><dd>{formatearDuracion(resumen.transcurrido)}</dd></div>
                    </dl>
                    {registro.tareaId && <p className="historial-tarea">Tarea: <strong>{tarea?.rutaNombre ?? tarea?.nombre ?? registro.tareaNombre ?? "Tarea no disponible"}</strong></p>}
                    {registro.origenPuntual === true && <p className="historial-tarea">Actividad puntual{registro.categoriaIds?.length ? <> · Categorías: <strong>{registro.categoriaIds.map(id => categorias.find(item => item.id === id)?.nombre).filter(Boolean).join(", ") || "Sin categoría disponible"}</strong></> : " · Sin categorías"}</p>}
                    <h4>Segmentos</h4>
                    <ol className="lista-segmentos">
                        {registro.segmentos.flatMap((segmento, indice) => {
                            const anterior = registro.segmentos[indice - 1]
                            const hueco = anterior?.fin ? segmento.inicio.getTime() - anterior.fin.getTime() : 0
                            return [
                                ...(hueco > 0 ? [<li key={`${registro.id}-hueco-${indice}`} className="segmento-sin-registrar">
                                    <span>Sin registrar · {formatearDuracion(Math.floor(hueco / 1000))}</span>
                                    <time dateTime={anterior.fin.toISOString()}>{formatearHora(anterior.fin)}</time><span>–</span>
                                    <time dateTime={segmento.inicio.toISOString()}>{formatearHora(segmento.inicio)}</time>
                                </li>] : []),
                                <li key={`${registro.id}-${indice}`}>
                                    <span>{segmento.tipo}</span>
                                    <time dateTime={segmento.inicio.toISOString()}>{formatearHora(segmento.inicio)}</time>
                                    <span>–</span>
                                    {segmento.fin
                                        ? <time dateTime={segmento.fin.toISOString()}>{formatearHora(segmento.fin)}</time>
                                        : <span>En curso</span>}
                                </li>
                            ]
                        })}
                    </ol>
                    {registro.motivoCancelacion && (
                        <p className="historial-motivo">Motivo de cancelación: {registro.motivoCancelacion}</p>
                    )}
                    {registro.estado === "Finalizado" && (
                        <div className="historial-acciones">
                            <button type="button" onClick={() => onEditar?.(registro)}>Editar registro</button>
                            <button type="button" onClick={() => onEliminar?.(registro)}>Eliminar registro</button>
                        </div>
                    )}
                </div>
            </details>
        </li>
    )
}

function FilaHistorialEnVivo({ registro, tareas, categorias }) {
    const ahora = useReloj()
    return <FilaHistorialContenido registro={registro} ahora={ahora} tareas={tareas} categorias={categorias} />
}

export function FilaHistorial({ registro, ahora, tareas = [], categorias = [], onEditar, onEliminar }) {
    return registro.segmentos.at(-1).fin === null
        ? <FilaHistorialEnVivo registro={registro} tareas={tareas} categorias={categorias} />
        : <FilaHistorialContenido registro={registro} ahora={ahora} tareas={tareas} categorias={categorias} onEditar={onEditar} onEliminar={onEliminar} />
}
