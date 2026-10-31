import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

function normalizarBusqueda(valor) {
    return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
}

export function SelectorUbicacionTarea({ tareas, objetivos, value, onChange, disabled = false }) {
    const [abierto, cambiarAbierto] = useState(false)
    const [ramaId, cambiarRamaId] = useState(null)
    const [busqueda, cambiarBusqueda] = useState("")
    const triggerRef = useRef(null)
    const searchRef = useRef(null)
    const tareasPorId = useMemo(() => new Map(tareas.map(tarea => [tarea.id, tarea])), [tareas])
    const objetivosPorId = useMemo(() => new Map(objetivos.map(objetivo => [objetivo.id, objetivo])), [objetivos])
    const items = useMemo(() => [...objetivos, ...tareas], [objetivos, tareas])
    const seleccionado = value ? objetivosPorId.get(value) ?? tareasPorId.get(value) : null
    const rutaActual = useMemo(() => {
        const ruta = []
        const porId = new Map(items.map(item => [item.id, item]))
        const vistos = new Set()
        let nodo = porId.get(ramaId)
        while (nodo && !vistos.has(nodo.id)) {
            vistos.add(nodo.id)
            ruta.unshift(nodo)
            nodo = porId.get(nodo.padreId)
        }
        return ruta
    }, [items, ramaId])
    const busquedaNormalizada = normalizarBusqueda(busqueda.trim())
    const resultados = busquedaNormalizada
        ? items.filter(item => normalizarBusqueda(`${item.nombre} ${item.rutaNombre ?? ""}`).includes(busquedaNormalizada))
        : items.filter(item => ramaId ? item.padreId === ramaId : objetivos.includes(item) || !tareasPorId.has(item.padreId) && !objetivosPorId.has(item.padreId))

    useEffect(() => {
        if (!abierto) return undefined
        const overflowAnterior = document.body.style.overflow
        document.body.style.overflow = "hidden"
        searchRef.current?.focus()
        return () => { document.body.style.overflow = overflowAnterior }
    }, [abierto])

    function cerrar() {
        cambiarAbierto(false)
        cambiarRamaId(null)
        cambiarBusqueda("")
        requestAnimationFrame(() => triggerRef.current?.focus())
    }

    function elegir(id) {
        onChange(id)
        cerrar()
    }

    function manejarTeclado(evento) {
        if (evento.key === "Escape") {
            evento.preventDefault()
            cerrar()
            return
        }
        if (evento.key !== "Tab") return
        const controles = [...evento.currentTarget.querySelectorAll("button:not(:disabled), input:not(:disabled)")]
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

    return <>
        <button ref={triggerRef} type="button" className="selector-ubicacion-tarea" disabled={disabled} onClick={() => cambiarAbierto(true)} aria-haspopup="dialog" aria-expanded={abierto}>
            {seleccionado ? `${seleccionado.nombre}${seleccionado.tipo === "objetivo" ? " · objetivo" : " · tarea"}` : "Sin objetivo ni tarea padre"}
        </button>
        {abierto && createPortal(<div className="selector-ubicacion-fondo" onMouseDown={evento => { if (evento.target === evento.currentTarget) cerrar() }}>
            <section className="selector-ubicacion-dialogo" role="dialog" aria-modal="true" aria-labelledby="titulo-ubicacion-tarea" onKeyDown={manejarTeclado}>
                <header><h3 id="titulo-ubicacion-tarea">Elegí dónde crear la tarea</h3><button type="button" aria-label="Cerrar" onClick={cerrar}>×</button></header>
                <label><span>Buscar objetivo o tarea</span><input ref={searchRef} type="search" value={busqueda} onChange={evento => cambiarBusqueda(evento.target.value)} placeholder="Nombre" /></label>
                {!busquedaNormalizada && <div className="selector-ubicacion-ruta"><button type="button" disabled={!ramaId} onClick={() => cambiarRamaId(rutaActual.length > 1 ? rutaActual.at(-2).id : null)}>← Volver</button><span>{rutaActual.map(item => item.nombre).join(" › ") || "Inicio"}</span></div>}
                <div className="selector-ubicacion-lista">
                    {resultados.map(item => {
                        const esObjetivo = item.tipo === "objetivo"
                        const tieneHijas = items.some(hija => hija.padreId === item.id)
                        return <div className="selector-ubicacion-fila" key={item.id}>
                            <button type="button" className="selector-ubicacion-elegir" onClick={() => elegir(item.id)}>
                                <strong>{item.nombre}</strong><small>{esObjetivo ? "Objetivo" : item.rutaNombre ?? "Tarea sin objetivo"}</small>
                            </button>
                            {!busquedaNormalizada && tieneHijas && <button type="button" aria-label={`Ver contenido de ${item.nombre}`} onClick={() => cambiarRamaId(item.id)}>›</button>}
                        </div>
                    })}
                    {!resultados.length && <p>No hay objetivos ni tareas en este nivel.</p>}
                </div>
                <footer><button type="button" onClick={() => elegir("")}>Crear sin objetivo ni tarea padre</button></footer>
            </section>
        </div>, document.body)}
    </>
}
