import { useState } from "react"
import { formatearFechaISO, leerFechaISO, obtenerFechaLocalHoy } from "../../domain/tiempo/FechaCalendario.js"
import { previsualizarPlantillaPlanificacion } from "../../domain/planificacion/plantillasPlanificacion.js"
import { EditorPlantillaCalendario } from "./EditorPlantillaCalendario.jsx"
import "./BibliotecaPlantillasPlanificacion.css"

const hora = segundos => `${String(Math.floor(segundos / 3600)).padStart(2, "0")}:${String(Math.floor(segundos % 3600 / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`
const segundos = valor => {
    const [h, m, s = "0"] = valor.split(":")
    return Number(h) * 3600 + Number(m) * 60 + Number(s)
}
const leerDuracion = valor => {
    if (typeof valor !== "string" || !/^\d{2}:\d{2}:\d{2}$/.test(valor)) return null
    const [h, m, s] = valor.split(":").map(Number)
    if (m > 59 || s > 59 || h > 24 || (h === 24 && (m !== 0 || s !== 0))) return null
    return h * 3600 + m * 60 + s
}
const horaInicial = () => {
    const ahora = new Date()
    ahora.setMinutes(ahora.getMinutes() + 1, 0, 0)
    return ahora.getHours() * 3600 + ahora.getMinutes() * 60
}
const campoHora = valor => `${String(Math.floor(valor / 3600)).padStart(2, "0")}:${String(Math.floor(valor % 3600 / 60)).padStart(2, "0")}:${String(valor % 60).padStart(2, "0")}`
const formatearFechaPreview = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" })
const formatearHoraPreview = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })

function rangoFechaHora(inicio, fin) {
    const horaInicio = formatearHoraPreview.format(inicio)
    const horaFin = formatearHoraPreview.format(fin)
    const mismaFecha = inicio.getFullYear() === fin.getFullYear()
        && inicio.getMonth() === fin.getMonth()
        && inicio.getDate() === fin.getDate()
    return mismaFecha
        ? `${formatearFechaPreview.format(inicio)} · ${horaInicio}–${horaFin}`
        : `${formatearFechaPreview.format(inicio)} · ${horaInicio}–${formatearFechaPreview.format(fin)} · ${horaFin}`
}
const nuevaActividad = (inicioSegundos = 0) => ({ id: crypto.randomUUID(), nombre: "", eventoId: null, inicioSegundos, finSegundos: inicioSegundos + 1800, finDia: 0, duracionSegundos: 1800, duracionTexto: "00:30:00" })

