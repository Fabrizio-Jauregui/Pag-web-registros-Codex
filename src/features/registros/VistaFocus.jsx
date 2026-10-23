import { useEffect, useState } from "react"

import { formatearDuracion } from "../../domain/tiempo/CalculosDuracion.js"
import { crearBloquesFocus, useSesionFocus } from "./usoSesionFocus.js"
import { ControlesRegistro } from "./ControlesRegistro.jsx"
import { ListaRegistrosActivos } from "./ListaRegistrosActivos.jsx"
import "./VistaFocus.css"

function duracionVisible(ms) {
    if (ms === null || !Number.isFinite(ms)) return "--:--"
    const segundos = Math.max(0, Math.ceil(ms / 1000))
    const horas = Math.floor(segundos / 3600)
    const minutos = Math.floor((segundos % 3600) / 60)
    const resto = segundos % 60
    const mm = String(minutos).padStart(2, "0")
    const ss = String(resto).padStart(2, "0")
    return horas > 0 ? String(horas).padStart(2, "0") + ":" + mm + ":" + ss : mm + ":" + ss
}

function etiquetaEstado(estado) {
    return ({
        concentracion: "Concentración",
        descanso: "Descanso",
        "tiempo-muerto": "Tiempo muerto",
        "esperando-concentracion": "Esperando para concentrarse",
        pausada: "Sesión pausada"
    })[estado] ?? estado
}

