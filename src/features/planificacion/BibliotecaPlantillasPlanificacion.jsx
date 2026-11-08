import { useState } from "react"
import { formatearFechaISO, leerFechaISO, obtenerFechaLocalHoy } from "../../domain/tiempo/FechaCalendario.js"
import { ordenarActividadesPlantilla, previsualizarPlantillaPlanificacion } from "../../domain/planificacion/plantillasPlanificacion.js"
import { plantillaUsadaEnFecha } from "../../domain/planificacion/persistenciaUsosPlantillas.js"
import { eliminarRecurrenciasDePlantilla } from "../../domain/planificacion/recurrencias.js"
import { EditorPlantillaCalendario } from "./EditorPlantillaCalendario.jsx"
import { SelectorOrigenActividad } from "../comun/SelectorOrigenActividad.jsx"
import { AccesosInicioRapido } from "../calendario/AccesosInicioRapido.jsx"
import "./BibliotecaPlantillasPlanificacion.css"

const hora = segundos => `${String(Math.floor(segundos / 3600)).padStart(2, "0")}:${String(Math.floor(segundos % 3600 / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`
const segundos = valor => {
    const [h, m, s = "0"] = valor.split(":")
    return Number(h) * 3600 + Number(m) * 60 + Number(s)
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

function fechasInicialesRecurrencia(fechaInicioTexto, diasSemana, fechaFinTexto) {
    const inicio = leerFechaISO(fechaInicioTexto)
    const fin = fechaFinTexto ? leerFechaISO(fechaFinTexto) : null
    if (!inicio || !diasSemana.length || (fechaFinTexto && !fin)) return []
    const fechas = []
    const cursor = new Date(inicio)
    for (let indice = 0; indice < 370 && fechas.length < 3 && (!fin || cursor <= fin); indice += 1) {
        if (diasSemana.includes(cursor.getDay())) fechas.push(formatearFechaISO(cursor))
        cursor.setDate(cursor.getDate() + 1)
    }
    return fechas
}
const nuevaActividad = (inicioSegundos = 0, finAbsoluto = inicioSegundos + 1800) => ({ id: crypto.randomUUID(), nombre: "", eventoId: null, tareaId: null, inicioSegundos, finSegundos: finAbsoluto % 86400, finDia: Math.floor(finAbsoluto / 86400) })

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

export function BibliotecaPlantillasPlanificacion({ plantillas, plantillasFocus = [], eventos, tareas = [], categorias = [], ordenEventos = "ultimo-uso", cambiarOrdenEventos = () => {}, usosPlantillas = [], errorCarga = "", errorUsos = "", planes = [], recurrencias = [], planesEnSeguimiento = [], idsPlanesSeguimiento = [], errorDependencias = "", onCrear, onActualizar, onEliminar, onAplicar, onCrearRecurrencia = () => ({ ok: false, error: "No se pudo crear la recurrencia." }) }) {
    const [editando, cambiarEditando] = useState(null)
    const [nombre, cambiarNombre] = useState("")
    const [actividades, cambiarActividades] = useState([])
    const [inicioAplicacionPredeterminado] = useState(() => new Date(Date.now() + 60_000))
    const [fecha, cambiarFecha] = useState(() => formatearFechaISO(inicioAplicacionPredeterminado))
    const [horasInicio, cambiarHorasInicio] = useState({})
    const [horaInicioPredeterminada] = useState(() => inicioAplicacionPredeterminado.getHours() * 3600 + inicioAplicacionPredeterminado.getMinutes() * 60 + inicioAplicacionPredeterminado.getSeconds())
    const [error, cambiarError] = useState("")
    const [editorDiseno, cambiarEditorDiseno] = useState(undefined)
    const [modoEditorInicial, cambiarModoEditorInicial] = useState("secuencias")
    const [confirmacionBorrado, cambiarConfirmacionBorrado] = useState(null)
    const [alcanceBorrado, cambiarAlcanceBorrado] = useState("conservar")
    const [recurrenciasLegadoSeleccionadas, cambiarRecurrenciasLegadoSeleccionadas] = useState([])
    const [recurrenciaAbiertaId, cambiarRecurrenciaAbiertaId] = useState(null)
    const [diasRecurrencia, cambiarDiasRecurrencia] = useState([])
    const [fechaFinRecurrencia, cambiarFechaFinRecurrencia] = useState("")
    const [errorRecurrencia, cambiarErrorRecurrencia] = useState("")

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
            actualizarActividad(id, { tipoActividad: undefined, plantillaFocusId: undefined, configuracionFocus: undefined, eventoId: null, tareaId: null, nombre: "", finSegundos: 1800, finDia: 0 })
            return
        }
        const configuracionFocus = structuredClone(plantillaFocus.configuracion)
        const inicio = actividades.find(item => item.id === id)?.inicioSegundos ?? 0
        const fin = inicio + configuracionFocus.bloques.reduce((total, bloque) => total + Number(bloque.minutos) * 60, 0)
        actualizarActividad(id, { tipoActividad: "focus", plantillaFocusId: plantillaFocus.id, configuracionFocus, eventoId: null, tareaId: null, nombre: configuracionFocus.nombre, finSegundos: fin % 86400, finDia: Math.floor(fin / 86400) })
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
        const datos = { nombre, modo: "horarios", actividades: actividades.map(item => ({ ...item,
            nombre: eventos.find(evento => evento.id === item.eventoId)?.nombre ?? tareas.find(tarea => tarea.id === item.tareaId)?.nombre ?? item.nombre.trim(),
            ...(item.tareaId ? { tareaNombre: tareas.find(tarea => tarea.id === item.tareaId)?.nombre ?? item.tareaNombre } : {})
        })) }
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
    function abrirRecurrencia(plantilla) {
        const diaInicio = leerFechaISO(fecha)?.getDay()
        cambiarRecurrenciaAbiertaId(plantilla.id)
        cambiarDiasRecurrencia(Number.isInteger(diaInicio) ? [diaInicio] : [])
        cambiarFechaFinRecurrencia("")
        cambiarErrorRecurrencia("")
    }
    function guardarRecurrencia(evento, plantilla, horaInicioSegundos) {
        evento.preventDefault()
        if (!diasRecurrencia.length) { cambiarErrorRecurrencia("Elegí al menos un día de la semana."); return }
        if (fechaFinRecurrencia && fechaFinRecurrencia < fecha) { cambiarErrorRecurrencia("La fecha final debe ser igual o posterior al inicio."); return }
        if (!fechasInicialesRecurrencia(fecha, diasRecurrencia, fechaFinRecurrencia).length) { cambiarErrorRecurrencia("No hay apariciones dentro del período elegido."); return }
        const resultado = onCrearRecurrencia(plantilla.id, fecha, diasRecurrencia, fechaFinRecurrencia || null, horaInicioSegundos)
        if (!resultado.ok) { cambiarErrorRecurrencia(resultado.error); return }
        cambiarRecurrenciaAbiertaId(null)
        cambiarErrorRecurrencia("")
        cambiarError("")
    }
    function seleccionarInicioRapido(plantillaId, instante) {
        cambiarFecha(formatearFechaISO(instante))
        cambiarHorasInicio(actual => ({ ...actual, [plantillaId]: instante.getHours() * 3600 + instante.getMinutes() * 60 + instante.getSeconds() }))
    }
    function abrirConfirmacionBorrado(plantilla) {
        cambiarError("")
        cambiarAlcanceBorrado("conservar")
        cambiarRecurrenciasLegadoSeleccionadas([])
        cambiarConfirmacionBorrado(plantilla)
    }
    function confirmarBorrado() {
        if (!confirmacionBorrado) return
        const resultado = onEliminar(confirmacionBorrado.id, {
            alcance: alcanceBorrado,
            idsRecurrenciasLegado: recurrenciasLegadoSeleccionadas,
            ahora: new Date()
        })
        if (!resultado.ok) { cambiarError(resultado.error); return }
        cambiarConfirmacionBorrado(null)
        cambiarError("")
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
        {errorUsos && <p role="alert" className="plan-plantilla-error">{errorUsos} No se podrá iniciar el seguimiento de plantillas hasta resolverlo.</p>}
        {error && !editando && <p role="alert" className="plan-plantilla-error">{error}</p>}
        {editorDiseno !== undefined && <EditorPlantillaCalendario
            key={editorDiseno?.id ?? `nueva-plantilla-${modoEditorInicial}`}
            plantilla={editorDiseno}
            eventos={eventos}
            tareas={tareas}
            plantillasFocus={plantillasFocus}
            categorias={categorias}
            ordenEventos={ordenEventos}
            cambiarOrdenEventos={cambiarOrdenEventos}
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
                <SelectorOrigenActividad tipo="evento" etiqueta="Evento" opciones={eventos} categorias={categorias} value={actividad.eventoId ?? ""} missingName={actividad.nombre} disabled={Boolean(actividad.tareaId)} ordenEventos={ordenEventos} cambiarOrdenEventos={cambiarOrdenEventos} onChange={evento => actualizarActividad(actividad.id, { eventoId: evento?.id ?? null, tareaId: evento ? null : actividad.tareaId, nombre: evento?.nombre ?? "" })} />
                <SelectorOrigenActividad tipo="tarea" etiqueta="Tarea" opciones={tareas} value={actividad.tareaId ?? ""} missingName={actividad.tareaNombre ?? actividad.nombre} disabled={Boolean(actividad.eventoId)} onChange={tarea => actualizarActividad(actividad.id, { tareaId: tarea?.id ?? null, tareaNombre: tarea?.nombre, eventoId: tarea ? null : actividad.eventoId, nombre: tarea?.nombre ?? "" })} />
                <label>Nombre de la actividad<input aria-label={`Nombre de actividad ${indice + 1}`} value={eventos.find(item => item.id === actividad.eventoId)?.nombre ?? tareas.find(item => item.id === actividad.tareaId)?.nombre ?? ""} placeholder="Se completa al elegir el origen" disabled readOnly /></label>
                <label>Inicio<input type="time" step="1" aria-label={`Inicio actividad ${indice + 1}`} value={hora(actividad.inicioSegundos)} onChange={e => actualizarInicioActividad(actividad.id, segundos(e.target.value))} /></label>
                <label>Fin<input type="time" step="1" aria-label={`Fin actividad ${indice + 1}`} value={hora(actividad.finSegundos)} onChange={e => actualizarActividad(actividad.id, { finSegundos: segundos(e.target.value) })} /></label>
                <label className="fin-dia-siguiente"><input type="checkbox" checked={actividad.finDia === 1} onChange={e => actualizarActividad(actividad.id, { finDia: e.target.checked ? 1 : 0 })} /> Termina al día siguiente</label>
                </>}
                {actividad.tipoActividad === "focus" && <>
                    {!actividad.configuracionFocus?.usarColaFocus && <>
                        <SelectorOrigenActividad tipo="evento" etiqueta="Evento" opciones={eventos} categorias={categorias} value={actividad.eventoId ?? ""} missingName={actividad.nombre} disabled={Boolean(actividad.tareaId)} ordenEventos={ordenEventos} cambiarOrdenEventos={cambiarOrdenEventos} onChange={evento => actualizarActividad(actividad.id, { eventoId: evento?.id ?? null, tareaId: evento ? null : actividad.tareaId })} />
                        <SelectorOrigenActividad tipo="tarea" etiqueta="Tarea" opciones={tareas} value={actividad.tareaId ?? ""} missingName={actividad.tareaNombre ?? actividad.nombre} disabled={Boolean(actividad.eventoId)} onChange={tarea => actualizarActividad(actividad.id, { tareaId: tarea?.id ?? null, tareaNombre: tarea?.nombre, eventoId: tarea ? null : actividad.eventoId })} />
                    </>}
                    <p>Duración reservada: {hora((actividad.finDia * 86400 + actividad.finSegundos) - actividad.inicioSegundos)} · no se puede solapar con otras actividades durante la concentración.</p>
                </>}
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
            const uso = plantillaUsadaEnFecha(usosPlantillas, plantilla.id, fecha)
            const previsualizacion = previsualizarPlantillaPlanificacion(plantilla, leerFechaISO(fecha), eventos, {
                ahora: new Date(),
                horaInicioSegundos: inicioElegido,
                tareas
            })
            return <li key={plantilla.id}>
            <div className="plantilla-plan-resumen"><h3>{plantilla.nombre}</h3>{uso && <p className="plantilla-plan-uso" role="status">Usada el {new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(leerFechaISO(fecha))}. Ya no se puede iniciar otra aplicación de esta plantilla ese día.</p>}<ul>{ordenarActividadesPlantilla(plantilla).map(item => <li key={item.id}>{item.tipoActividad === "focus" ? `Focus: ${item.configuracionFocus?.nombre ?? item.nombre} · ${hora((item.configuracionFocus?.bloques ?? []).reduce((total, bloque) => total + bloque.minutos * 60, 0))}` : eventos.find(evento => evento.id === item.eventoId)?.nombre ?? tareas.find(tarea => tarea.id === item.tareaId)?.nombre ?? item.nombre} · {plantilla.modo === "cronometro" ? `Etapa ${(item.grupoCronometro ?? 0) + 1} · ${item.tipoActividad === "focus" ? "duración Focus prevista" : "sin duración prevista"}` : plantilla.modo === "duraciones" ? `${hora(item.duracionSegundos ?? 0)} de duración` : plantilla.modo === "relativo" ? `Inicio +${hora(item.inicioDesplazamientoSegundos)} · ${hora(item.duracionSegundos)} de duración` : plantilla.modo === "secuencias" ? `Inicio +${hora(item.inicioDesplazamientoSegundos)} · ${hora(item.duracionSegundos)} de duración` : `${hora(item.inicioSegundos)}–${hora(item.finSegundos)}${item.finDia ? " (día siguiente)" : ""}`}</li>)}</ul>{plantilla.actividades.length < 2 && <p role="note">Agregá una segunda actividad para poder aplicar esta plantilla.</p>}</div>
            <div className={`plantilla-plan-previsualizacion ${previsualizacion.ok ? "" : "plantilla-plan-previsualizacion-error"}`} aria-live="polite">
                <h4>Vista previa</h4>
                {previsualizacion.ok
                    ? <ol>{previsualizacion.actividades.map((actividad, indice) => <li key={`${actividad.nombre}-${indice}`}><strong>{actividad.nombre}</strong>{actividad.eventoNombre && <small>Evento: {actividad.eventoNombre}</small>}{actividad.tareaNombre && <small>Tarea: {actividad.tareaNombre}</small>}<span>{actividad.sinHorario ? `Etapa ${(actividad.etapa ?? 0) + 1} · duración ${hora(actividad.duracionFocusSegundos)} · se inicia manualmente` : actividad.sinDuracion ? "Sin horario ni duración · se registra con cronómetro" : rangoFechaHora(actividad.inicio, actividad.fin)}</span></li>)}</ol>
                    : <p>No se puede aplicar: {previsualizacion.error}</p>}
            </div>
            <div className="plantilla-plan-acciones">
                {(plantilla.modo === "duraciones" || plantilla.modo === "relativo" || plantilla.modo === "secuencias" || plantilla.modo === "cronometro") && <>
                    <label>Hora de inicio en el calendario<input type="time" step="1" aria-label={`Hora real de inicio ${plantilla.nombre}`} value={campoHora(inicioElegido)} onChange={e => cambiarHorasInicio(actual => ({ ...actual, [plantilla.id]: e.target.value ? segundos(e.target.value) : 0 }))} /></label>
                    <AccesosInicioRapido onSeleccionar={instante => seleccionarInicioRapido(plantilla.id, instante)} />
                </>}
                <button type="button" className="plan-plantilla-primario" onClick={() => aplicar(plantilla, plantilla.modo === "duraciones" || plantilla.modo === "relativo" || plantilla.modo === "secuencias" || plantilla.modo === "cronometro" ? inicioElegido : undefined)} disabled={Boolean(errorCarga) || Boolean(uso) || plantilla.actividades.length < 2 || !previsualizacion.ok}>{uso ? "Usada este día" : "Aplicar a fecha"}</button>
                <button type="button" onClick={() => recurrenciaAbiertaId === plantilla.id ? cambiarRecurrenciaAbiertaId(null) : abrirRecurrencia(plantilla)} disabled={Boolean(errorCarga) || plantilla.actividades.length < 2 || !previsualizacion.ok}>Crear recurrencia</button>
                {plantilla.modo === "horarios" ? <button type="button" onClick={() => editar(plantilla)}>Editar horarios</button> : <button type="button" onClick={() => abrirEditor(plantilla)}>Editar secuencia</button>}
                <button type="button" onClick={() => abrirConfirmacionBorrado(plantilla)}>Eliminar</button>
            </div>
            {recurrenciaAbiertaId === plantilla.id && <form className="recurrencia-plantilla" onSubmit={evento => guardarRecurrencia(evento, plantilla, plantilla.modo === "horarios" ? undefined : inicioElegido)}>
                <h4>Repetir “{plantilla.nombre}”</h4>
                <p>Desde {new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(leerFechaISO(fecha))}. La recurrencia guardará esta versión de la plantilla.</p>
                <fieldset><legend>Días de la semana</legend>
                    <button type="button" onClick={() => cambiarDiasRecurrencia([0, 1, 2, 3, 4, 5, 6])}>Seleccionar toda la semana</button>
                    {[[0, "Domingo"], [1, "Lunes"], [2, "Martes"], [3, "Miércoles"], [4, "Jueves"], [5, "Viernes"], [6, "Sábado"]].map(([dia, etiqueta]) => <label key={dia}><input type="checkbox" checked={diasRecurrencia.includes(dia)} onChange={evento => cambiarDiasRecurrencia(actual => evento.target.checked ? [...actual, dia].sort((a, b) => a - b) : actual.filter(valor => valor !== dia))} /> {etiqueta}</label>)}
                </fieldset>
                <label><span>Hasta (opcional)</span><input type="date" min={fecha} value={fechaFinRecurrencia} onChange={evento => cambiarFechaFinRecurrencia(evento.target.value)} /></label>
                {plantilla.modo !== "horarios" && <p>Se repetirá a partir de las {campoHora(inicioElegido)}; se conservará la hora de inicio elegida arriba.</p>}
                <p className="recurrencia-plantilla-preview">Próximas apariciones: {fechasInicialesRecurrencia(fecha, diasRecurrencia, fechaFinRecurrencia).map(dia => new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(leerFechaISO(dia))).join(", ") || "Elegí uno o más días."}</p>
                {errorRecurrencia && <p role="alert" className="plan-plantilla-error">{errorRecurrencia}</p>}
                <div className="plan-plantilla-acciones"><button type="submit" className="plan-plantilla-primario">Guardar recurrencia</button><button type="button" onClick={() => { cambiarRecurrenciaAbiertaId(null); cambiarErrorRecurrencia("") }}>Cancelar</button></div>
            </form>}
        </li>
        })}</ul>)}
        {confirmacionBorrado && (() => {
            const ahora = new Date()
            const planesOrigen = planes.filter(plan => plan.plantillaOrigenId === confirmacionBorrado.id)
            const planesFuturos = planesOrigen.filter(plan => plan.inicio >= ahora)
            const recurrenciasLegado = recurrencias.filter(regla => !regla.plantillaOrigenId)
            const tieneDatosCompletos = !errorDependencias
            const alBorrar = recurrencias.filter(regla => regla.plantillaOrigenId === confirmacionBorrado.id
                || recurrenciasLegadoSeleccionadas.includes(regla.id))
            const seriesTodas = new Set(alBorrar.map(regla => regla.idSerie ?? regla.id)).size
            const previewFuturas = eliminarRecurrenciasDePlantilla(recurrencias, confirmacionBorrado.id, "futuras", {
                ahora,
                idsLegado: recurrenciasLegadoSeleccionadas
            })
            const seriesFuturas = previewFuturas.ok ? previewFuturas.seriesAfectadas.length : 0
            const idsActivos = new Set(idsPlanesSeguimiento)
            const idsRecurrenciasElegidas = new Set(alBorrar.map(regla => regla.idSerie ?? regla.id))
            const planesRecurrentesActivos = planesEnSeguimiento.filter(plan => idsActivos.has(plan.id)
                && (plan.plantillaOrigenId === confirmacionBorrado.id
                    || (plan.idSerie && idsRecurrenciasElegidas.has(plan.idSerie))
                    || (plan.idRecurrencia && recurrencias.some(regla => regla.id === plan.idRecurrencia
                        && idsRecurrenciasElegidas.has(regla.idSerie ?? regla.id)))))
            const planesFijosActivos = planesOrigen.filter(plan => idsActivos.has(plan.id)
                && (alcanceBorrado === "todas" || plan.inicio >= ahora))
            const seguimientoBloquea = planesRecurrentesActivos.length > 0 || planesFijosActivos.length > 0
            const bloqueaBorrado = alcanceBorrado !== "conservar" && (!tieneDatosCompletos || seguimientoBloquea)
            const totalPlanes = alcanceBorrado === "futuras" ? planesFuturos.length : planesOrigen.length
            return <div className="dialogo-borrado-plantilla-fondo" onMouseDown={evento => { if (evento.target === evento.currentTarget) cambiarConfirmacionBorrado(null) }}>
                <section className="dialogo-borrado-plantilla" role="dialog" aria-modal="true" aria-labelledby="titulo-borrado-plantilla">
                    <h3 id="titulo-borrado-plantilla">Eliminar “{confirmacionBorrado.nombre}”</h3>
                    <p>Los registros reales permanecerán en Historial y Analítica, cualquiera sea la opción.</p>
                    <fieldset>
                        <legend>Elegí qué hacer con sus planes del calendario</legend>
                        <label><input type="radio" name="alcance-borrado-plantilla" value="conservar" checked={alcanceBorrado === "conservar"} onChange={() => cambiarAlcanceBorrado("conservar")} /> Borrar solo la plantilla y conservar sus planes</label>
                        <label><input type="radio" name="alcance-borrado-plantilla" value="todas" checked={alcanceBorrado === "todas"} onChange={() => cambiarAlcanceBorrado("todas")} disabled={!tieneDatosCompletos || seguimientoBloquea} /> Borrar la plantilla y todos sus planes ({planesOrigen.length})</label>
                        <label><input type="radio" name="alcance-borrado-plantilla" value="futuras" checked={alcanceBorrado === "futuras"} onChange={() => cambiarAlcanceBorrado("futuras")} disabled={!tieneDatosCompletos || seguimientoBloquea} /> Borrar la plantilla y sus planes que empiezan ahora o más adelante ({planesFuturos.length})</label>
                    </fieldset>
                    {alcanceBorrado !== "conservar" && <div className="borrado-plantilla-recurrencias">
                        <h4>Recurrencias</h4>
                        <p>{alcanceBorrado === "todas" ? `${seriesTodas} series se eliminarán.` : `${seriesFuturas} series se detendrán desde su próxima aparición.`}</p>
                        {recurrenciasLegado.length > 0 && <fieldset>
                            <legend>Reglas antiguas sin vínculo · elegí solo las de esta plantilla</legend>
                            {recurrenciasLegado.map(regla => <label key={regla.id}><input type="checkbox" checked={recurrenciasLegadoSeleccionadas.includes(regla.id)} onChange={evento => cambiarRecurrenciasLegadoSeleccionadas(actual => evento.target.checked ? [...actual, regla.id] : actual.filter(id => id !== regla.id))} /> {regla.nombre} · {regla.diasSemana.map(dia => ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][dia]).join(", ")} · {hora(regla.segundosInicio)}</label>)}
                        </fieldset>}
                    </div>}
                    {errorDependencias && <p role="alert" className="plan-plantilla-error">No se pudieron cargar planes o recurrencias: {errorDependencias} Solo podés borrar la plantilla y conservar los planes.</p>}
                    {seguimientoBloquea && alcanceBorrado !== "conservar" && <p role="alert" className="plan-plantilla-error">No se pueden borrar planes que forman parte del seguimiento activo. Podés conservarlos y borrar solo la plantilla.</p>}
                    <p className="dialogo-borrado-plantilla-nota">Planes afectados por esta opción: {alcanceBorrado === "conservar" ? 0 : totalPlanes}. Las reglas antiguas seleccionadas se incluirán en el borrado.</p>
                    {error && <p role="alert" className="plan-plantilla-error">{error}</p>}
                    <div className="dialogo-borrado-plantilla-acciones"><button type="button" onClick={() => cambiarConfirmacionBorrado(null)}>Cancelar</button><button type="button" className="plan-plantilla-primario" disabled={bloqueaBorrado} onClick={confirmarBorrado}>Eliminar plantilla</button></div>
                </section>
            </div>
        })()}
    </section>
}
