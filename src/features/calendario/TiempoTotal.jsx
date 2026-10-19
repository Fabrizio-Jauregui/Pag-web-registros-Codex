import { useReloj } from "../../app/useReloj.js"
import { calcularTiempoTotalDelDia, formatearDuracion } from "../../domain/tiempo/CalculosDuracion.js"

export function TiempoTotal({ registros, fecha, as = "strong", className, etiquetaAccesible }) {
    const ahora = useReloj()
    const Elemento = as
    const duracion = formatearDuracion(calcularTiempoTotalDelDia(registros, fecha, ahora))
    return (
        <Elemento className={className}>
            {etiquetaAccesible && (
                <span className="solo-lectores">{etiquetaAccesible}: </span>
            )}
            {duracion}
        </Elemento>
    )
}
