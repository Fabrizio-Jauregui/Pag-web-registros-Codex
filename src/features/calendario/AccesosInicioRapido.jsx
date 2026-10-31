import { useReloj } from "../../app/useReloj.js"

const intervalos = [
    { minutos: 1, etiqueta: "En 1 min" },
    { minutos: 5, etiqueta: "En 5 min" },
    { minutos: 15, etiqueta: "En 15 min" },
    { minutos: 30, etiqueta: "En 30 min" },
    { minutos: 60, etiqueta: "En 1 h" }
]

export function AccesosInicioRapido({ onSeleccionar, minimo = null }) {
    const reloj = useReloj()
    function seleccionar(minutos) {
        const propuesto = new Date(reloj.getTime() + minutos * 60_000)
        onSeleccionar(minimo && minimo > propuesto ? new Date(minimo) : propuesto)
    }

    return <div className="accesos-inicio-rapido" role="group" aria-label="Accesos rápidos para la hora de inicio">
        <span>Empezar:</span>
        {intervalos.map(({ minutos, etiqueta }) => <button type="button" key={minutos}
            aria-label={`Inicio en ${minutos === 60 ? "1 hora" : `${minutos} minutos`}`}
            onClick={() => seleccionar(minutos)}>{etiqueta}</button>)}
    </div>
}

