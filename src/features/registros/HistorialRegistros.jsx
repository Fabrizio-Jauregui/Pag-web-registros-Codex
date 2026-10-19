import { ordenarRegistrosPorInicio } from "../../domain/tiempo/historial.js"
import { FilaHistorial } from "./FilaHistorial.jsx"
import "./HistorialRegistros.css"

export function HistorialRegistros({ registros, ahora = new Date(), tareas = [] }) {
    const registrosOrdenados = ordenarRegistrosPorInicio(registros)

    return (
        <section className="historial-registros" aria-labelledby="titulo-historial">
            <header className="historial-registros-header">
                <div>
                    <h3 id="titulo-historial">Historial</h3>
                    <p>Registros guardados: {registros.length}</p>
                </div>
            </header>
            {registrosOrdenados.length === 0 ? (
                <p className="historial-vacio">Todavía no hay registros guardados.</p>
            ) : (
                <ol className="lista-historial">
                    {registrosOrdenados.map(registro => (
                        <FilaHistorial key={registro.id} registro={registro} ahora={ahora} tareas={tareas} />
                    ))}
                </ol>
            )}
        </section>
    )
}