export function BibliotecaPlantillasPlanificacion({ plantillas, eventos, errorCarga = "", onCrear, onActualizar, onEliminar, onAplicar }) {
    const [editando, cambiarEditando] = useState(null)
    const [nombre, cambiarNombre] = useState("")
    const [modo, cambiarModo] = useState("horarios")
    const [actividades, cambiarActividades] = useState([])
    const [fecha, cambiarFecha] = useState(formatearFechaISO(obtenerFechaLocalHoy()))
    const [horasInicio, cambiarHorasInicio] = useState({})
    const [horaInicioPredeterminada] = useState(horaInicial)
    const [error, cambiarError] = useState("")
    const [editorDiseno, cambiarEditorDiseno] = useState(undefined)

    function abrirEditor(plantilla = null) {
        cambiarEditando(null)
        cambiarError("")
        cambiarEditorDiseno(plantilla)
    }

    function guardarDesdeEditor(cambios) {
        return cambios.id ? onActualizar(cambios.id, cambios) : onCrear(cambios)
    }

    function nueva() {
        cambiarEditando("nueva")
        cambiarNombre("")
        cambiarModo("horarios")
        cambiarActividades([nuevaActividad(), nuevaActividad(1800)])
        cambiarError("")
    }
    function editar(plantilla) {
        cambiarEditando(plantilla.id)
        cambiarNombre(plantilla.nombre)
        cambiarModo(plantilla.modo ?? "horarios")
        cambiarActividades(plantilla.actividades.map(item => ({ ...item, duracionTexto: hora(item.duracionSegundos ?? 1800) })))
        cambiarError("")
    }
    function actualizarActividad(id, cambios) {
        cambiarActividades(actuales => actuales.map(item => item.id === id ? { ...item, ...cambios } : item))
    }
    function guardar(evento) {
        evento.preventDefault()
        const datos = { nombre, modo, actividades: actividades.map(item => {
            const { duracionTexto, ...actividad } = item
            return { ...actividad, ...(modo === "duraciones" ? { duracionSegundos: leerDuracion(duracionTexto) ?? 0 } : {}), nombre: item.nombre.trim() }
        }) }
        const resultado = editando === "nueva" ? onCrear(datos) : onActualizar(editando, datos)
        if (!resultado.ok) { cambiarError(resultado.error); return }
        cambiarEditando(null)
        cambiarError("")
    }
    function aplicar(plantilla, horaInicioSegundos) {
        const dia = leerFechaISO(fecha)
        if (!dia) { cambiarError("Elegí una fecha válida para aplicar la plantilla."); return }
        let resultado = onAplicar(plantilla.id, dia, false, horaInicioSegundos)
        if (resultado.duplicado && window.confirm(`Ya aplicaste "${plantilla.nombre}" en esa fecha. ¿Querés agregar otra copia?`)) {
            resultado = onAplicar(plantilla.id, dia, true, horaInicioSegundos)
        }
        if (!resultado.ok && !resultado.duplicado) cambiarError(resultado.error)
        else cambiarError("")
    }
    function eliminar(plantilla) {
        if (!window.confirm(`¿Eliminar la plantilla "${plantilla.nombre}"? Los planes ya creados en el calendario se conservarán.`)) return
        const resultado = onEliminar(plantilla.id)
        cambiarError(resultado.ok ? "" : resultado.error)
    }

    return <section className="biblioteca-plantillas-plan" aria-labelledby="titulo-plantillas-plan">
        <header className="biblioteca-plantillas-plan-header">
            <div><h2 id="titulo-plantillas-plan">Plantillas de planificación</h2><p>Guardá actividades con horarios fijos o diseñá una secuencia visual con duraciones y solapamientos. La hora real se elige al aplicar la plantilla.</p></div>
            {!editando && editorDiseno === undefined && <div className="acciones-crear-plantilla"><button type="button" className="plan-plantilla-primario" onClick={() => abrirEditor(null)} disabled={Boolean(errorCarga)}>Crear plantilla</button><button type="button" onClick={nueva} disabled={Boolean(errorCarga)}>Crear con formulario</button></div>}
        </header>
        {errorCarga && <p role="alert" className="plan-plantilla-error">{errorCarga}</p>}
        {error && !editando && <p role="alert" className="plan-plantilla-error">{error}</p>}
        {editorDiseno !== undefined && <EditorPlantillaCalendario
            key={editorDiseno?.id ?? "nueva-plantilla-secuencias"}
            plantilla={editorDiseno}
            eventos={eventos}
            onGuardar={guardarDesdeEditor}
            onCancelar={() => cambiarEditorDiseno(undefined)}
        />}
        {editando && <form className="formulario-plantilla-plan" onSubmit={guardar} aria-label={editando === "nueva" ? "Nueva plantilla de planificación" : "Editar plantilla de planificación"}>
            <h3>{editando === "nueva" ? "Nueva plantilla" : "Editar plantilla"}</h3>
            <label>Nombre de la plantilla<input aria-label="Nombre de la plantilla" maxLength={80} value={nombre} onChange={e => cambiarNombre(e.target.value)} /></label>
            <label>Cómo se organizan las actividades<select aria-label="Cómo se organizan las actividades" value={modo} onChange={e => cambiarModo(e.target.value)}><option value="horarios">Con horarios definidos</option><option value="duraciones">Una después de otra por duración</option></select></label>
            <h4>{modo === "duraciones" ? "Actividades y duración" : "Actividades y horarios"}</h4>
            <button type="button" onClick={() => {
                const id = editando === "nueva" ? undefined : editando
                const actividadesBorrador = actividades.map(item => ({ ...item, duracionSegundos: leerDuracion(item.duracionTexto ?? hora(item.duracionSegundos ?? 1800)) ?? item.duracionSegundos ?? 1800 }))
                abrirEditor({ id, nombre, modo, actividades: actividadesBorrador })
            }}>Abrir diseñador de secuencias</button>
            {actividades.map((actividad, indice) => <fieldset className="actividad-plantilla-plan" key={actividad.id}>
                <legend>Actividad {indice + 1}</legend>
                <label>Evento (opcional)<select value={actividad.eventoId ?? ""} onChange={e => {
                    const evento = eventos.find(item => item.id === e.target.value)
                    const anterior = eventos.find(item => item.id === actividad.eventoId)
                    actualizarActividad(actividad.id, { eventoId: evento?.id ?? null, ...((evento || anterior) ? { nombre: (evento ?? anterior).nombre } : {}) })
                }}><option value="">Sin evento</option>{eventos.map(evento => <option key={evento.id} value={evento.id}>{evento.nombre}</option>)}</select></label>
                <label>Nombre de la actividad<input aria-label={`Nombre de actividad ${indice + 1}`} maxLength={80} value={eventos.find(item => item.id === actividad.eventoId)?.nombre ?? actividad.nombre} disabled={Boolean(actividad.eventoId)} onChange={e => actualizarActividad(actividad.id, { nombre: e.target.value })} /></label>
                {modo === "duraciones"
                    ? <label>Duración (HH:MM:SS)<input type="text" inputMode="numeric" placeholder="00:30:00" aria-label={`Duración actividad ${indice + 1}`} value={actividad.duracionTexto ?? hora(actividad.duracionSegundos ?? 1800)} onChange={e => {
                        const duracionTexto = e.target.value
                        actualizarActividad(actividad.id, { duracionTexto, duracionSegundos: leerDuracion(duracionTexto) ?? 0 })
                    }} /></label>
                    : <>
                        <label>Inicio<input type="time" step="1" aria-label={`Inicio actividad ${indice + 1}`} value={hora(actividad.inicioSegundos)} onChange={e => actualizarActividad(actividad.id, { inicioSegundos: segundos(e.target.value) })} /></label>
                        <label>Fin<input type="time" step="1" aria-label={`Fin actividad ${indice + 1}`} value={hora(actividad.finSegundos)} onChange={e => actualizarActividad(actividad.id, { finSegundos: segundos(e.target.value) })} /></label>
                        <label className="fin-dia-siguiente"><input type="checkbox" checked={actividad.finDia === 1} onChange={e => actualizarActividad(actividad.id, { finDia: e.target.checked ? 1 : 0 })} /> Termina al día siguiente</label>
                    </>}
                {actividades.length > 2 && <button type="button" onClick={() => cambiarActividades(actuales => actuales.filter(item => item.id !== actividad.id))}>Quitar actividad {indice + 1}</button>}
            </fieldset>)}
            <button type="button" onClick={() => cambiarActividades(actuales => {
                const anterior = actuales.at(-1)
                return [...actuales, nuevaActividad(anterior?.finSegundos ?? 0)]
            })}>Agregar actividad</button>
            {error && <p role="alert" className="plan-plantilla-error">{error}</p>}
            <div className="plan-plantilla-acciones"><button className="plan-plantilla-primario" type="submit">{editando === "nueva" ? "Guardar plantilla" : "Guardar cambios"}</button><button type="button" onClick={() => { cambiarEditando(null); cambiarError("") }}>Cancelar</button></div>
        </form>}
        {!editando && editorDiseno === undefined && <label className="plan-plantilla-fecha">Aplicar a la fecha<input type="date" min={formatearFechaISO(obtenerFechaLocalHoy())} value={fecha} onChange={e => cambiarFecha(e.target.value)} /></label>}
        {!editando && editorDiseno === undefined && (plantillas.length === 0 ? <p className="plan-plantillas-vacio">{errorCarga ? "No se pueden mostrar las plantillas guardadas." : "Todavía no hay plantillas de planificación."}</p> : <ul className="lista-plantillas-plan">{plantillas.map(plantilla => {
            const inicioElegido = horasInicio[plantilla.id] ?? horaInicioPredeterminada
            const previsualizacion = previsualizarPlantillaPlanificacion(plantilla, leerFechaISO(fecha), eventos, {
                ahora: new Date(),
                horaInicioSegundos: inicioElegido
            })
            return <li key={plantilla.id}>
            <div className="plantilla-plan-resumen"><h3>{plantilla.nombre}</h3><ul>{plantilla.actividades.map(item => <li key={item.id}>{eventos.find(evento => evento.id === item.eventoId)?.nombre ?? item.nombre} · {plantilla.modo === "duraciones" ? `${hora(item.duracionSegundos ?? 0)} de duración` : plantilla.modo === "relativo" ? `Inicio +${hora(item.inicioDesplazamientoSegundos)} · ${hora(item.duracionSegundos)} de duración` : `${hora(item.inicioSegundos)}–${hora(item.finSegundos)}${item.finDia ? " (día siguiente)" : ""}`}</li>)}</ul>{plantilla.actividades.length < 2 && <p role="note">Agregá una segunda actividad para poder aplicar esta plantilla.</p>}</div>
            <div className={`plantilla-plan-previsualizacion ${previsualizacion.ok ? "" : "plantilla-plan-previsualizacion-error"}`} aria-live="polite">
                <h4>Vista previa</h4>
                {previsualizacion.ok
                    ? <ol>{previsualizacion.actividades.map((actividad, indice) => <li key={`${actividad.nombre}-${indice}`}><strong>{actividad.nombre}</strong>{actividad.eventoNombre && <small>Evento: {actividad.eventoNombre}</small>}<span>{rangoFechaHora(actividad.inicio, actividad.fin)}</span></li>)}</ol>
                    : <p>No se puede aplicar: {previsualizacion.error}</p>}
            </div>
            <div className="plantilla-plan-acciones">{(plantilla.modo === "duraciones" || plantilla.modo === "relativo" || plantilla.modo === "secuencias") && <label>Hora real de inicio<input type="time" step="1" aria-label={`Hora real de inicio ${plantilla.nombre}`} value={campoHora(inicioElegido)} onChange={e => cambiarHorasInicio(actual => ({ ...actual, [plantilla.id]: e.target.value ? segundos(e.target.value) : 0 }))} /></label>}<button type="button" className="plan-plantilla-primario" onClick={() => aplicar(plantilla, plantilla.modo === "duraciones" || plantilla.modo === "relativo" || plantilla.modo === "secuencias" ? inicioElegido : undefined)} disabled={Boolean(errorCarga) || plantilla.actividades.length < 2 || !previsualizacion.ok}>Aplicar a fecha</button><button type="button" onClick={() => abrirEditor(plantilla)}>Editar</button><button type="button" onClick={() => editar(plantilla)}>Editar con formulario</button><button type="button" onClick={() => eliminar(plantilla)}>Eliminar</button></div>
        </li>
        })}</ul>)}
    </section>
}
