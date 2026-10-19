import {
    calcularTiempoEfectivo,
    calcularTiempoPausado,
    calcularTiempoTranscurrido,
    formatearDuracion,
    puedeFinalizarRegistro
} from "../../domain/tiempo/CalculosDuracion.js"
import { useReloj } from "../../app/useReloj.js"

export function ListaRegistrosActivos({ registros, estadoRegistro, titulo = "Actividades activas", className = "" }) {
    const ahora = useReloj()

    return (
        <section className={`registros-activos ${className}`.trim()} aria-labelledby="titulo-registros-activos">
            <h3 id="titulo-registros-activos">{titulo}</h3>
            {registros.map(registro => {
                const efectivo = calcularTiempoEfectivo(registro.segmentos, ahora)
                const pausado = calcularTiempoPausado(registro.segmentos, ahora)
                const transcurrido = calcularTiempoTranscurrido(registro.segmentos, ahora)
                const puedeDetener = puedeFinalizarRegistro(registro.segmentos, ahora)

                return (
                    <article className="registro-activo" key={registro.id} aria-label={`Actividad activa: ${registro.nombre}`}>
                        <h4>{registro.nombre}</h4>
                        <p className={`registro-activo-estado registro-activo-estado-${registro.estado.toLowerCase().replaceAll(" ", "-")}`}>
                            Estado actual: <strong>{registro.estado}</strong>
                        </p>
                        <p>Tiempo efectivo: {formatearDuracion(efectivo)}</p>
                        <p>Tiempo en pausa: {formatearDuracion(pausado)}</p>
                        <p>Tiempo transcurrido: {formatearDuracion(transcurrido)}</p>
                        <div className="controles-registro-activo">
                            {registro.estado === "En curso" ? (
                            <button type="button" className="boton-pausar-temporizador" onClick={() => estadoRegistro.pausar(registro.id)}>Pausar</button>
                            ) : (
                                <button type="button" onClick={() => estadoRegistro.continuar(registro.id)}>Continuar</button>
                            )}
                            <button
                                type="button"
                                className="boton-finalizar-temporizador"
                                disabled={!puedeDetener}
                                onClick={() => estadoRegistro.finalizar(registro.id)}
                            >Finalizar</button>
                        </div>
                    </article>
                )
            })}
        </section>
    )
}
