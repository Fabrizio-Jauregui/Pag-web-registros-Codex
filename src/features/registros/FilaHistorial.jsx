import { useState } from "react"

import { formatearDuracion } from "../../domain/tiempo/CalculosDuracion.js"
import { formatearInstante, obtenerResumenRegistro } from "../../domain/tiempo/historial.js"
import { useReloj } from "../../app/useReloj.js"

function formatearHora(instante) {
    return formatearInstante(instante, {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    })
}

function FilaHistorialContenido({ registro, ahora, tareas = [] }) {
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
                        <div><dt>Tiempo transcurrido</dt><dd>{formatearDuracion(resumen.transcurrido)}</dd></div>
                    </dl>
                    {registro.tareaId && <p className="historial-tarea">Tarea: <strong>{tarea?.nombre ?? registro.tareaNombre ?? "Tarea no disponible"}</strong></p>}
                    <h4>Segmentos</h4>
                    <ol className="lista-segmentos">
                        {registro.segmentos.map((segmento, indice) => (
                            <li key={`${registro.id}-${indice}`}>
                                <span>{segmento.tipo}</span>
                                <time dateTime={segmento.inicio.toISOString()}>{formatearHora(segmento.inicio)}</time>
                                <span>–</span>
                                {segmento.fin
                                    ? <time dateTime={segmento.fin.toISOString()}>{formatearHora(segmento.fin)}</time>
                                    : <span>En curso</span>}
                            </li>
                        ))}
                    </ol>
                    {registro.motivoCancelacion && (
                        <p className="historial-motivo">Motivo de cancelación: {registro.motivoCancelacion}</p>
                    )}
                </div>
            </details>
        </li>
    )
}

function FilaHistorialEnVivo({ registro, tareas }) {
    const ahora = useReloj()
    return <FilaHistorialContenido registro={registro} ahora={ahora} tareas={tareas} />
}

export function FilaHistorial({ registro, ahora, tareas = [] }) {
    return registro.segmentos.at(-1).fin === null
        ? <FilaHistorialEnVivo registro={registro} tareas={tareas} />
        : <FilaHistorialContenido registro={registro} ahora={ahora} tareas={tareas} />
}
