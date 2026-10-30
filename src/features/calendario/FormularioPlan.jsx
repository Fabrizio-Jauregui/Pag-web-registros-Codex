import { useEffect, useRef, useState } from "react"
import { leerValorFechaHoraLocal, obtenerValorFechaHoraLocal } from "./segmentosCalendario.js"
import { SelectorOrigenActividad } from "../comun/SelectorOrigenActividad.jsx"

function valorFechaHora(fecha) {
    return obtenerValorFechaHoraLocal(fecha).slice(0, 19)
}

function crearValoresIniciales(plan, fechaSeleccionada, valoresIniciales = null) {
    if (plan) return {
        nombre: plan.nombre,
        eventoId: plan.eventoId ?? "",
        tareaId: plan.tareaId ?? "",
        inicio: valorFechaHora(plan.inicio),
        fin: valorFechaHora(plan.fin)
    }
    if (valoresIniciales) return valoresIniciales
    const inicio = new Date(fechaSeleccionada)
    inicio.setHours(9, 0, 0, 0)
    const fin = new Date(inicio)
    fin.setMinutes(fin.getMinutes() + 30)
    return { nombre: "", eventoId: "", tareaId: "", inicio: valorFechaHora(inicio), fin: valorFechaHora(fin) }
}

export function FormularioPlan({ plan = null, fechaSeleccionada, eventos, tareas = [], categorias = [], ordenEventos = "ultimo-uso", cambiarOrdenEventos = () => {}, onGuardar, onCrearRecurrencia, onCancelar, valoresIniciales = null }) {
    const esSesionFocus = plan?.tipoPlanificacion === "focus"
    const [repetirSemanalmente, cambiarRepetirSemanalmente] = useState(false)
    const [diasSemana, cambiarDiasSemana] = useState(() => [fechaSeleccionada.getDay()])
    const [fechaFinSerie, cambiarFechaFinSerie] = useState("")
    const [alcance, cambiarAlcance] = useState("solo")
    const [valores, cambiarValores] = useState(() => crearValoresIniciales(plan, fechaSeleccionada, valoresIniciales))
    const [error, cambiarError] = useState("")
    const nombreRef = useRef(null)
    const eventoRef = useRef(null)
    const tareaRef = useRef(null)
    const inicioRef = useRef(null)
    const finRef = useRef(null)
    const eventoSeleccionado = eventos.find(evento => evento.id === valores.eventoId)
    const tareaSeleccionada = tareas.find(tarea => tarea.id === valores.tareaId)

    useEffect(() => {
        eventoRef.current?.focus()
    }, [])

    function cambiar(campo, valor) {
        cambiarValores(actuales => ({ ...actuales, [campo]: valor }))
        cambiarError("")
    }

    function guardar(evento) {
        evento.preventDefault()
        const inicio = leerValorFechaHoraLocal(valores.inicio)
        const fin = leerValorFechaHoraLocal(valores.fin)
        if (!inicio) {
            const mensaje = "Elegí una fecha y hora de inicio válidas."
            cambiarError(mensaje)
            inicioRef.current?.focus()
            return
        }
        if (!fin) {
            const mensaje = "Elegí una fecha y hora de fin válidas."
            cambiarError(mensaje)
            finRef.current?.focus()
            return
        }
        if (valores.eventoId && !eventoSeleccionado) {
            const mensaje = "La plantilla seleccionada ya no está disponible. Elegí otra o quitá la selección."
            cambiarError(mensaje)
            eventoRef.current?.focus()
            return
        }
        if (valores.tareaId && !tareaSeleccionada) {
            const mensaje = "La tarea seleccionada ya no está disponible. Elegí otra tarea."
            cambiarError(mensaje)
            tareaRef.current?.focus()
            return
        }
        if (!esSesionFocus || !plan?.configuracionFocus?.usarColaFocus) {
            if (Boolean(eventoSeleccionado) === Boolean(tareaSeleccionada)) {
                const mensaje = "Elegí una plantilla de evento o una tarea como origen."
                cambiarError(mensaje)
                eventoRef.current?.focus()
                return
            }
        }
        const cambios = {
            id: plan?.id,
            ...(plan?.plantillaOrigenId ? { plantillaOrigenId: plan.plantillaOrigenId } : {}),
            ...(plan?.plantillaOrigenNombre ? { plantillaOrigenNombre: plan.plantillaOrigenNombre } : {}),
            nombre: valores.nombre,
            evento: eventoSeleccionado ?? null,
            tarea: tareaSeleccionada ?? null,
            inicio,
            fin,
            alcance
        }
        const resultado = plan?.idRecurrencia
            ? onGuardar({ ...cambios, idRecurrencia: plan.idRecurrencia, fechaRecurrencia: plan.fechaRecurrencia })
            : repetirSemanalmente
                ? onCrearRecurrencia({ ...cambios, diasSemana, fechaFin: fechaFinSerie || null })
                : onGuardar(cambios)
        if (!resultado.ok) {
            cambiarError(resultado.error)
            if (resultado.error.toLocaleLowerCase().includes("nombre")) nombreRef.current?.focus()
            else if (resultado.error.toLocaleLowerCase().includes("plantilla")) eventoRef.current?.focus()
            else finRef.current?.focus()
        } else {
            onCancelar()
        }
    }

    return (
        <section className="formulario-plan" aria-labelledby="titulo-formulario-plan">
            <h3 id="titulo-formulario-plan">{plan ? "Editar actividad planificada" : "Planificar actividad"}</h3>
            <p>{esSesionFocus ? "Sesión Focus planificada: el fin se calcula desde sus bloques." : "Este bloque representa lo que pensás hacer; los registros miden el tiempo real."}</p>
            <form aria-labelledby="titulo-formulario-plan" onSubmit={guardar} onKeyDown={evento => {
                if (evento.key === "Escape") { evento.preventDefault(); onCancelar() }
            }}>
                <SelectorOrigenActividad
                    tipo="evento"
                    etiqueta="Plantilla de evento"
                    opciones={eventos}
                    categorias={categorias}
                    value={valores.eventoId}
                    missingName={plan?.nombre}
                    ref={eventoRef}
                    disabled={Boolean(valores.tareaId)}
                    ordenEventos={ordenEventos}
                    cambiarOrdenEventos={cambiarOrdenEventos}
                    onChange={opcion => {
                        const id = opcion?.id ?? ""
                        cambiarValores(actuales => ({
                            ...actuales,
                            eventoId: id,
                            tareaId: id ? "" : actuales.tareaId,
                            nombre: opcion?.nombre ?? actuales.nombre
                        }))
                        cambiarError("")
                    }}
                />
                <SelectorOrigenActividad
                    tipo="tarea"
                    etiqueta="Tarea"
                    opciones={tareas}
                    value={valores.tareaId ?? ""}
                    missingName={plan?.tareaNombre ?? plan?.nombre}
                    ref={tareaRef}
                    disabled={Boolean(valores.eventoId)}
                    onChange={opcion => {
                        const id = opcion?.id ?? ""
                        cambiarValores(actuales => ({ ...actuales, tareaId: id, eventoId: id ? "" : actuales.eventoId, nombre: opcion?.nombre ?? actuales.nombre }))
                        cambiarError("")
                    }}
                />
                {!esSesionFocus && <label>
                    <span>Nombre de la actividad</span>
                    <input
                        ref={nombreRef}
                        value={eventoSeleccionado?.nombre ?? tareaSeleccionada?.nombre ?? valores.nombre}
                        readOnly
                        maxLength={80}
                        disabled={!eventoSeleccionado && !tareaSeleccionada}
                        required
                    />
                </label>}
                <div className="campos-horario-plan">
                    <label>
                        <span>Inicio</span>
                        <input ref={inicioRef} type="datetime-local" step="1" value={valores.inicio}
                            onChange={evento => {
                                if (!esSesionFocus) { cambiar("inicio", evento.target.value); return }
                                const inicio = leerValorFechaHoraLocal(evento.target.value)
                                const duracionMs = plan.configuracionFocus.bloques.reduce((total, bloque) => total + bloque.minutos * 60000, 0)
                                if (inicio) cambiarValores(actuales => ({ ...actuales, inicio: evento.target.value, fin: valorFechaHora(new Date(inicio.getTime() + duracionMs)) }))
                            }} required />
                    </label>
                    {!esSesionFocus && <label>
                        <span>Fin</span>
                        <input ref={finRef} type="datetime-local" step="1" value={valores.fin}
                            onChange={evento => cambiar("fin", evento.target.value)} required />
                    </label>}
                </div>
                {esSesionFocus
                    ? <p className="ayuda-horario-plan">Duración: {plan.configuracionFocus.bloques.reduce((total, bloque) => total + bloque.minutos, 0)} minutos. El horario de fin se ajustará automáticamente.</p>
                    : <p className="ayuda-horario-plan">Si termina otro día, elegí explícitamente la fecha de ese día.</p>}
                {!esSesionFocus && !plan && <fieldset className="recurrencia-plan-campos">
                    <legend>Repetición</legend>
                    <label><input type="checkbox" checked={repetirSemanalmente} onChange={evento => cambiarRepetirSemanalmente(evento.target.checked)} /> Repetir semanalmente</label>
                    {repetirSemanalmente && <>
                        <fieldset><legend>Días</legend>{["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map((dia, indice) =>
                            <label key={dia}><input type="checkbox" checked={diasSemana.includes(indice)} onChange={evento => cambiarDiasSemana(actual => evento.target.checked ? [...actual, indice].sort() : actual.filter(valor => valor !== indice))} /> {dia}</label>
                        )}</fieldset>
                        <label><span>Hasta (opcional)</span><input type="date" min={valores.inicio.slice(0, 10)} value={fechaFinSerie} onChange={evento => cambiarFechaFinSerie(evento.target.value)} /></label>
                        <p>Sin fecha final, la serie continúa hasta que la elimines.</p>
                    </>}
                </fieldset>}
                {plan?.idRecurrencia && <label><span>Aplicar cambios a</span><select value={alcance} onChange={evento => cambiarAlcance(evento.target.value)}>
                    <option value="solo">Solo esta aparición</option><option value="siguientes">Esta y las siguientes</option><option value="toda">Toda la serie</option>
                </select></label>}
                {error && <p className="mensaje-formulario-registro" role="alert">{error}</p>}
                <div className="acciones-formulario-registro">
                    <button type="submit">{plan ? "Guardar cambios" : "Guardar plan"}</button>
                    <button type="button" onClick={onCancelar}>Cancelar</button>
                </div>
            </form>
        </section>
    )
}
