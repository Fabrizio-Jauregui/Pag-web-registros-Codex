import { useMemo, useState } from "react"

import { ordenarRegistrosPorInicio, obtenerResumenRegistro } from "../../domain/tiempo/historial.js"
import { FormularioRegistro } from "../calendario/FormularioRegistro.jsx"
import { FilaHistorial } from "./FilaHistorial.jsx"
import "./HistorialRegistros.css"

function fechaLocalISO(instante) {
    return `${instante.getFullYear()}-${String(instante.getMonth() + 1).padStart(2, "0")}-${String(instante.getDate()).padStart(2, "0")}`
}

export function HistorialRegistros({
    registros,
    ahora = new Date(),
    tareas = [],
    eventos = [],
    datosDisponibles = true,
    errorCarga = "",
    onEditar = () => ({ ok: false }),
    onEliminar = () => ({ ok: false })
}) {
    const [buscarNombre, cambiarBuscarNombre] = useState("")
    const [fecha, cambiarFecha] = useState("")
    const [duracionMinima, cambiarDuracionMinima] = useState("")
    const [duracionMaxima, cambiarDuracionMaxima] = useState("")
    const [registroEditando, cambiarRegistroEditando] = useState(null)
    const [error, cambiarError] = useState("")
    const registrosOrdenados = useMemo(() => ordenarRegistrosPorInicio(registros).filter(registro => {
        const inicio = registro.segmentos[0].inicio
        if (buscarNombre.trim() && !registro.nombre.toLocaleLowerCase().includes(buscarNombre.trim().toLocaleLowerCase())) return false
        if (fecha && fechaLocalISO(inicio) !== fecha) return false
        const minutos = obtenerResumenRegistro(registro, ahora).efectivo / 60
        if (duracionMinima !== "" && minutos < Number(duracionMinima)) return false
        if (duracionMaxima !== "" && minutos > Number(duracionMaxima)) return false
        return true
    }), [registros, buscarNombre, fecha, duracionMinima, duracionMaxima, ahora])

    function eliminar(registro) {
        if (!window.confirm(`¿Querés eliminar el registro "${registro.nombre}"? Esta acción no se puede deshacer.`)) return
        const resultado = onEliminar(registro.id)
        if (!resultado?.ok) {
            cambiarError(resultado?.error ?? "No se pudo eliminar el registro.")
            return
        }
        cambiarError("")
    }

    return (
        <section className="historial-registros" aria-labelledby="titulo-historial">
            <header className="historial-registros-header">
                <div>
                    <h2 id="titulo-historial">Historial</h2>
                    <p>Todos los registros de tiempo, incluidos los creados durante sesiones Focus.</p>
                </div>
            </header>
            {!datosDisponibles && <p role="alert">{errorCarga || "No se pudo cargar el historial."}</p>}
            {error && <p role="alert">{error}</p>}
            {datosDisponibles && <div className="historial-filtros" aria-label="Filtros del historial">
                <label><span>Buscar por nombre</span><input type="search" value={buscarNombre} onChange={evento => cambiarBuscarNombre(evento.target.value)} /></label>
                <label><span>Día</span><input type="date" value={fecha} onChange={evento => cambiarFecha(evento.target.value)} /></label>
                <label><span>Duración mínima (min)</span><input type="number" min="0" value={duracionMinima} onChange={evento => cambiarDuracionMinima(evento.target.value)} /></label>
                <label><span>Duración máxima (min)</span><input type="number" min="0" value={duracionMaxima} onChange={evento => cambiarDuracionMaxima(evento.target.value)} /></label>
            </div>}
            {datosDisponibles && <p className="historial-cantidad">Registros: {registrosOrdenados.length} de {registros.length}</p>}
            {datosDisponibles && registrosOrdenados.length === 0 ? (
                <p className="historial-vacio">{registros.length === 0 ? "Todavía no hay registros guardados." : "No hay registros que coincidan con estos filtros."}</p>
            ) : datosDisponibles && (
                <ol className="lista-historial">
                    {registrosOrdenados.map(registro => (
                        <FilaHistorial key={registro.id} registro={registro} ahora={ahora} tareas={tareas} onEditar={cambiarRegistroEditando} onEliminar={eliminar} />
                    ))}
                </ol>
            )}
            {registroEditando && <div className="historial-editor" role="dialog" aria-modal="true" aria-labelledby="titulo-formulario-registro">
                <FormularioRegistro
                    key={registroEditando.id}
                    registro={registroEditando}
                    fechaSeleccionada={registroEditando.segmentos[0].inicio}
                    eventos={eventos}
                    tareas={tareas}
                    onCrear={() => ({ ok: false })}
                    onEditar={onEditar}
                    onCancelar={() => cambiarRegistroEditando(null)}
                />
            </div>}
        </section>
    )
}
