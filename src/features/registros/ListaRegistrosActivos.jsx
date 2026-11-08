import {
    calcularTiempoEfectivo,
    calcularTiempoPausado,
    calcularTiempoTranscurrido,
    formatearDuracion,
    puedeFinalizarRegistro
} from "../../domain/tiempo/CalculosDuracion.js"
import { useReloj } from "../../app/useReloj.js"
import {
    obtenerOrigenGestionRegistro,
    ORIGEN_GESTION_FOCUS,
    ORIGEN_GESTION_INDEPENDIENTE
} from "../../domain/registros/origenGestionRegistro.js"

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
                const origenGestion = obtenerOrigenGestionRegistro(registro)
                const gestionIndependiente = origenGestion === ORIGEN_GESTION_INDEPENDIENTE

                return (
                    <article className="registro-activo" key={registro.id} aria-label={`Actividad activa: ${registro.nombre}`}>
                        <h4>{registro.nombre}</h4>
                        <p className={`registro-activo-estado registro-activo-estado-${registro.estado.toLowerCase().replaceAll(" ", "-")}`}>
                            Estado actual: <strong>{registro.estado}</strong>
                        </p>
                        <p>Tiempo efectivo: {formatearDuracion(efectivo)}</p>
                        <p>Tiempo en pausa: {formatearDuracion(pausado)}</p>
                        <p>Tiempo transcurrido: {formatearDuracion(transcurrido)}</p>
                        {gestionIndependiente ? (
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
                        ) : (
                            <p className="registro-activo-origen-gestion">
                                Gestioná desde {origenGestion === ORIGEN_GESTION_FOCUS ? "Focus" : "Planificación"}.
                            </p>
                        )}
                    </article>
                )
            })}
        </section>
    )
}