export function VistaFocus({ estadoRegistro, eventos = [], tareas = [], onCrearTarea, onActualizarTarea, onReordenarTarea, onPosponerTarea, onEstadoSesionChange, onRegistrarInicioPlanificado, onPlantillasChange, vistaActiva = true }) {
    const [nombreSesion, cambiarNombreSesion] = useState("Sesión Focus")
    const [usarColaFocus, cambiarUsarColaFocus] = useState(false)
    const [nombreActividadIndependiente, cambiarNombreActividadIndependiente] = useState("")
    const [eventoIndependienteId, cambiarEventoIndependienteId] = useState("")
    const [tareaIndependienteId, cambiarTareaIndependienteId] = useState("")
    const [pares, cambiarPares] = useState(4)
    const [minutosConcentracion, cambiarMinutosConcentracion] = useState(25)
    const [minutosDescanso, cambiarMinutosDescanso] = useState(5)
    const [colores, cambiarColores] = useState({
        concentracion: "#6366f1",
        descanso: "#10b981",
        pausa: "#f59e0b",
        tiempoMuerto: "#ef4444"
    })
    const [bloques, cambiarBloques] = useState([])
    const [bloquesConfirmados, cambiarBloquesConfirmados] = useState(false)
    const [nombrePlantilla, cambiarNombrePlantilla] = useState("")
    const [errorConfiguracion, cambiarErrorConfiguracion] = useState("")
    const [nombreTareaNueva, cambiarNombreTareaNueva] = useState("")
    const [destinoTareaNueva, cambiarDestinoTareaNueva] = useState("focus")
    const [errorTareaFocus, cambiarErrorTareaFocus] = useState("")
    const focus = useSesionFocus(estadoRegistro, tareas, {
        onCrearTarea,
        onActualizarTarea,
        onPosponerTarea,
        onEstadoSesionChange,
    })
    useEffect(() => { onPlantillasChange?.(focus.plantillas) }, [focus.plantillas, onPlantillasChange])
    onRegistrarInicioPlanificado?.(configuracion => focus.iniciar({
        nombre: configuracion.nombre,
        usarColaFocus: Boolean(configuracion.usarColaFocus),
        bloques: configuracion.bloques,
        colores: configuracion.colores
    }))
    const { datos, registrosActivos } = estadoRegistro
    const idsRegistrosGuardados = new Set(estadoRegistro.registros.map(registro => registro.id))
    const sesionesFocusVisibles = focus.historial.filter(item => {
        const ids = item.registroIds ?? (item.registroId ? [item.registroId] : [])
        return ids.length === 0 || ids.some(id => idsRegistrosGuardados.has(id))
    })
    const sesion = focus.sesion
    const hayConcentracionActiva = sesion?.estado === "concentracion" || estadoRegistro.registros.some(registro => registro.origenFocus === true && registro.estado === "En curso")
    const configuracion = sesion?.configuracion
    const independientes = registrosActivos.filter(registro => registro.id !== sesion?.registroId)
    const totalMinutos = bloques.reduce((total, bloque) => total + (Number(bloque.minutos) || 0), 0)
    const eventoIndependiente = eventos.find(evento => evento.id === eventoIndependienteId) ?? null
    const tareaIndependiente = tareas.find(tarea => tarea.id === tareaIndependienteId) ?? null
    const colaFocus = tareas.filter(tarea => tarea.destino === "focus"
        && !["Boceto", "Completada", "Cancelada"].includes(tarea.estado))
        .sort((a, b) => (a.ordenFocus ?? Number.MAX_SAFE_INTEGER) - (b.ordenFocus ?? Number.MAX_SAFE_INTEGER))
    const tareaFocusActiva = colaFocus.find(tarea => tarea.id === sesion?.tareaActivaId) ?? null

    function iniciarActividadIndependiente() {
        if (estadoRegistro.iniciar(nombreActividadIndependiente, eventoIndependiente, tareaIndependiente)) {
            cambiarNombreActividadIndependiente("")
            cambiarEventoIndependienteId("")
            cambiarTareaIndependienteId("")
        }
    }

    function generarBloques() {
        const resultado = crearBloquesFocus(Number(pares), Number(minutosConcentracion), Number(minutosDescanso))
        if (!resultado.ok) {
            cambiarErrorConfiguracion(resultado.error)
            return
        }
        cambiarBloques(resultado.bloques)
        cambiarBloquesConfirmados(false)
        cambiarErrorConfiguracion("")
        focus.limpiarError()
    }

    function actualizarBloque(indice, campo, valor) {
        cambiarBloques(actuales => actuales.map((bloque, i) => i === indice
            ? { ...bloque, [campo]: campo === "minutos" ? Number(valor) : valor }
            : bloque))
        cambiarBloquesConfirmados(false)
    }

    function cargarPlantilla(plantilla) {
        const config = plantilla.configuracion
        cambiarNombreSesion(config.nombre)
        cambiarUsarColaFocus(Boolean(config.usarColaFocus))
        cambiarBloques(config.bloques.map(bloque => ({ ...bloque })))
        cambiarPares(Math.max(1, Math.ceil(config.bloques.length / 2)))
        cambiarMinutosConcentracion(config.bloques.find(bloque => bloque.tipo === "concentracion")?.minutos ?? 25)
        cambiarMinutosDescanso(config.bloques.find(bloque => bloque.tipo === "descanso")?.minutos ?? 5)
        if (config.colores) cambiarColores(actuales => ({ ...actuales, ...config.colores }))
        cambiarBloquesConfirmados(false)
        focus.limpiarError()
    }

    function iniciarSesion() {
        focus.iniciar({
            nombre: nombreSesion,
            tarea: null,
            usarColaFocus,
            bloques,
            colores
        })
    }

    function guardarPlantilla() {
        const config = {
            nombre: nombreSesion.trim() || "Sesión Focus",
            usarColaFocus,
            bloques: bloques.map(bloque => ({ ...bloque })),
            colores
        }
        if (focus.guardarPlantilla(nombrePlantilla, config)) cambiarNombrePlantilla("")
    }

    function crearTareaEnSesion(evento) {
        evento.preventDefault()
        const resultado = focus.crearTareaDuranteSesion(nombreTareaNueva, destinoTareaNueva)
        if (resultado?.ok) {
            cambiarNombreTareaNueva("")
            cambiarErrorTareaFocus("")
        } else {
            cambiarErrorTareaFocus(resultado?.error ?? "No se pudo crear la tarea.")
        }
    }

    const progreso = sesion && configuracion?.bloques.length
        ? ((sesion.indiceBloque + 1) / configuracion.bloques.length) * 100
        : 0

    return (
        <section className="vista-focus" aria-labelledby="titulo-focus">
            {vistaActiva && <header className="focus-cabecera">
                <p className="focus-etiqueta">SESIÓN DE ENFOQUE</p>
                <h2 id="titulo-focus">Focus</h2>
                <p>Solo se registra el tiempo de concentración. Otras actividades pueden correr durante los descansos y el tiempo muerto, pero no durante la concentración.</p>
            </header>}

            {vistaActiva && (datos.advertencia || !datos.ok) && (
                <p className="focus-mensaje-error" role="alert">{datos.ok ? datos.advertencia : datos.error}</p>
            )}
            {vistaActiva && estadoRegistro.error && <p className="focus-mensaje-error" role="alert">{estadoRegistro.error}</p>}
            {vistaActiva && focus.error && <p className="focus-mensaje-error" role="alert">{focus.error}</p>}
            {vistaActiva && errorConfiguracion && <p className="focus-mensaje-error" role="alert">{errorConfiguracion}</p>}

            {vistaActiva && <section className="focus-iniciar focus-iniciar-independiente" aria-labelledby="titulo-actividad-independiente">
                <div>
                    <h3 id="titulo-actividad-independiente">Iniciar actividad independiente</h3>
                    <p>Este registro corre por separado y no cambia los bloques ni los controles de la sesión Focus.</p>
                </div>
                <ControlesRegistro
                    idPrefix="focus-independiente"
                    nombre={nombreActividadIndependiente}
                    cambiarNombre={cambiarNombreActividadIndependiente}
                    eventos={eventos}
                    tareas={tareas}
                    eventoId={eventoIndependienteId}
                    cambiarEventoId={nuevoId => {
                        cambiarEventoIndependienteId(nuevoId)
                        const seleccionado = eventos.find(evento => evento.id === nuevoId)
                        cambiarNombreActividadIndependiente(seleccionado?.nombre ?? "")
                    }}
                    tareaId={tareaIndependienteId}
                    cambiarTareaId={cambiarTareaIndependienteId}
                    estado="Inactivo"
                    manejarPlay={iniciarActividadIndependiente}
                    manejarPause={() => {}}
                    manejarStop={() => {}}
                    puedeDetener={false}
                    bloqueado={!datos.ok || hayConcentracionActiva}
                />
                {hayConcentracionActiva && <p role="status">Durante la concentración no se pueden iniciar otras actividades. Podrás hacerlo durante un descanso o el tiempo muerto.</p>}
            </section>}

            {vistaActiva && sesion ? (
                <section className="focus-sesion-activa" aria-labelledby="titulo-sesion-activa">
                    <div className="focus-sesion-cabecera">
                        <div>
                            <p className="focus-etiqueta">SESIÓN EN CURSO</p>
                            <h3 id="titulo-sesion-activa">{configuracion.nombre}</h3>
                            <p>Registro de concentración: <strong>{tareaFocusActiva?.rutaNombre ?? tareaFocusActiva?.nombre ?? "Concentración"}</strong></p>
                            {configuracion.usarColaFocus
                                && <p>{tareaFocusActiva ? <>Tarea activa: <strong>{tareaFocusActiva.rutaNombre ?? tareaFocusActiva.nombre}</strong></> : "Sin tarea activa · se registra como Concentración"}</p>}
                        </div>
                        <span className={"focus-estado focus-estado-" + sesion.estado}>{etiquetaEstado(sesion.estado)}</span>
                    </div>
                    {sesion.estado === "esperando-concentracion" ? (
                        <div className="focus-temporizador" role="status" aria-live="polite">
                            <span>Concentración en espera</span>
                            <strong>—</strong>
                            <span>Finalizá o pausá las actividades que siguen en curso para iniciar este bloque.</span>
                        </div>
                    ) : <div className="focus-temporizador" aria-live="off">
                        <span>{sesion.estado === "tiempo-muerto" ? "Tiempo desde el fin del descanso" : "Tiempo restante del bloque"}</span>
                        <strong>{duracionVisible(sesion.estado === "tiempo-muerto" ? focus.tiempoMuertoMs : focus.restanteMs)}</strong>
                        <span>{sesion.estado === "tiempo-muerto" ? "El descanso terminó; el excedente no suma a la tarea." : focus.bloqueActual?.nombre}</span>
                    </div>}
                    {sesion.estado === "descanso" && (
                        <label className="focus-check-auto">
                            <input
                                type="checkbox"
                                checked={Boolean(sesion.avanzarAutomaticamente)}
                                onChange={evento => focus.cambiarAvanceAutomatico(evento.target.checked)}
                            />
                            Avanzar automáticamente al terminar los descansos de esta sesión
                        </label>
                    )}
                    <div className="focus-progreso" role="progressbar" aria-label="Progreso de bloques" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progreso)}>
                        <span style={{ width: progreso + "%" }} />
                    </div>
                    <p className="focus-posicion-bloque">Bloque {sesion.indiceBloque + 1} de {configuracion.bloques.length} · inicio {new Date(sesion.inicio).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    <ol className="focus-lista-bloques" aria-label="Secuencia de bloques">
                        {configuracion.bloques.map((bloque, indice) => (
                            <li key={indice} style={{ "--focus-block-color": configuracion.colores?.[bloque.tipo] }} className={bloque.tipo + (indice === sesion.indiceBloque ? " actual" : "") + (indice < sesion.indiceBloque ? " completado" : "")}>
                                <span>{bloque.nombre}</span><span>{bloque.minutos} min</span>
                            </li>
                        ))}
                    </ol>
                    {configuracion.usarColaFocus && (
                        <section className="focus-cola-activa" aria-labelledby="titulo-cola-focus-activa">
                            <header>
                                <div><h4 id="titulo-cola-focus-activa">Cola Focus</h4><p>La tarea activa permanece fija; podés reordenar las que esperan.</p></div>
                            </header>
                            {colaFocus.length === 0
                                ? <p className="focus-cola-vacia">Cola vacía. El bloque se registra como Concentración.</p>
                                : <ol className="focus-cola-lista">{colaFocus.map((tarea, indice) => {
                                    const activa = tarea.id === sesion.tareaActivaId
                                    const primerMovible = sesion.tareaActivaId ? Math.max(1, colaFocus.findIndex(item => item.id === sesion.tareaActivaId) + 1) : 0
                                    return <li key={tarea.id} className={activa ? "activa" : ""}>
                                        <span className="focus-cola-numero">{indice + 1}</span>
                                        <span className="focus-cola-nombre">{tarea.rutaNombre ?? tarea.nombre}<small>{activa ? "Activa" : tarea.estado}</small></span>
                                        {!activa && <>
                                            <button type="button" aria-label={`Subir ${tarea.nombre}`} disabled={indice <= primerMovible} onClick={() => onReordenarTarea?.(tarea.id, -1, sesion.tareaActivaId)}>↑</button>
                                            <button type="button" aria-label={`Bajar ${tarea.nombre}`} disabled={indice < primerMovible || indice === colaFocus.length - 1} onClick={() => onReordenarTarea?.(tarea.id, 1, sesion.tareaActivaId)}>↓</button>
                                        </>}
                                    </li>
                                })}</ol>}
                            <div className="focus-acciones-tarea-activa">
                                <button type="button" disabled={!sesion.tareaActivaId} onClick={focus.completarTareaActiva}>Finalicé esta tarea</button>
                                <button type="button" disabled={!sesion.tareaActivaId || colaFocus.length < 2} onClick={() => focus.posponerTareaActiva("despues-siguiente")}>Posponer después de la siguiente</button>
                                <button type="button" disabled={!sesion.tareaActivaId || colaFocus.length < 2} onClick={() => focus.posponerTareaActiva("final")}>Enviar al final</button>
                            </div>
                            <form className="focus-agregar-tarea" onSubmit={crearTareaEnSesion}>
                                <label>Nueva tarea
                                    <input value={nombreTareaNueva} onChange={evento => cambiarNombreTareaNueva(evento.target.value)} maxLength={120} placeholder="¿Qué querés hacer después?" />
                                </label>
                                <label>Destino
                                    <select value={destinoTareaNueva} onChange={evento => cambiarDestinoTareaNueva(evento.target.value)}>
                                        <option value="focus">Cola Focus</option>
                                        <option value="backlog">Backlog</option>
                                    </select>
                                </label>
                                <button type="submit">Agregar tarea</button>
                                {errorTareaFocus && <p role="alert">{errorTareaFocus}</p>}
                            </form>
                        </section>
                    )}
                    <div className="focus-acciones-sesion">
                        {sesion.estado === "esperando-concentracion" ? null : sesion.estado === "pausada"
                            ? <button type="button" onClick={focus.reanudarSesion}>Reanudar sesión</button>
                            : <button type="button" onClick={focus.pausarSesion}>Pausar sesión</button>}
                        {!sesion.avanzarAutomaticamente && ["descanso", "tiempo-muerto"].includes(sesion.estado) && (
                            <button type="button" className="focus-accion-principal" onClick={focus.confirmarSiguiente}>Continuar con concentración</button>
                        )}
                        <button type="button" className="focus-accion-finalizar" onClick={focus.finalizarSesion}>Finalizar sesión</button>
                    </div>
                    <p className="focus-ayuda-paralelo">Pausar o finalizar esta sesión afecta únicamente a su actividad vinculada.</p>
                </section>
            ) : vistaActiva ? (
                <section className="focus-configuracion" aria-labelledby="titulo-config-focus">
                    <div>
                        <h3 id="titulo-config-focus">Preparar sesión</h3>
                        <p>Definí los pares de concentración y descanso; después podés ajustar cada bloque por separado.</p>
                    </div>
                    <div className="focus-form-grid">
                        <label>Nombre de la sesión
                            <input value={nombreSesion} onChange={evento => cambiarNombreSesion(evento.target.value)} maxLength={100} />
                        </label>
                        <label className="focus-vincular-cola">
                            <input type="checkbox" checked={usarColaFocus} onChange={evento => cambiarUsarColaFocus(evento.target.checked)} />
                            Usar Cola Focus para asignar las tareas de cada concentración
                        </label>
                        <label>Pares de bloques
                            <select value={pares} onChange={evento => cambiarPares(Number(evento.target.value))}>
                                {Array.from({ length: 8 }, (_, indice) => <option key={indice + 1} value={indice + 1}>{indice + 1}</option>)}
                            </select>
                        </label>
                        <label>Concentración inicial (min)
                            <input type="number" min="1" max="180" value={minutosConcentracion} onChange={evento => cambiarMinutosConcentracion(evento.target.value)} />
                        </label>
                        <label>Descanso inicial (min)
                            <input type="number" min="1" max="60" value={minutosDescanso} onChange={evento => cambiarMinutosDescanso(evento.target.value)} />
                        </label>
                    </div>
                    <fieldset className="focus-colores">
                        <legend>Colores de los estados</legend>
                        {[
                            ["concentracion", "Concentración"],
                            ["descanso", "Descanso"],
                            ["pausa", "Pausa de sesión"],
                            ["tiempoMuerto", "Tiempo muerto"]
                        ].map(([clave, etiqueta]) => (
                            <label key={clave}>
                                <input type="color" aria-label={"Color de " + etiqueta.toLowerCase()} value={colores[clave]} onChange={evento => cambiarColores(actuales => ({ ...actuales, [clave]: evento.target.value }))} />
                                {etiqueta}
                            </label>
                        ))}
                    </fieldset>
                    <button type="button" onClick={generarBloques}>Generar bloques</button>

                    {bloques.length > 0 && (
                        <div className="focus-bloques-config">
                            <div className="focus-bloques-titulo">
                                <div><h4>Secuencia</h4><p>{bloques.length} bloques · {formatearDuracion(totalMinutos * 60_000)} en total</p></div>
                                {bloquesConfirmados && <button type="button" className="focus-boton-secundario" onClick={() => cambiarBloquesConfirmados(false)}>Editar bloques</button>}
                            </div>
                            <ol className="focus-lista-bloques focus-lista-edicion">
                                {bloques.map((bloque, indice) => (
                                    <li key={indice} style={{ "--focus-block-color": colores[bloque.tipo] }} className={bloque.tipo}>
                                        <label>Bloque {indice + 1}
                                            <input value={bloque.nombre} disabled={bloquesConfirmados} onChange={evento => actualizarBloque(indice, "nombre", evento.target.value)} maxLength={80} />
                                        </label>
                                        <label>Duración (min)
                                            <input type="number" min="1" max={bloque.tipo === "concentracion" ? 180 : 60} value={bloque.minutos} disabled={bloquesConfirmados} onChange={evento => actualizarBloque(indice, "minutos", evento.target.value)} />
                                        </label>
                                        <span>{bloque.tipo === "concentracion" ? "Concentración" : "Descanso"}</span>
                                    </li>
                                ))}
                            </ol>
                            {!bloquesConfirmados ? (
                                <button type="button" className="focus-accion-principal" onClick={() => cambiarBloquesConfirmados(true)}>Confirmar bloques</button>
                            ) : (
                                <div className="focus-plantilla-guardar">
                                    <label>Nombre para guardar plantilla
                                        <input value={nombrePlantilla} onChange={evento => cambiarNombrePlantilla(evento.target.value)} placeholder="Ej.: Lectura y pausas" maxLength={80} />
                                    </label>
                                    <button type="button" className="focus-boton-secundario" onClick={guardarPlantilla} disabled={!nombrePlantilla.trim()}>Guardar plantilla</button>
                                    <button type="button" className="focus-accion-principal" onClick={iniciarSesion} disabled={!datos.ok || totalMinutos > 1440}>Iniciar sesión Focus</button>
                                </div>
                            )}
                        </div>
                    )}
                    {bloques.length > 0 && totalMinutos > 1440 && <p className="focus-mensaje-error" role="alert">La secuencia supera las 24 horas admitidas por el registro.</p>}
                </section>
            ) : null}

            {vistaActiva && !sesion && focus.plantillas.length > 0 && (
                <section className="focus-panel-lista" aria-labelledby="titulo-plantillas-focus">
                    <h3 id="titulo-plantillas-focus">Plantillas de sesión</h3>
                    <ul>{focus.plantillas.map(plantilla => (
                        <li key={plantilla.id}>
                            <div><strong>{plantilla.nombrePlantilla}</strong><span>{plantilla.configuracion.bloques.length} bloques · {plantilla.configuracion.nombre}</span></div>
                            <button type="button" onClick={() => cargarPlantilla(plantilla)}>Cargar</button>
                            <button type="button" className="focus-boton-secundario" aria-label={"Eliminar plantilla " + plantilla.nombrePlantilla} onClick={() => focus.eliminarPlantilla(plantilla.id)}>Eliminar</button>
                        </li>
                    ))}</ul>
                </section>
            )}

            {vistaActiva && (independientes.length > 0 ? (
                <ListaRegistrosActivos registros={independientes} estadoRegistro={estadoRegistro}
                    titulo={(sesion ? "Actividades independientes · " : "En curso o en pausa · ") + independientes.length}
                    className="focus-registros-activos" />
            ) : (
                <section className="focus-sin-sesiones" aria-live="polite">
                    <span aria-hidden="true">◷</span>
                    <h3>{sesion ? "Sin otras actividades en paralelo" : "No hay actividades activas"}</h3>
                    <p>{sesion ? "Las actividades independientes aparecerán acá y conservarán sus propios controles." : "Al iniciar Focus, el tiempo de concentración quedará registrado en el calendario y el historial."}</p>
                </section>
            ))}

            {vistaActiva && sesionesFocusVisibles.length > 0 && (
                <section className="focus-panel-lista" aria-labelledby="titulo-historial-focus">
                    <h3 id="titulo-historial-focus">Sesiones guardadas</h3>
                    <p>Este listado resume las sesiones que todavía tienen registros asociados. Los registros se editan y eliminan desde la sección Historial.</p>
                    <ul>{sesionesFocusVisibles.map(item => (
                        <li key={item.id} className="focus-item-historial">
                            <div>
                                <strong>{item.configuracion.nombre}</strong>
                                <span>{new Date(item.inicio).toLocaleString()} · {item.bloques.filter(bloque => bloque.fin).length} bloques completados · tiempo de concentración registrado</span>
                            </div>
                            <details><summary>Ver bloques e intervalos</summary>
                                <ol>{item.bloques.map((bloque, indice) => (
                                    <li key={indice}>{bloque.nombre} · {bloque.minutos} min{bloque.inicio && bloque.fin
                                        ? " · " + new Date(bloque.inicio).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + "–" + new Date(bloque.fin).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                        : " · no iniciado"}</li>
                                ))}</ol>
                                {item.extras?.length > 0 && (
                                    <div className="focus-extra-historial">
                                        <strong>Tiempo muerto y pausas de sesión</strong>
                                        <ul>{item.extras.map((extra, indice) => (
                                            <li key={indice}>
                                                {extra.tipo === "tiempo-muerto" ? "Tiempo muerto" : "Pausa de sesión"}
                                                {" · " + formatearDuracion(Date.parse(extra.fin) - Date.parse(extra.inicio))}
                                                {" · " + new Date(extra.inicio).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + "–" + new Date(extra.fin).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </li>
                                        ))}</ul>
                                    </div>
                                )}
                            </details>
                        </li>
                    ))}</ul>
                </section>
            )}
        </section>
    )
}
