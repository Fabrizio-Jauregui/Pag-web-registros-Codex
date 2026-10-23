import { useMemo, useState } from "react"

import { descendientesDe, ESTADOS_TAREA, obtenerRutaTarea } from "../../domain/tareas/tareas.js"
import { calcularTiempoRegistradoEnPeriodo } from "../../domain/tiempo/CalculosDuracion.js"
import "./BibliotecaTareas.css"

function formatearTiempo(segundos) {
    const horas = Math.floor(segundos / 3600)
    const minutos = Math.floor((segundos % 3600) / 60)
    const resto = segundos % 60
    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`
}

function resumirEstados(tareas) {
    const cantidad = estado => tareas.filter(tarea => tarea.estado === estado).length
    return `${cantidad("Pendiente")} pendientes · ${cantidad("En curso")} en curso · ${cantidad("Completada")} completadas · ${cantidad("Cancelada")} canceladas`
}

function calcularTiempoDe(propios, ahora) {
    let inicioMinimo = null
    for (const registro of propios) {
        for (const segmento of registro.segmentos ?? []) {
            const marca = Date.parse(segmento.inicio)
            if (Number.isFinite(marca) && (inicioMinimo === null || marca < inicioMinimo)) inicioMinimo = marca
        }
    }
    if (inicioMinimo === null) return 0
    return calcularTiempoRegistradoEnPeriodo(propios, new Date(inicioMinimo), new Date(ahora.getTime() + 1), ahora)
}

export function BibliotecaTareas({ tareas, objetivos = [], registros = [], ahora: ahoraProp = new Date(), errorCarga = "", tareaActivaId = null, sesionFocusActiva = false, onCrear, onCrearObjetivo, onActualizarObjetivo, onActualizar, onEliminar, onCambiarDestino, onReordenar, onReordenarArbol }) {
    const [formularioAbierto, cambiarFormularioAbierto] = useState(false)
    const [formularioObjetivo, cambiarFormularioObjetivo] = useState(false)
    const [idEditando, cambiarIdEditando] = useState(null)
    const [nombre, cambiarNombre] = useState("")
    const [estado, cambiarEstado] = useState("Pendiente")
    const [destino, cambiarDestino] = useState("backlog")
    const [padreId, cambiarPadreId] = useState("")
    const [objetivoNombre, cambiarObjetivoNombre] = useState("")
    const [idObjetivoEditando, cambiarIdObjetivoEditando] = useState(null)
    const [confirmacion, cambiarConfirmacion] = useState(null)
    const [nodosPlegados, cambiarNodosPlegados] = useState(() => new Set())
    const [error, cambiarError] = useState("")
    const ahora = useMemo(() => ahoraProp instanceof Date && Number.isFinite(ahoraProp.getTime()) ? ahoraProp : new Date(), [ahoraProp])
    const objetivosPorId = useMemo(() => new Map(objetivos.map(objetivo => [objetivo.id, objetivo])), [objetivos])
    const tareasPorId = useMemo(() => new Map(tareas.map(tarea => [tarea.id, tarea])), [tareas])
    const colaFocus = useMemo(() => tareas.filter(tarea => tarea.destino === "focus" && !["Boceto", "Completada", "Cancelada"].includes(tarea.estado))
        .sort((a, b) => (a.ordenFocus ?? Number.MAX_SAFE_INTEGER) - (b.ordenFocus ?? Number.MAX_SAFE_INTEGER)), [tareas])
    const ordenFocus = useMemo(() => new Map(colaFocus.map((tarea, indice) => [tarea.id, indice])), [colaFocus])
    const registrosPorTarea = useMemo(() => {
        const grupos = new Map()
        for (const registro of registros) {
            if (!registro.tareaId) continue
            if (!grupos.has(registro.tareaId)) grupos.set(registro.tareaId, [])
            grupos.get(registro.tareaId).push(registro)
        }
        return grupos
    }, [registros])
    const tiemposPropios = useMemo(() => new Map(tareas.map(tarea => [tarea.id, calcularTiempoDe(registrosPorTarea.get(tarea.id) ?? [], ahora)])), [tareas, registrosPorTarea, ahora])
    const tiemposTotales = useMemo(() => {
        const total = new Map(tareas.map(tarea => [tarea.id, tiemposPropios.get(tarea.id) ?? 0]))
        const profundidad = tarea => {
            let nivel = 0
            let padreId = tarea.padreId
            const vistos = new Set([tarea.id])
            while (padreId && tareasPorId.has(padreId) && !vistos.has(padreId)) {
                vistos.add(padreId)
                nivel += 1
                padreId = tareasPorId.get(padreId).padreId
            }
            return nivel
        }
        for (const tarea of [...tareas].sort((a, b) => profundidad(b) - profundidad(a))) {
            if (tarea.padreId && total.has(tarea.padreId)) total.set(tarea.padreId, (total.get(tarea.padreId) ?? 0) + (total.get(tarea.id) ?? 0))
        }
        return total
    }, [tareas, tareasPorId, tiemposPropios])

    function abrirNueva(evento) {
        cambiarIdEditando(null)
        cambiarNombre("")
        cambiarEstado("Pendiente")
        cambiarDestino("backlog")
        cambiarPadreId("")
        cambiarError("")
        cambiarFormularioAbierto(true)
        evento?.currentTarget?.blur()
    }

    function abrirEdicion(tarea) {
        cambiarIdEditando(tarea.id)
        cambiarNombre(tarea.nombre)
        cambiarEstado(tarea.estado)
        cambiarDestino(tarea.destino ?? "backlog")
        cambiarPadreId(tarea.padreId ?? tarea.objetivoId ?? "")
        cambiarError("")
        cambiarFormularioAbierto(true)
    }

    function cerrarFormulario() {
        cambiarFormularioAbierto(false)
        cambiarIdEditando(null)
        cambiarError("")
    }

    function guardar(evento) {
        evento.preventDefault()
        const padre = tareasPorId.get(padreId) ?? objetivosPorId.get(padreId)
        const ubicacion = { padreId: padreId || null, objetivoId: padre?.tipo === "objetivo" ? padre.id : padre?.objetivoId ?? null }
        const resultado = idEditando === null
            ? onCrear(nombre, estado, destino, ubicacion)
            : onActualizar(idEditando, { nombre, estado, destino, padreId: padreId || null })
        if (!resultado.ok) {
            cambiarError(resultado.error)
            return
        }
        cerrarFormulario()
    }

    function abrirConfirmacion(id, nuevoEstado) {
        cambiarError("")
        cambiarConfirmacion({ id, nuevoEstado })
    }

    function cambiarEstadoNodo(nodo, nuevoEstado) {
        if (["Completada", "Cancelada"].includes(nuevoEstado) && descendientesDe(tareas, nodo.id).length) {
            abrirConfirmacion(nodo.id, nuevoEstado)
            return
        }
        const resultado = onActualizar(nodo.id, { estado: nuevoEstado }, "solo")
        cambiarError(resultado.ok ? "" : resultado.error)
    }

    function ejecutarEstado(alcance) {
        const resultado = onActualizar(confirmacion.id, { estado: confirmacion.nuevoEstado }, alcance)
        cambiarError(resultado.ok ? "" : resultado.error)
        if (resultado.ok) cambiarConfirmacion(null)
    }

    function guardarObjetivo(evento) {
        evento.preventDefault()
        const resultado = idObjetivoEditando
            ? onActualizarObjetivo(idObjetivoEditando, { nombre: objetivoNombre })
            : onCrearObjetivo(objetivoNombre)
        if (!resultado.ok) {
            cambiarError(resultado.error)
            return
        }
        cambiarObjetivoNombre("")
        cambiarIdObjetivoEditando(null)
        cambiarFormularioObjetivo(false)
        cambiarError("")
    }

    function editarObjetivo(objetivo) {
        cambiarIdObjetivoEditando(objetivo.id)
        cambiarObjetivoNombre(objetivo.nombre)
        cambiarFormularioObjetivo(true)
        cambiarFormularioAbierto(false)
        cambiarError("")
    }

    function alternarPliegue(id) {
        cambiarNodosPlegados(actual => {
            const nuevo = new Set(actual)
            if (nuevo.has(id)) nuevo.delete(id)
            else nuevo.add(id)
            return nuevo
        })
    }

    function eliminar(tarea) {
        if (descendientesDe(tareas, tarea.id).length) {
            cambiarError("Esta tarea contiene subtareas. Reorganizalas o eliminá las subtareas antes de borrar el padre.")
            return
        }
        if (!window.confirm(`¿Querés eliminar la tarea «${tarea.nombre}»?`)) return
        const resultado = onEliminar(tarea.id)
        cambiarError(resultado.ok ? "" : resultado.error)
    }

    const tareaConfirmada = confirmacion ? tareasPorId.get(confirmacion.id) ?? objetivosPorId.get(confirmacion.id) : null
    const descendientesConfirmados = confirmacion ? descendientesDe(tareas, confirmacion.id) : []
    const hayActivaEnRama = descendientesConfirmados.some(tarea => tarea.id === tareaActivaId || tarea.estado === "En curso")
    const nombreTipo = tareaConfirmada?.tipo === "objetivo" ? "objetivo" : "tarea"
    const idsDescendientesEditando = idEditando ? new Set(descendientesDe(tareas, idEditando).map(tarea => tarea.id)) : new Set()
    const ramaEditandoActiva = idEditando !== null && (idEditando === tareaActivaId || idsDescendientesEditando.has(tareaActivaId))
    const opcionesPadre = tareas.filter(tarea => tarea.id !== idEditando && !idsDescendientesEditando.has(tarea.id))

    function renderTarea(tarea, profundidad = 0) {
        const activa = tarea.id === tareaActivaId
        const hijas = tareas.filter(item => item.padreId === tarea.id).sort((a, b) => (a.ordenArbol ?? 0) - (b.ordenArbol ?? 0))
        const padreDeTarea = tarea.padreId ?? tarea.objetivoId ?? null
        const hermanas = tareas.filter(item => (item.padreId ?? item.objetivoId ?? null) === padreDeTarea)
            .sort((a, b) => (a.ordenArbol ?? 0) - (b.ordenArbol ?? 0))
        const indiceHermana = hermanas.findIndex(item => item.id === tarea.id)
        const propios = tiemposPropios.get(tarea.id) ?? 0
        const total = tiemposTotales.get(tarea.id) ?? propios
        const indiceFocus = ordenFocus.get(tarea.id)
        const indiceActivo = colaFocus.findIndex(item => item.id === tareaActivaId)
        const primerMovible = sesionFocusActiva && tareaActivaId ? Math.max(1, indiceActivo + 1) : 0
        return (
            <li className={`tarea-nodo ${activa ? "tarea-nodo-activa" : ""}`} key={tarea.id}>
                <article className="tarea-fila" style={{ "--profundidad-tarea": profundidad }}>
                    <div className="tarea-datos">
                        <strong>{tarea.nombre}{activa && " · Activa"}</strong>
                        <small>{tarea.estado}{tarea.destino === "focus" && indiceFocus !== undefined ? ` · Cola Focus ${indiceFocus + 1}` : " · Backlog"}</small>
                        <small>Tiempo propio: {formatearTiempo(propios)} · Total de la rama: {formatearTiempo(total)}</small>
                        {hijas.length > 0 && <small>Subtareas: {resumirEstados(descendientesDe(tareas, tarea.id))}</small>}
                    </div>
                    {hijas.length > 0 && <button type="button" className="tarea-boton-pliegue" aria-expanded={!nodosPlegados.has(tarea.id)} onClick={() => alternarPliegue(tarea.id)}>{nodosPlegados.has(tarea.id) ? `Mostrar ${hijas.length} subtareas` : "Ocultar subtareas"}</button>}
                    <label className="tarea-estado-control">
                        <span>Estado</span>
                        <select aria-label={`Estado de ${tarea.nombre}`} value={tarea.estado} disabled={activa} onChange={evento => cambiarEstadoNodo(tarea, evento.target.value)}>
                            {ESTADOS_TAREA.filter(opcion => opcion !== "En curso").map(opcion => <option key={opcion} value={opcion}>{opcion}</option>)}
                            {activa && <option value="En curso">En curso</option>}
                        </select>
                    </label>
                    <div className="tarea-acciones">
                        <button type="button" aria-label={`Subir posición de ${tarea.nombre}`} disabled={indiceHermana <= 0} onClick={() => onReordenarArbol(tarea.id, -1)}>↑</button>
                        <button type="button" aria-label={`Bajar posición de ${tarea.nombre}`} disabled={indiceHermana === hermanas.length - 1} onClick={() => onReordenarArbol(tarea.id, 1)}>↓</button>
                        {indiceFocus !== undefined && <>
                            <button type="button" aria-label={`Subir ${tarea.nombre}`} disabled={activa || indiceFocus <= primerMovible} onClick={() => onReordenar(tarea.id, -1, tareaActivaId)}>↑</button>
                            <button type="button" aria-label={`Bajar ${tarea.nombre}`} disabled={activa || indiceFocus < primerMovible || indiceFocus === colaFocus.length - 1} onClick={() => onReordenar(tarea.id, 1, tareaActivaId)}>↓</button>
                        </>}
                        {!activa && tarea.estado !== "Boceto" && tarea.estado !== "Completada" && tarea.estado !== "Cancelada" && (
                            tarea.destino === "focus"
                                ? <button type="button" onClick={() => onCambiarDestino(tarea.id, "backlog")}>Enviar a Backlog</button>
                                : <button type="button" onClick={() => onCambiarDestino(tarea.id, "focus")}>Pasar a Cola Focus</button>
                        )}
                        <button type="button" onClick={() => abrirEdicion(tarea)}>Editar</button>
                        <button type="button" disabled={activa || hijas.length > 0} onClick={() => eliminar(tarea)}>Eliminar</button>
                    </div>
                </article>
                {hijas.length > 0 && !nodosPlegados.has(tarea.id) && <ul className="tareas-hijas" aria-label={`Subtareas de ${tarea.nombre}`}>{hijas.map(hija => renderTarea(hija, profundidad + 1))}</ul>}
            </li>
        )
    }

    return (
        <section className="biblioteca-tareas" aria-labelledby="titulo-tareas">
            <header className="biblioteca-tareas-header">
                <div><h2 id="titulo-tareas">Objetivos y tareas</h2><p>Desglosá objetivos en tareas y subtareas. La Cola Focus reúne tareas de todos los objetivos.</p></div>
                <div className="tareas-acciones-cabecera">
                    {!formularioObjetivo && <button type="button" onClick={() => { cambiarIdObjetivoEditando(null); cambiarObjetivoNombre(""); cambiarFormularioObjetivo(true); cambiarFormularioAbierto(false); cambiarError("") }} disabled={Boolean(errorCarga)}>Crear objetivo</button>}
                    {!formularioAbierto && <button type="button" className="tarea-boton-principal" onClick={abrirNueva} disabled={Boolean(errorCarga)}>Crear tarea</button>}
                </div>
            </header>

            {errorCarga && <p className="tarea-mensaje-error" role="alert">{errorCarga}</p>}
            {error && !formularioAbierto && !formularioObjetivo && <p className="tarea-mensaje-error" role="alert">{error}</p>}

            {formularioObjetivo && <form className="formulario-tarea formulario-objetivo" onSubmit={guardarObjetivo}>
                <h3>{idObjetivoEditando ? "Editar objetivo" : "Nuevo objetivo"}</h3>
                <label><span>Nombre</span><input aria-label="Nombre del objetivo" maxLength={120} value={objetivoNombre} onChange={evento => cambiarObjetivoNombre(evento.target.value)} /></label>
                {error && <p className="tarea-mensaje-error" role="alert">{error}</p>}
                <div className="tarea-acciones-formulario"><button className="tarea-boton-principal" type="submit">{idObjetivoEditando ? "Guardar cambios del objetivo" : "Guardar objetivo"}</button><button type="button" onClick={() => { cambiarFormularioObjetivo(false); cambiarIdObjetivoEditando(null); cambiarError("") }}>Cancelar</button></div>
            </form>}

            {formularioAbierto && <form className="formulario-tarea" aria-labelledby="titulo-formulario-tarea" onSubmit={guardar} onKeyDown={evento => { if (evento.key === "Escape") cerrarFormulario() }}>
                <h3 id="titulo-formulario-tarea">{idEditando === null ? "Nueva tarea" : "Editar tarea"}</h3>
                <label><span>Nombre</span><input aria-label="Nombre" autoFocus maxLength={120} value={nombre} onChange={evento => cambiarNombre(evento.target.value)} /></label>
                <label><span>Estado inicial</span><select aria-label="Estado" value={estado} disabled={idEditando !== null} onChange={evento => cambiarEstado(evento.target.value)}>
                    {ESTADOS_TAREA.filter(opcion => opcion !== "En curso" || idEditando === tareaActivaId && idEditando !== null).map(opcion => <option key={opcion} value={opcion}>{opcion}</option>)}
                </select></label>
                <label><span>Destino</span><select aria-label="Destino" value={destino} disabled={idEditando !== null && idEditando === tareaActivaId} onChange={evento => cambiarDestino(evento.target.value)}><option value="backlog">Backlog</option><option value="focus">Cola Focus</option></select></label>
                <label className="tarea-ubicacion"><span>Dentro de</span><select aria-label="Dentro de" value={padreId} disabled={ramaEditandoActiva} onChange={evento => cambiarPadreId(evento.target.value)}>
                    <option value="">Sin objetivo</option>
                    {objetivos.filter(objetivo => objetivo.estado === "Activo" || objetivo.id === tareasPorId.get(idEditando)?.objetivoId).map(objetivo => <option key={objetivo.id} value={objetivo.id}>{objetivo.nombre} · objetivo</option>)}
                    {opcionesPadre.map(tarea => <option key={tarea.id} value={tarea.id}>{obtenerRutaTarea(tareas, objetivos, tarea.id)} · tarea</option>)}
                </select></label>
                {error && <p className="tarea-mensaje-error" role="alert">{error}</p>}
                <div className="tarea-acciones-formulario"><button className="tarea-boton-principal" type="submit">{idEditando === null ? "Guardar tarea" : "Guardar cambios"}</button><button type="button" onClick={cerrarFormulario}>Cancelar</button></div>
            </form>}

            {tareas.length === 0 && objetivos.length === 0 ? <p className="tareas-vacio">{errorCarga ? "No se pueden mostrar los datos guardados." : "Todavía no hay objetivos ni tareas. Creá uno para empezar."}</p> : (
                <div className="arbol-objetivos">
                    {objetivos.map(objetivo => {
                        const hijos = tareas.filter(tarea => tarea.padreId === objetivo.id).sort((a, b) => (a.ordenArbol ?? 0) - (b.ordenArbol ?? 0))
                        const tareasObjetivo = tareas.filter(tarea => tarea.objetivoId === objetivo.id)
                        const tiempoObjetivo = tareasObjetivo.reduce((total, tarea) => total + (tiemposPropios.get(tarea.id) ?? 0), 0)
                        return <section className="objetivo-grupo" key={objetivo.id} aria-labelledby={`objetivo-${objetivo.id}`}>
                            <header><div><h3 id={`objetivo-${objetivo.id}`}>{objetivo.nombre}</h3><small>{objetivo.estado} · Tiempo total: {formatearTiempo(tiempoObjetivo)}</small><small>Tareas: {resumirEstados(tareasObjetivo)}</small></div>
                                <button type="button" aria-expanded={!nodosPlegados.has(objetivo.id)} onClick={() => alternarPliegue(objetivo.id)}>{nodosPlegados.has(objetivo.id) ? "Mostrar tareas" : "Ocultar tareas"}</button>
                                <div className="tarea-acciones"><button type="button" onClick={() => editarObjetivo(objetivo)}>Editar objetivo</button>{objetivo.estado === "Activo" && <><button type="button" onClick={() => cambiarEstadoNodo(objetivo, "Completada")}>Completar objetivo</button><button type="button" onClick={() => cambiarEstadoNodo(objetivo, "Cancelada")}>Cancelar objetivo</button></>}</div>
                            </header>
                            {nodosPlegados.has(objetivo.id) ? null : hijos.length ? <ul className="lista-tareas">{hijos.map(tarea => renderTarea(tarea))}</ul> : <p className="tareas-grupo-vacio">Todavía no tiene tareas.</p>}
                        </section>
                    })}
                    {tareas.some(tarea => !tarea.objetivoId && !tarea.padreId) && <section className="objetivo-grupo objetivo-sin-asignar"><h3>Sin objetivo</h3><ul className="lista-tareas">{tareas.filter(tarea => !tarea.objetivoId && !tarea.padreId).sort((a, b) => (a.ordenArbol ?? 0) - (b.ordenArbol ?? 0)).map(tarea => renderTarea(tarea))}</ul></section>}
                </div>
            )}

            {confirmacion && <div className="dialogo-rama-fondo"><section className="dialogo-rama" role="dialog" aria-modal="true" aria-labelledby="titulo-dialogo-rama">
                <h3 id="titulo-dialogo-rama">{confirmacion.nuevoEstado === "Completada" ? "Completar" : "Cancelar"} {nombreTipo} con subtareas</h3>
                <p>{confirmacion.nuevoEstado === "Completada" ? "¿Querés aplicar el cambio también a las tareas descendientes?" : "¿Qué querés hacer con las tareas descendientes?"} Hay {descendientesConfirmados.length} elemento(s) debajo.</p>
                {hayActivaEnRama && <p role="status">La tarea activa de Focus está protegida; resolvela desde la sesión antes de cambiar toda la rama.</p>}
                <div className="tarea-acciones-formulario">
                    <button type="button" onClick={() => ejecutarEstado("solo")}>{confirmacion.nuevoEstado === "Completada" ? "Completar solo este" : "Cancelar solo este"}</button>
                    <button type="button" disabled={hayActivaEnRama} onClick={() => ejecutarEstado("rama")}>{confirmacion.nuevoEstado === "Completada" ? "Completar toda la rama" : "Cancelar toda la rama"}</button>
                    <button type="button" onClick={() => cambiarConfirmacion(null)}>Volver</button>
                </div>
            </section></div>}
        </section>
    )
}
