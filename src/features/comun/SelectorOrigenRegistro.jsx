import { useId } from "react"
import { SelectorOrigenActividad } from "./SelectorOrigenActividad.jsx"
import "./SelectorOrigenRegistro.css"

export function SelectorOrigenRegistro({ valor, onChange, eventos = [], tareas = [], categorias = [], ordenEventos, cambiarOrdenEventos, disabled = false, etiquetaNombre = "Nombre de la actividad" }) {
    const id = useId()
    const tipo = valor?.tipo ?? ""
    const categoriaSeleccionada = (valor?.categoriaIds ?? []).filter(categoriaId => categorias.some(item => item.id === categoriaId))
    function cambiarTipo(nuevoTipo) {
        onChange({ ...valor, tipo: nuevoTipo, nombre: nuevoTipo === "evento" ? "" : nuevoTipo === "tarea" ? "" : valor?.nombre ?? "", categoriaIds: nuevoTipo === "puntual" ? valor?.categoriaIds ?? [] : [] })
    }
    return <fieldset className="selector-origen-registro" disabled={disabled}>
        <legend>Origen de la actividad</legend>
        <div className="selector-origen-registro-opciones" role="radiogroup" aria-label="Origen de la actividad">
            {[ ["evento", "Plantilla de evento"], ["tarea", "Tarea"], ["puntual", "Actividad puntual"] ].map(([clave, texto]) => <label key={clave}>
                <input type="radio" name={`origen-${id}`} value={clave} checked={tipo === clave} onChange={() => cambiarTipo(clave)} /> {texto}
            </label>)}
        </div>
        {tipo === "evento" && <SelectorOrigenActividad tipo="evento" etiqueta="Plantilla de evento" opciones={eventos} categorias={categorias} value={valor?.eventoId ?? ""} ordenEventos={ordenEventos} cambiarOrdenEventos={cambiarOrdenEventos} emptyLabel="Elegí una plantilla" onChange={opcion => onChange({ ...valor, tipo, eventoId: opcion?.id ?? "", tareaId: "", nombre: opcion?.nombre ?? "" })} />}
        {tipo === "tarea" && <SelectorOrigenActividad tipo="tarea" etiqueta="Tarea" opciones={tareas} value={valor?.tareaId ?? ""} emptyLabel="Elegí una tarea" onChange={opcion => onChange({ ...valor, tipo, tareaId: opcion?.id ?? "", eventoId: "", nombre: opcion?.nombre ?? "" })} />}
        {tipo === "puntual" && <>
            <label><span>{etiquetaNombre}</span><input type="text" maxLength={80} required value={valor?.nombre ?? ""} placeholder="Ej.: Trámite en el banco" onChange={evento => onChange({ ...valor, tipo, nombre: evento.target.value })} /></label>
            {categorias.length > 0 && <fieldset className="selector-origen-registro-categorias"><legend>Categorías (opcional)</legend>
                {categorias.map(categoria => <label key={categoria.id}><input type="checkbox" checked={categoriaSeleccionada.includes(categoria.id)} onChange={evento => onChange({ ...valor, tipo, categoriaIds: evento.target.checked ? [...new Set([...categoriaSeleccionada, categoria.id])] : categoriaSeleccionada.filter(idCategoria => idCategoria !== categoria.id) })} /> <span className="selector-origen-registro-color" style={{ backgroundColor: categoria.color }} /> {categoria.nombre}</label>)}
            </fieldset>}
        </>}
    </fieldset>
}
