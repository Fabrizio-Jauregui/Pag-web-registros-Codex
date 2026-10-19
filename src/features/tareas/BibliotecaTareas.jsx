import { useEffect, useRef, useState } from "react"

import { ESTADOS_TAREA } from "../../domain/tareas/tareas.js"
import "./BibliotecaTareas.css"

const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" })

export function BibliotecaTareas({ tareas, errorCarga = "", tareaActivaId = null, sesionFocusActiva = false, onCrear, onActualizar, onEliminar, onCambiarDestino, onReordenar }) {
    const [formularioAbierto, cambiarFormularioAbierto] = useState(false)
    const [idEditando, cambiarIdEditando] = useState(null)
    const [nombre, cambiarNombre] = useState("")
    const [estado, cambiarEstado] = useState("Pendiente")
    const [destino, cambiarDestino] = useState("backlog")
    const [error, cambiarError] = useState("")
    const campoNombreRef = useRef(null)
    const botonCrearRef = useRef(null)
    const focoAlCerrarRef = useRef(null)
    const formularioAbiertoRef = useRef(false)

    useEffect(() => {
        if (formularioAbierto) {
            formularioAbiertoRef.current = true
            campoNombreRef.current?.focus()
            return
        }
        if (formularioAbiertoRef.current) {
            formularioAbiertoRef.current = false
            const destino = focoAlCerrarRef.current?.isConnected ? focoAlCerrarRef.current : botonCrearRef.current
            destino?.focus()
            focoAlCerrarRef.current = null
        }
    }, [formularioAbierto])

    function abrirNueva(evento) {
        focoAlCerrarRef.current = evento.currentTarget
        cambiarIdEditando(null)
        cambiarNombre("")
        cambiarEstado("Pendiente")
        cambiarDestino("backlog")
        cambiarError("")
        cambiarFormularioAbierto(true)
    }

    function abrirEdicion(tarea, evento) {
        focoAlCerrarRef.current = evento.currentTarget
        cambiarIdEditando(tarea.id)
        cambiarNombre(tarea.nombre)
        cambiarEstado(tarea.estado)
        cambiarDestino(tarea.destino ?? "backlog")
        cambiarError("")
        cambiarFormularioAbierto(true)
    }

    function cancelar() {
        cambiarFormularioAbierto(false)
        cambiarIdEditando(null)
        cambiarError("")
    }

    function guardar(evento) {
        evento.preventDefault()
        const resultado = idEditando === null
            ? onCrear(nombre, estado, destino)
            : onActualizar(idEditando, { nombre, estado, destino })
        if (!resultado.ok) {
            cambiarError(resultado.error)
            return
        }
        cancelar()
    }

    function cambiarEstadoTarea(tarea, nuevoEstado) {
        const resultado = onActualizar(tarea.id, { estado: nuevoEstado })
        cambiarError(resultado.ok ? "" : resultado.error)
    }

    function eliminar(tarea) {
        if (!window.confirm(`¿Querés eliminar la tarea "${tarea.nombre}"?`)) return
        const resultado = onEliminar(tarea.id)
        cambiarError(resultado.ok ? "" : resultado.error)
    }

    return (
        <section className="biblioteca-tareas" aria-labelledby="titulo-tareas">
            <header className="biblioteca-tareas-header">
                <div>
                    <h2 id="titulo-tareas">Tareas</h2>
                    <p>Organizá tus tareas entre el Backlog y la Cola Focus.</p>
                </div>
                {!formularioAbierto && <button type="button" className="tarea-boton-principal" onClick={abrirNueva} ref={botonCrearRef} disabled={Boolean(errorCarga)}>Crear tarea</button>}
            </header>

            {errorCarga && <p className="tarea-mensaje-error" role="alert">{errorCarga}</p>}
            {error && !formularioAbierto && <p className="tarea-mensaje-error" role="alert">{error}</p>}

            {formularioAbierto && (
                <form className="formulario-tarea" aria-labelledby="titulo-formulario-tarea" onSubmit={guardar} onKeyDown={evento => {
                    if (evento.key === "Escape") { evento.preventDefault(); cancelar() }
                }}>
                    <h3 id="titulo-formulario-tarea">{idEditando === null ? "Nueva tarea" : "Editar tarea"}</h3>
                    <label>
                        <span>Nombre</span>
                        <input ref={campoNombreRef} type="text" maxLength={120} value={nombre} onChange={evento => cambiarNombre(evento.target.value)} />
                    </label>
                    <label>
                        <span>Estado</span>
                        <select value={estado} disabled={idEditando === tareaActivaId} onChange={evento => cambiarEstado(evento.target.value)}>
                            {ESTADOS_TAREA.filter(opcion => opcion !== "En curso" || idEditando === tareaActivaId && idEditando !== null).map(opcion => <option key={opcion} value={opcion}>{opcion}</option>)}
                        </select>
                    </label>
                    <label>
                        <span>Destino</span>
                        <select value={destino} disabled={idEditando === tareaActivaId} onChange={evento => cambiarDestino(evento.target.value)}>
                            <option value="backlog">Backlog</option>
                            <option value="focus">Cola Focus</option>
                        </select>
                    </label>
                    {error && <p className="tarea-mensaje-error" role="alert">{error}</p>}
                    <div className="tarea-acciones-formulario">
                        <button className="tarea-boton-principal" type="submit">{idEditando === null ? "Guardar tarea" : "Guardar cambios"}</button>
                        <button type="button" onClick={cancelar}>Cancelar</button>
                    </div>
                </form>
            )}

            {tareas.length === 0 ? <p className="tareas-vacio">{errorCarga ? "No se pueden mostrar las tareas guardadas." : "Todavía no hay tareas. Creá una para empezar."}</p> : (
                <div className="tareas-por-estado">
                    {[
                        { clave: "backlog", titulo: "Backlog", filas: tareas.filter(tarea => (tarea.destino ?? "backlog") === "backlog" && !["Completada", "Cancelada"].includes(tarea.estado)) },
                        { clave: "focus", titulo: "Cola Focus", filas: tareas.filter(tarea => tarea.destino === "focus" && !["Completada", "Cancelada"].includes(tarea.estado)).sort((a, b) => (a.ordenFocus ?? 999999) - (b.ordenFocus ?? 999999)) },
                        { clave: "completadas", titulo: "Completadas", filas: tareas.filter(tarea => tarea.estado === "Completada") },
                        { clave: "canceladas", titulo: "Canceladas", filas: tareas.filter(tarea => tarea.estado === "Cancelada") }
                    ].map(grupo => (
                        <section className="tareas-grupo" key={grupo.clave} aria-labelledby={`titulo-tareas-${grupo.clave}`}>
                            <h3 id={`titulo-tareas-${grupo.clave}`}>{grupo.titulo}<span>{grupo.filas.length}</span></h3>
                            {grupo.filas.length === 0 ? <p className="tareas-grupo-vacio">Sin tareas</p> : (
                                <ul className="lista-tareas">
                                    {grupo.filas.map((tarea, indice) => {
                                        const activa = tarea.id === tareaActivaId
                                        const candidatas = grupo.clave === "focus" ? grupo.filas.filter(item => !["Boceto"].includes(item.estado)) : []
                                        const ids = candidatas.map(item => item.id)
                                        const idActual = ids.indexOf(tarea.id)
                                        const primerMovible = sesionFocusActiva && tareaActivaId ? Math.max(1, ids.indexOf(tareaActivaId) + 1) : 0
                                        return (
                                            <li className={`tarea-fila ${activa ? "tarea-fila-activa" : ""}`} key={tarea.id}>
                                                <div className="tarea-datos">
                                                    <span>{tarea.nombre}{activa && " · Activa"}</span>
                                                    <small>{tarea.estado}{grupo.clave === "focus" && ` · Prioridad ${indice + 1}`} · Actualizada <time dateTime={tarea.actualizadaEn}>{formatoFecha.format(new Date(tarea.actualizadaEn))}</time></small>
                                                </div>
                                                <label className="tarea-estado-control">
                                                    <span>Cambiar estado</span>
                                                    <select aria-label={`Estado de ${tarea.nombre}`} value={tarea.estado} disabled={activa} onChange={evento => cambiarEstadoTarea(tarea, evento.target.value)}>
                                                        {ESTADOS_TAREA.filter(opcion => opcion !== "En curso" || activa).map(opcion => <option key={opcion} value={opcion}>{opcion}</option>)}
                                                    </select>
                                                </label>
                                                <div className="tarea-acciones">
                                                    {grupo.clave === "focus" && (
                                                        <>
                                                            <button type="button" aria-label={`Subir ${tarea.nombre}`} disabled={activa || idActual <= primerMovible} onClick={() => onReordenar(tarea.id, -1, tareaActivaId)}>↑</button>
                                                            <button type="button" aria-label={`Bajar ${tarea.nombre}`} disabled={activa || idActual < primerMovible || idActual === ids.length - 1} onClick={() => onReordenar(tarea.id, 1, tareaActivaId)}>↓</button>
                                                        </>
                                                    )}
                                                    {!activa && grupo.clave === "backlog" && tarea.estado !== "Boceto" && <button type="button" onClick={() => onCambiarDestino(tarea.id, "focus")}>Pasar a Cola Focus</button>}
                                                    {!activa && grupo.clave === "focus" && <button type="button" onClick={() => onCambiarDestino(tarea.id, "backlog")}>Enviar a Backlog</button>}
                                                    <button type="button" onClick={evento => abrirEdicion(tarea, evento)}>Editar</button>
                                                    <button type="button" disabled={activa} onClick={() => eliminar(tarea)}>Eliminar</button>
                                                </div>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>
            )}
        </section>
    )
}
