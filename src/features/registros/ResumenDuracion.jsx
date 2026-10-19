import { formatearDuracion } from "../../domain/tiempo/CalculosDuracion.js"

export function ResumenDuracion({
    nombreConfirmado,
    estadoRegistro,
    tiempoEfectivo,
    tiempoPausado,
    tiempoTranscurrido
}) {
    return (
        <>
            <p>
                Nombre: {nombreConfirmado || "Sin registro activo"}
            </p>

            {estadoRegistro && <p>Estado del registro: {estadoRegistro}</p>}

            <p>
                Tiempo efectivo:{" "}
                {tiempoEfectivo === null
                    ? "Sin registro"
                    : formatearDuracion(tiempoEfectivo)}
            </p>

            <p>
                Tiempo en pausa:{" "}
                {tiempoPausado === null
                    ? "Sin registro"
                    : formatearDuracion(tiempoPausado)}
            </p>

            <p>
                Tiempo transcurrido:{" "}
                {tiempoTranscurrido === null
                    ? "Sin registro"
                    : formatearDuracion(tiempoTranscurrido)}
            </p>
        </>
    )
}
