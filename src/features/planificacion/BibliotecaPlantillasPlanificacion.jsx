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
const nuevaActividad = (inicioSegundos = 0, finAbsoluto = inicioSegundos + 1800) => ({ id: crypto.randomUUID(), nombre: "", eventoId: null, inicioSegundos, finSegundos: finAbsoluto % 86400, finDia: Math.floor(finAbsoluto / 86400) })

function agruparActividadesPorHorario(actividades) {
    const ordenadas = actividades.map((actividad, indice) => ({
        actividad,
        indice,
        inicio: actividad.inicioSegundos,
        fin: (actividad.finDia ?? 0) * 86400 + actividad.finSegundos
    })).sort((a, b) => a.inicio - b.inicio || a.indice - b.indice)

    return ordenadas.reduce((grupos, entrada) => {
        const grupo = grupos.at(-1)
        if (grupo && entrada.inicio < grupo.fin) {
            grupo.actividades.push(entrada)
            grupo.fin = Math.max(grupo.fin, entrada.fin)
        } else {
            grupos.push({ inicio: entrada.inicio, fin: entrada.fin, actividades: [entrada] })
        }
        return grupos
    }, [])
}

export function BibliotecaPlantillasPlanificacion({ plantillas, plantillasFocus = [], eventos, errorCarga = "", onCrear, onActualizar, onEliminar, onAplicar }) {
    const [editando, cambiarEditando] = useState(null)
    const [nombre, cambiarNombre] = useState("")
    const [actividades, cambiarActividades] = useState([])
    const [fecha, cambiarFecha] = useState(formatearFechaISO(obtenerFechaLocalHoy()))
    const [horasInicio, cambiarHorasInicio] = useState({})
    const [horaInicioPredeterminada] = useState(horaInicial)
    const [error, cambiarError] = useState("")
    const [editorDiseno, cambiarEditorDiseno] = useState(undefined)
    const [modoEditorInicial, cambiarModoEditorInicial] = useState("secuencias")

    function abrirEditor(plantilla = null, modoInicial = "secuencias") {
        cambiarEditando(null)
        cambiarError("")
        cambiarModoEditorInicial(modoInicial)
        cambiarEditorDiseno(plantilla)
    }

    function guardarDesdeEditor(cambios) {
        return cambios.id ? onActualizar(cambios.id, cambios) : onCrear(cambios)
    }

    function nueva() {
        cambiarEditando("nueva")
        cambiarNombre("")
        cambiarActividades([nuevaActividad(), nuevaActividad(1800)])
        cambiarError("")
    }
    function editar(plantilla) {
        cambiarEditando(plantilla.id)
        cambiarNombre(plantilla.nombre)
        cambiarActividades(plantilla.actividades.map(item => ({ ...item })))
        cambiarError("")
    }
    function actualizarActividad(id, cambios) {
        cambiarActividades(actuales => actuales.map(item => item.id === id ? { ...item, ...cambios } : item))
    }
    function configurarTipoActividad(id, tipo, focusId = "") {
        const plantillaFocus = plantillasFocus.find(item => item.id === focusId)
        if (tipo !== "focus" || !plantillaFocus) {
            actualizarActividad(id, { tipoActividad: undefined, plantillaFocusId: undefined, configuracionFocus: undefined, eventoId: null, nombre: "", finSegundos: 1800, finDia: 0 })
            return
        }
        const configuracionFocus = structuredClone(plantillaFocus.configuracion)
        const inicio = actividades.find(item => item.id === id)?.inicioSegundos ?? 0
        const fin = inicio + configuracionFocus.bloques.reduce((total, bloque) => total + Number(bloque.minutos) * 60, 0)
        actualizarActividad(id, { tipoActividad: "focus", plantillaFocusId: plantillaFocus.id, configuracionFocus, eventoId: null, nombre: configuracionFocus.nombre, finSegundos: fin % 86400, finDia: Math.floor(fin / 86400) })
    }
    function actualizarInicioActividad(id, inicioSegundos) {
        const actividad = actividades.find(item => item.id === id)
        if (actividad?.tipoActividad !== "focus") {
            actualizarActividad(id, { inicioSegundos })
            return
        }
        const duracion = actividad.configuracionFocus.bloques.reduce((total, bloque) => total + bloque.minutos * 60, 0)
        const fin = inicioSegundos + duracion
        actualizarActividad(id, { inicioSegundos, finSegundos: fin % 86400, finDia: Math.floor(fin / 86400) })
    }
    function agregarEnParalelo(referencia) {
        cambiarActividades(actuales => [...actuales, nuevaActividad(
            referencia.inicioSegundos,
            (referencia.finDia ?? 0) * 86400 + referencia.finSegundos
        )])
    }
    function guardar(evento) {
        evento.preventDefault()
        const datos = { nombre, modo: "horarios", actividades: actividades.map(item => ({ ...item, nombre: item.nombre.trim() })) }
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
            <div><h2 id="titulo-plantillas-plan">Plantillas de planificación</h2><p>Elegí cómo querés planificar: con horarios, por duración o registrando el tiempo real con cronómetros.</p></div>
            {plantillasFocus.length === 0 && <p role="note">Para agregar sesiones Focus a una planificación, primero guardá una plantilla de sesión en la sección Focus.</p>}
            {!editando && editorDiseno === undefined && <div className="acciones-crear-plantilla" aria-label="Formas de crear una planificación">
                <button type="button" className="plan-plantilla-modo" onClick={nueva} disabled={Boolean(errorCarga)}><strong>Horarios definidos</strong><span>Indicá inicio y fin de cada actividad.</span></button>
                <button type="button" className="plan-plantilla-modo" onClick={() => abrirEditor(null, "secuencias")} disabled={Boolean(errorCarga)}><strong>Secuencia por duración</strong><span>Ordená actividades y definí cuánto dura cada una.</span></button>
                <button type="button" className="plan-plantilla-modo" onClick={() => abrirEditor(null, "cronometro")} disabled={Boolean(errorCarga)}><strong>Secuencia con cronómetro</strong><span>Registrá el tiempo real al iniciar y finalizar cada actividad.</span></button>
            </div>}
        </header>
        {errorCarga && <p role="alert" className="plan-plantilla-error">{errorCarga}</p>}
        {error && !editando && <p role="alert" className="plan-plantilla-error">{error}</p>}
        {editorDiseno !== undefined && <EditorPlantillaCalendario
            key={editorDiseno?.id ?? `nueva-plantilla-${modoEditorInicial}`}
            plantilla={editorDiseno}
            eventos={eventos}
            plantillasFocus={plantillasFocus}
            modoInicial={modoEditorInicial}
            onGuardar={guardarDesdeEditor}
            onCancelar={() => cambiarEditorDiseno(undefined)}
        />}
        {editando && <form className="formulario-plantilla-plan" onSubmit={guardar} aria-label={editando === "nueva" ? "Nueva plantilla de planificación" : "Editar plantilla de planificación"}>
            <h3>{editando === "nueva" ? "Nueva plantilla" : "Editar plantilla"}</h3>
            <label>Nombre de la plantilla<input aria-label="Nombre de la plantilla" maxLength={80} value={nombre} onChange={e => cambiarNombre(e.target.value)} /></label>
            <h4>Actividades y horarios definidos</h4>
            {agruparActividadesPorHorario(actividades).map(grupo => <div
                className={`actividad-plantilla-fila${grupo.actividades.length > 1 ? " paralelas" : ""}`}
                key={grupo.actividades.map(({ actividad }) => actividad.id).join("-")}
                style={grupo.actividades.length > 1 ? { gridTemplateColumns: `repeat(${grupo.actividades.length}, minmax(260px, 1fr))` } : undefined}
            >
                {grupo.actividades.length > 1 && <p className="actividad-plantilla-paralelo">Horarios superpuestos · {hora(grupo.inicio)}–{hora(grupo.fin % 86400)}{grupo.fin >= 86400 ? " (día siguiente)" : ""}</p>}
                {grupo.actividades.map(({ actividad, indice }) => <fieldset className="actividad-plantilla-plan" key={actividad.id}>
                <legend>Actividad {indice + 1}</legend>
                <label>Tipo<select aria-label={`Tipo de actividad ${indice + 1}`} value={actividad.tipoActividad === "focus" ? "focus" : "normal"} onChange={e => configurarTipoActividad(actividad.id, e.target.value, plantillasFocus[0]?.id)}><option value="normal">Actividad</option><option value="focus" disabled={!plantillasFocus.length}>Sesión Focus</option></select></label>
                {actividad.tipoActividad === "focus" && <label>Plantilla Focus<select aria-label={`Plantilla Focus ${indice + 1}`} value={actividad.plantillaFocusId ?? ""} onChange={e => configurarTipoActividad(actividad.id, "focus", e.target.value)}><option value="">Elegí una plantilla</option>{plantillasFocus.map(item => <option key={item.id} value={item.id}>{item.nombrePlantilla} · {item.configuracion.nombre}</option>)}</select></label>}
                {actividad.tipoActividad !== "focus" && <>
                <label>Evento (opcional)<select value={actividad.eventoId ?? ""} onChange={e => {
                    const evento = eventos.find(item => item.id === e.target.value)
                    const anterior = eventos.find(item => item.id === actividad.eventoId)
                    actualizarActividad(actividad.id, { eventoId: evento?.id ?? null, ...((evento || anterior) ? { nombre: (evento ?? anterior).nombre } : {}) })
                }}><option value="">Sin evento</option>{eventos.map(evento => <option key={evento.id} value={evento.id}>{evento.nombre}</option>)}</select></label>
                <label>Nombre de la actividad<input aria-label={`Nombre de actividad ${indice + 1}`} maxLength={80} value={eventos.find(item => item.id === actividad.eventoId)?.nombre ?? actividad.nombre} disabled={Boolean(actividad.eventoId)} onChange={e => actualizarActividad(actividad.id, { nombre: e.target.value })} /></label>
                <label>Inicio<input type="time" step="1" aria-label={`Inicio actividad ${indice + 1}`} value={hora(actividad.inicioSegundos)} onChange={e => actualizarInicioActividad(actividad.id, segundos(e.target.value))} /></label>
                <label>Fin<input type="time" step="1" aria-label={`Fin actividad ${indice + 1}`} value={hora(actividad.finSegundos)} onChange={e => actualizarActividad(actividad.id, { finSegundos: segundos(e.target.value) })} /></label>
                <label className="fin-dia-siguiente"><input type="checkbox" checked={actividad.finDia === 1} onChange={e => actualizarActividad(actividad.id, { finDia: e.target.checked ? 1 : 0 })} /> Termina al día siguiente</label>
                </>}
                {actividad.tipoActividad === "focus" && <p>Duración reservada: {hora((actividad.finDia * 86400 + actividad.finSegundos) - actividad.inicioSegundos)} · no se puede solapar con otras actividades durante la concentración.</p>}
                <div className="actividad-plantilla-acciones"><button type="button" onClick={() => agregarEnParalelo(actividad)}>Agregar en paralelo</button>{actividades.length > 2 && <button type="button" onClick={() => cambiarActividades(actuales => actuales.filter(item => item.id !== actividad.id))}>Quitar actividad {indice + 1}</button>}</div>
            </fieldset>)}
            </div>)}
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
            <div className="plantilla-plan-resumen"><h3>{plantilla.nombre}</h3><ul>{plantilla.actividades.map(item => <li key={item.id}>{item.tipoActividad === "focus" ? `Focus: ${item.configuracionFocus?.nombre ?? item.nombre} · ${hora((item.configuracionFocus?.bloques ?? []).reduce((total, bloque) => total + bloque.minutos * 60, 0))}` : eventos.find(evento => evento.id === item.eventoId)?.nombre ?? item.nombre} · {plantilla.modo === "cronometro" ? `Etapa ${(item.grupoCronometro ?? 0) + 1} · ${item.tipoActividad === "focus" ? "duración Focus prevista" : "sin duración prevista"}` : plantilla.modo === "duraciones" ? `${hora(item.duracionSegundos ?? 0)} de duración` : plantilla.modo === "relativo" ? `Inicio +${hora(item.inicioDesplazamientoSegundos)} · ${hora(item.duracionSegundos)} de duración` : plantilla.modo === "secuencias" ? `Inicio +${hora(item.inicioDesplazamientoSegundos)} · ${hora(item.duracionSegundos)} de duración` : `${hora(item.inicioSegundos)}–${hora(item.finSegundos)}${item.finDia ? " (día siguiente)" : ""}`}</li>)}</ul>{plantilla.actividades.length < 2 && <p role="note">Agregá una segunda actividad para poder aplicar esta plantilla.</p>}</div>
            <div className={`plantilla-plan-previsualizacion ${previsualizacion.ok ? "" : "plantilla-plan-previsualizacion-error"}`} aria-live="polite">
                <h4>Vista previa</h4>
                {previsualizacion.ok
                    ? <ol>{previsualizacion.actividades.map((actividad, indice) => <li key={`${actividad.nombre}-${indice}`}><strong>{actividad.nombre}</strong>{actividad.eventoNombre && <small>Evento: {actividad.eventoNombre}</small>}<span>{actividad.sinHorario ? `Etapa ${(actividad.etapa ?? 0) + 1} · duración ${hora(actividad.duracionFocusSegundos)} · se inicia manualmente` : actividad.sinDuracion ? "Sin horario ni duración · se registra con cronómetro" : rangoFechaHora(actividad.inicio, actividad.fin)}</span></li>)}</ol>
                    : <p>No se puede aplicar: {previsualizacion.error}</p>}
            </div>
            <div className="plantilla-plan-acciones">{(plantilla.modo === "duraciones" || plantilla.modo === "relativo" || plantilla.modo === "secuencias" || plantilla.modo === "cronometro") && <label>Hora de inicio en el calendario<input type="time" step="1" aria-label={`Hora real de inicio ${plantilla.nombre}`} value={campoHora(inicioElegido)} onChange={e => cambiarHorasInicio(actual => ({ ...actual, [plantilla.id]: e.target.value ? segundos(e.target.value) : 0 }))} /></label>}<button type="button" className="plan-plantilla-primario" onClick={() => aplicar(plantilla, plantilla.modo === "duraciones" || plantilla.modo === "relativo" || plantilla.modo === "secuencias" || plantilla.modo === "cronometro" ? inicioElegido : undefined)} disabled={Boolean(errorCarga) || plantilla.actividades.length < 2 || !previsualizacion.ok}>Aplicar a fecha</button>{plantilla.modo === "horarios" ? <button type="button" onClick={() => editar(plantilla)}>Editar horarios</button> : <button type="button" onClick={() => abrirEditor(plantilla)}>Editar secuencia</button>}<button type="button" onClick={() => eliminar(plantilla)}>Eliminar</button></div>
        </li>
        })}</ul>)}
    </section>
}
