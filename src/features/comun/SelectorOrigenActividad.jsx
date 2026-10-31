import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { obtenerCategoriasPlantillaEvento } from "../../domain/eventos/eventos.js"
import { OPCIONES_ORDEN_PLANTILLAS_EVENTOS, ordenarPlantillasEventos } from "../../domain/eventos/ordenPlantillasEventos.js"
import "./SelectorOrigenActividad.css"

function normalizarBusqueda(valor) {
    return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
}

export function SelectorOrigenActividad({
    tipo,
    etiqueta,
    opciones = [],
    value = "",
    onChange,
    categorias = [],
    ordenEventos = "ultimo-uso",
    cambiarOrdenEventos = () => {},
    disabled = false,
    emptyLabel,
    missingName = "",
    ref: forwardedRef = null
}) {
    const esEvento = tipo === "evento"
    const tituloTipo = esEvento ? "plantilla de evento" : "tarea"
    const titulo = `Elegí ${esEvento ? "una plantilla de evento" : "una tarea"}`
    const id = useId()
    const labelId = `selector-origen-label-${id}`
    const tituloId = `selector-origen-titulo-${id}`
    const triggerRef = useRef(null)
    const inputRef = useRef(null)
    const dialogRef = useRef(null)
    const [abierto, cambiarAbierto] = useState(false)
    const [busqueda, cambiarBusqueda] = useState("")
    const [ramaId, cambiarRamaId] = useState(null)
    const opcionesOrdenadas = useMemo(() => esEvento
        ? ordenarPlantillasEventos(opciones, ordenEventos)
        : opciones, [esEvento, opciones, ordenEventos])
    const seleccionado = opciones.find(opcion => opcion.id === value)
    const tareasPorId = useMemo(() => new Map(opciones.map(opcion => [opcion.id, opcion])), [opciones])
    const objetivosDeTareas = useMemo(() => {
        const grupos = new Map()
        opciones.filter(opcion => opcion.objetivoId).forEach(opcion => {
            if (!grupos.has(opcion.objetivoId)) grupos.set(opcion.objetivoId, {
                id: opcion.objetivoId,
                nombre: (opcion.rutaNombre ?? "").split(" › ")[0] || "Objetivo",
                cantidad: 0
            })
            if (!tareasPorId.has(opcion.padreId)) grupos.get(opcion.objetivoId).cantidad += 1
        })
        return [...grupos.values()]
    }, [opciones, tareasPorId])
    const rutaRama = useMemo(() => {
        const ruta = []
        const vistos = new Set()
        let actual = tareasPorId.get(ramaId)
        while (actual && !vistos.has(actual.id)) {
            vistos.add(actual.id)
            ruta.unshift(actual)
            actual = tareasPorId.get(actual.padreId)
        }
        return ruta
    }, [ramaId, tareasPorId])
    const resultados = useMemo(() => {
        const consulta = normalizarBusqueda(busqueda.trim())
        if (!consulta) return opcionesOrdenadas
        return opcionesOrdenadas.filter(opcion => normalizarBusqueda(
            `${opcion.nombre ?? ""} ${opcion.rutaNombre ?? ""}`
        ).includes(consulta))
    }, [busqueda, opcionesOrdenadas])

    useImperativeHandle(forwardedRef, () => ({ focus: () => triggerRef.current?.focus() }), [])

    useEffect(() => {
        if (!abierto) return undefined
        const overflowAnterior = document.body.style.overflow
        document.body.style.overflow = "hidden"
        inputRef.current?.focus()
        return () => { document.body.style.overflow = overflowAnterior }
    }, [abierto])

    function cerrar() {
        cambiarAbierto(false)
        cambiarBusqueda("")
        cambiarRamaId(null)
        requestAnimationFrame(() => triggerRef.current?.focus())
    }

    function elegir(opcion) {
        onChange(opcion)
        cerrar()
    }

    function manejarTeclado(evento) {
        if (evento.key === "Escape") {
            evento.preventDefault()
            cerrar()
            return
        }
        if (evento.key !== "Tab" || !dialogRef.current) return
        const controles = [...dialogRef.current.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled)")]
        const primero = controles[0]
        const ultimo = controles.at(-1)
        if (evento.shiftKey && document.activeElement === primero) {
            evento.preventDefault()
            ultimo?.focus()
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault()
            primero?.focus()
        }
    }

    const boton = <button
        ref={triggerRef}
        type="button"
        className={`selector-origen-trigger${seleccionado || value ? " seleccionado" : ""}`}
        aria-labelledby={`${labelId} selector-origen-valor-${id}`}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        disabled={disabled}
        onClick={() => cambiarAbierto(true)}
    >
        {seleccionado && esEvento
            ? <span className="selector-origen-muestra-color" style={{ backgroundColor: seleccionado.color }} aria-hidden="true" />
            : seleccionado ? <span className="selector-origen-icono-tarea" aria-hidden="true">T</span> : null}
        <span className="selector-origen-trigger-texto" id={`selector-origen-valor-${id}`}>
            <strong>{seleccionado?.nombre ?? (value ? missingName || `${tituloTipo} no disponible` : emptyLabel ?? titulo)}</strong>
            {seleccionado && esEvento && <small>{obtenerCategoriasPlantillaEvento(seleccionado).map(id => categorias.find(categoria => categoria.id === id)?.nombre).filter(Boolean).join(" · ") || "Sin categoría"}</small>}
            {seleccionado && !esEvento && <small>{seleccionado.rutaNombre ?? seleccionado.estado ?? "Tarea"}</small>}
        </span>
        <span className="selector-origen-chevron" aria-hidden="true">⌄</span>
    </button>

    return <div className="selector-origen-campo">
        <span id={labelId} className="selector-origen-label">{etiqueta}</span>
        {boton}
        {abierto && createPortal(<div className="selector-origen-fondo" onMouseDown={evento => { if (evento.target === evento.currentTarget) cerrar() }}>
            <section className="selector-origen-dialogo" role="dialog" aria-modal="true" aria-labelledby={tituloId} ref={dialogRef} onKeyDown={manejarTeclado}>
                <header className="selector-origen-header">
                    <div><h2 id={tituloId}>{titulo}</h2><p>Buscá por nombre y elegí de la lista.</p></div>
                    <button type="button" className="selector-origen-cerrar" aria-label="Cerrar selector" onClick={cerrar}>×</button>
                </header>
                <label className="selector-origen-busqueda">
                    <span>Buscar {esEvento ? "plantilla" : "tarea"}</span>
                    <input ref={inputRef} type="search" value={busqueda} placeholder={esEvento ? "Nombre de la plantilla" : "Nombre de la tarea"} onChange={evento => cambiarBusqueda(evento.target.value)} />
                </label>
                {esEvento && <label className="selector-origen-orden">
                    <span>Ordenar plantillas</span>
                    <select value={ordenEventos} onChange={evento => cambiarOrdenEventos(evento.target.value)}>
                        {OPCIONES_ORDEN_PLANTILLAS_EVENTOS.map(opcion => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>)}
                    </select>
                </label>}
                {value && <button type="button" className="selector-origen-limpiar" onClick={() => elegir(null)}>{emptyLabel ?? (esEvento ? "Sin plantilla" : "Sin tarea")}</button>}
                {!esEvento && !busqueda.trim() && <div className="selector-origen-ruta">
                    <button type="button" disabled={!ramaId} onClick={() => cambiarRamaId(ramaId?.startsWith("objetivo:") ? null : rutaRama.length > 1 ? rutaRama.at(-2).id : null)}>← Tareas principales</button>
                    <span>{ramaId?.startsWith("objetivo:") ? objetivosDeTareas.find(objetivo => `objetivo:${objetivo.id}` === ramaId)?.nombre ?? "Objetivo" : rutaRama.length ? [objetivosDeTareas.find(objetivo => objetivo.id === rutaRama[0].objetivoId)?.nombre, ...rutaRama.map(tarea => tarea.nombre)].filter(Boolean).join(" › ") : "Objetivos y tareas principales"}</span>
                </div>}
                <div className="selector-origen-lista" role={esEvento ? "listbox" : "group"} aria-label={esEvento ? "Plantillas de evento disponibles" : busqueda.trim() ? "Resultados de tareas" : "Tareas de esta rama"}>
                    {(esEvento ? resultados.map(opcion => ({ tipo: "opcion", opcion })) : busqueda.trim()
                        ? resultados.map(opcion => ({ tipo: "opcion", opcion }))
                        : ramaId?.startsWith("objetivo:")
                            ? opcionesOrdenadas.filter(opcion => opcion.objetivoId === ramaId.slice("objetivo:".length) && !tareasPorId.has(opcion.padreId)).map(opcion => ({ tipo: "opcion", opcion }))
                            : ramaId
                                ? opcionesOrdenadas.filter(opcion => opcion.padreId === ramaId).map(opcion => ({ tipo: "opcion", opcion }))
                                : [
                                    ...objetivosDeTareas.map(objetivo => ({ tipo: "objetivo", objetivo })),
                                    ...opcionesOrdenadas.filter(opcion => !opcion.objetivoId && !tareasPorId.has(opcion.padreId)).map(opcion => ({ tipo: "opcion", opcion }))
                                ]).map(item => {
                        if (item.tipo === "objetivo") return <div className="selector-origen-opcion-rama selector-origen-opcion-objetivo" key={item.objetivo.id}>
                            <span><strong>{item.objetivo.nombre}</strong><small>{item.objetivo.cantidad} tarea(s) principal(es)</small></span>
                            <button type="button" aria-label={`Ver tareas del objetivo ${item.objetivo.nombre}`} onClick={() => cambiarRamaId(`objetivo:${item.objetivo.id}`)}>›</button>
                        </div>
                        const opcion = item.opcion
                        const categoriasEvento = esEvento
                            ? obtenerCategoriasPlantillaEvento(opcion).map(id => categorias.find(categoria => categoria.id === id)?.nombre ?? "Categoría no disponible")
                            : []
                        const opcionTarea = <button
                            type="button" role={esEvento ? "option" : undefined} aria-selected={esEvento ? opcion.id === value : undefined} aria-pressed={!esEvento ? opcion.id === value : undefined}
                            className={`selector-origen-opcion${opcion.id === value ? " activa" : ""}`}
                            key={opcion.id} onClick={() => elegir(opcion)}>
                            {esEvento
                                ? <span className="selector-origen-muestra-color" style={{ backgroundColor: opcion.color }} aria-hidden="true" />
                                : <span className="selector-origen-icono-tarea" aria-hidden="true">T</span>}
                            <span className="selector-origen-opcion-contenido">
                                <strong>{opcion.nombre}</strong>
                                {esEvento
                                    ? <span className="selector-origen-categorias">{categoriasEvento.length
                                        ? categoriasEvento.map((nombre, indice) => <small key={`${opcion.id}-${indice}`}>{nombre}</small>)
                                        : <small>Sin categoría</small>}</span>
                                    : <span className="selector-origen-detalles-tarea"><small>{opcion.rutaNombre ?? "Sin objetivo"}</small><small>{opcion.estado ?? "Tarea"}</small></span>}
                            </span>
                            {opcion.id === value && <span className="selector-origen-check" aria-hidden="true">✓</span>}
                        </button>
                        if (esEvento || busqueda.trim() || !opciones.some(tarea => tarea.padreId === opcion.id)) return opcionTarea
                        const cantidadHijas = opciones.filter(tarea => tarea.padreId === opcion.id).length
                        return <div className="selector-origen-opcion-rama" key={opcion.id}>
                            {opcionTarea}
                            <button type="button" aria-label={`Ver ${cantidadHijas} subtareas de ${opcion.nombre}`} onClick={() => cambiarRamaId(opcion.id)}>› <small>{cantidadHijas}</small></button>
                        </div>
                    })}
                    {(esEvento ? resultados.length === 0 : (busqueda.trim() ? resultados.length : ramaId?.startsWith("objetivo:")
                        ? opcionesOrdenadas.filter(opcion => opcion.objetivoId === ramaId.slice("objetivo:".length) && !tareasPorId.has(opcion.padreId)).length
                        : ramaId ? opcionesOrdenadas.filter(opcion => opcion.padreId === ramaId).length
                            : objetivosDeTareas.length + opcionesOrdenadas.filter(opcion => !opcion.objetivoId && !tareasPorId.has(opcion.padreId)).length) === 0) && <p className="selector-origen-vacio">{esEvento
                        ? opciones.length ? `No hay plantillas que coincidan con “${busqueda}”.` : "Todavía no hay plantillas de evento para elegir."
                        : busqueda.trim() ? `No hay tareas que coincidan con “${busqueda}”.` : ramaId ? "Esta tarea todavía no tiene subtareas." : opciones.length ? "No hay tareas principales para elegir." : "Todavía no hay tareas para elegir."}</p>}
                </div>
            </section>
        </div>, document.body)}
    </div>
}
