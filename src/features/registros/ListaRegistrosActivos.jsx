import {
    calcularTiempoEfectivo,
    calcularTiempoPausado,
    calcularTiempoTranscurrido,
    formatearDuracion,
    puedeFinalizarRegistro
} from "../../domain/tiempo/CalculosDuracion.js"
import { useEffect, useState } from "react"
import { useReloj } from "../../app/useReloj.js"
import {
    obtenerOrigenGestionRegistro,
    ORIGEN_GESTION_FOCUS,
    ORIGEN_GESTION_INDEPENDIENTE
} from "../../domain/registros/origenGestionRegistro.js"

export function ListaRegistrosActivos({ registros, estadoRegistro, titulo = "Actividades activas", className = "", onFinalizarVinculado }) {
    const ahora = useReloj()
    const [cierresPendientes, cambiarCierresPendientes] = useState([])
    const [errorFinalizar, cambiarErrorFinalizar] = useState("")

    useEffect(() => {
        const intervalo = setInterval(() => cambiarCierresPendientes(actuales => actuales.filter(item => item.venceEn > Date.now())), 1000)
        return () => clearInterval(intervalo)
    }, [])

    function finalizarVinculado(registro) {
        const resultado = onFinalizarVinculado?.(registro)
        if (!resultado?.ok) {
            cambiarErrorFinalizar(resultado?.error ?? "No se pudo finalizar el evento planificado.")
            return
        }
        cambiarErrorFinalizar("")
        cambiarCierresPendientes(actuales => [...actuales, {
            id: registro.id,
            nombre: registro.nombre,
            venceEn: Date.now() + 120_000,
            deshacer: resultado.deshacer
        }])
    }

    if (registros.length === 0 && cierresPendientes.length === 0) return null

    return (
        <section className={`registros-activos ${className}`.trim()} aria-labelledby="titulo-registros-activos">
            <h3 id="titulo-registros-activos">{titulo}</h3>
            {errorFinalizar && <p role="alert">{errorFinalizar}</p>}
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
                        ) : onFinalizarVinculado ? (
                            <div className="controles-registro-activo">
                                <button
                                    type="button"
                                    className="boton-finalizar-temporizador"
                                    disabled={!puedeDetener}
                                    onClick={() => finalizarVinculado(registro)}
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
            {cierresPendientes.length > 0 && <section aria-label="Finalizaciones que podés deshacer" className="registros-activos-deshacer">
                {cierresPendientes.map(item => <div key={item.id}>
                    <span>Se finalizó “{item.nombre}”.</span>
                    <button type="button" disabled={item.venceEn <= ahora.getTime()} onClick={() => {
                        if (item.venceEn <= Date.now() || !item.deshacer?.()) return
                        cambiarCierresPendientes(actuales => actuales.filter(actual => actual.id !== item.id))
                    }}>Deshacer</button>
                </div>)}
            </section>}
        </section>
    )
}
