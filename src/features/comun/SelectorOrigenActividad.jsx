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
    const opcionesOrdenadas = useMemo(() => esEvento
        ? ordenarPlantillasEventos(opciones, ordenEventos)
        : opciones, [esEvento, opciones, ordenEventos])
    const seleccionado = opciones.find(opcion => opcion.id === value)
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
                <div className="selector-origen-lista" role="listbox" aria-label={esEvento ? "Plantillas de evento disponibles" : "Tareas disponibles"}>
                    {resultados.map(opcion => {
                        const categoriasEvento = esEvento
                            ? obtenerCategoriasPlantillaEvento(opcion).map(id => categorias.find(categoria => categoria.id === id)?.nombre ?? "Categoría no disponible")
                            : []
                        return <button
                            type="button"
                            role="option"
                            aria-selected={opcion.id === value}
                            className={`selector-origen-opcion${opcion.id === value ? " activa" : ""}`}
                            key={opcion.id}
                            onClick={() => elegir(opcion)}
                        >
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
                    })}
                    {resultados.length === 0 && <p className="selector-origen-vacio">{opciones.length
                        ? `No hay ${esEvento ? "plantillas" : "tareas"} que coincidan con “${busqueda}”.`
                        : `Todavía no hay ${esEvento ? "plantillas de evento" : "tareas"} para elegir.`}</p>}
                </div>
            </section>
        </div>, document.body)}
    </div>
}
