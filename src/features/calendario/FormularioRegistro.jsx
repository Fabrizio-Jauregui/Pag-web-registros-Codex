import { useEffect, useRef, useState } from "react"
import { formatearDuracion } from "../../domain/tiempo/CalculosDuracion.js"
import { SelectorOrigenActividad } from "../comun/SelectorOrigenActividad.jsx"

import {
    leerValorFechaHoraLocal,
    obtenerValorFechaHoraLocal
} from "./segmentosCalendario.js"

function obtenerValorFechaHoraEnSegundos(fecha) {
    return obtenerValorFechaHoraLocal(fecha).slice(0, 19)
}

function leerFechaEditada(valor, fechaOriginal) {
    if (fechaOriginal && obtenerValorFechaHoraEnSegundos(fechaOriginal) === valor) {
        return fechaOriginal
    }

    return leerValorFechaHoraLocal(valor)
}

function crearSegmentosIniciales(registro, fechaSeleccionada) {
    if (registro) {
        return registro.segmentos.map(segmento => ({
            tipo: segmento.tipo,
            inicio: obtenerValorFechaHoraEnSegundos(segmento.inicio),
            fin: obtenerValorFechaHoraEnSegundos(segmento.fin),
            inicioOriginal: segmento.inicio,
            finOriginal: segmento.fin
        }))
    }

    const inicio = new Date(fechaSeleccionada)
    inicio.setHours(9, 0, 0, 0)
    const fin = new Date(inicio)
    fin.setMinutes(fin.getMinutes() + 30)

    return [{
        tipo: "En curso",
        inicio: obtenerValorFechaHoraEnSegundos(inicio),
        fin: obtenerValorFechaHoraEnSegundos(fin),
        inicioOriginal: null,
        finOriginal: null
    }]
}

export function FormularioRegistro({
    registro = null,
    fechaSeleccionada,
    eventos,
    tareas = [],
    categorias = [],
    ordenEventos = "ultimo-uso",
    cambiarOrdenEventos = () => {},
    onCrear,
    onEditar,
    onCancelar
}) {
    const [nombre, cambiarNombre] = useState(registro?.nombre ?? "")
    const [eventoId, cambiarEventoId] = useState(registro?.eventoId ?? "")
    const [tareaId, cambiarTareaId] = useState(registro?.tareaId ?? "")
    const [segmentos, cambiarSegmentos] = useState(() => (
        crearSegmentosIniciales(registro, fechaSeleccionada)
    ))
    const [error, cambiarError] = useState("")
    const plantillaRef = useRef(null)
    const tareaRef = useRef(null)
    const nombreRef = useRef(null)
    const inicioRef = useRef(null)
    const finRef = useRef(null)
    const eventoSeleccionado = eventos.find(evento => evento.id === eventoId)
    const tareaSeleccionada = tareas.find(tarea => tarea.id === tareaId)

    useEffect(() => {
        const primerCampo = nombreRef.current?.disabled
            ? inicioRef.current
            : nombreRef.current
        primerCampo?.focus()
    }, [])

    function enfocarCampoDelError(mensaje) {
        const detalle = mensaje.toLocaleLowerCase()

        if (detalle.includes("nombre")) {
            nombreRef.current?.focus()
        } else if (detalle.includes("plantilla")) {
            plantillaRef.current?.focus()
        } else if (detalle.includes("tarea")) {
            tareaRef.current?.focus()
        } else if (detalle.includes("inicio")) {
            inicioRef.current?.focus()
        } else if (
            detalle.includes("fin")
            || detalle.includes("segmento")
            || detalle.includes("durar")
            || detalle.includes("duración")
            || detalle.includes("efectivo")
            || detalle.includes("24 horas")
            || detalle.includes("hora actual")
        ) {
            finRef.current?.focus()
        } else {
            nombreRef.current?.focus()
        }
    }

    function actualizarSegmento(indice, campo, valor) {
        cambiarSegmentos(actuales => actuales.map((segmento, indiceActual) => {
            if (indiceActual === indice) {
                return { ...segmento, [campo]: valor, [`${campo}Original`]: null }
            }

            const segmentoEditado = actuales[indice]
            const comparteLimite = campo === "inicio"
                ? segmento.fin === segmentoEditado.inicio
                : segmentoEditado.fin === segmento.inicio

            if (campo === "inicio" && indiceActual === indice - 1 && comparteLimite) {
                return { ...segmento, fin: valor, finOriginal: null }
            }

            if (campo === "fin" && indiceActual === indice + 1 && comparteLimite) {
                return { ...segmento, inicio: valor, inicioOriginal: null }
            }

            return segmento
        }))
        cambiarError("")
    }

    function agregarPausa(indice) {
        const segmento = segmentos[indice]
        const inicio = leerValorFechaHoraLocal(segmento.inicio)
        const fin = leerValorFechaHoraLocal(segmento.fin)
        const duracion = inicio && fin ? fin.getTime() - inicio.getTime() : 0
        if (segmento.tipo !== "En curso" || duracion < 3000) {
            cambiarError("Para agregar una pausa, el tramo en curso debe durar al menos tres segundos.")
            return
        }
        const duracionPausa = Math.min(60_000, Math.floor((duracion - 2000) / 3))
        const duracionActiva = duracion - duracionPausa
        const duracionActivaInicial = Math.floor(duracionActiva / 2)
        const inicioPausa = new Date(inicio.getTime() + duracionActivaInicial)
        const finPausa = new Date(inicioPausa.getTime() + duracionPausa)
        const valor = fecha => obtenerValorFechaHoraLocal(fecha).slice(0, 19)
        cambiarSegmentos(actuales => [
            ...actuales.slice(0, indice),
            { tipo: "En curso", inicio: segmento.inicio, fin: valor(inicioPausa), inicioOriginal: segmento.inicioOriginal, finOriginal: null },
            { tipo: "Pausado", inicio: valor(inicioPausa), fin: valor(finPausa), inicioOriginal: null, finOriginal: null },
            { tipo: "En curso", inicio: valor(finPausa), fin: segmento.fin, inicioOriginal: null, finOriginal: segmento.finOriginal },
            ...actuales.slice(indice + 1)
        ])
        cambiarError("")
    }

    function resolverPausa(indice, contarComoActividad) {
        cambiarSegmentos(actuales => {
            const anterior = actuales[indice - 1]
            const siguiente = actuales[indice + 1]
            if (anterior?.tipo !== "En curso") return actuales

            if (!contarComoActividad) {
                return [...actuales.slice(0, indice), ...actuales.slice(indice + 1)]
            }

            if (siguiente?.tipo !== "En curso") {
                return [
                    ...actuales.slice(0, indice - 1),
                { tipo: "En curso", inicio: anterior.inicio, fin: actuales[indice].fin, inicioOriginal: anterior.inicioOriginal, finOriginal: actuales[indice].finOriginal },
                    ...actuales.slice(indice + 1)
                ]
            }

            return [
                ...actuales.slice(0, indice - 1),
                { tipo: "En curso", inicio: anterior.inicio, fin: siguiente.fin, inicioOriginal: anterior.inicioOriginal, finOriginal: siguiente.finOriginal },
                ...actuales.slice(indice + 2)
            ]
        })
        cambiarError("")
    }

    function guardar(evento) {
        evento.preventDefault()

        if (Boolean(eventoId) === Boolean(tareaId)) {
            const mensaje = "Elegí una plantilla de evento o una tarea para el registro."
            cambiarError(mensaje)
            plantillaRef.current?.focus()
            return
        }

        if (eventoId && !eventoSeleccionado) {
            const mensaje = "La plantilla seleccionada ya no está disponible. Elegí otra o quitá la selección."
            cambiarError(mensaje)
            plantillaRef.current?.focus()
            return
        }

        if (tareaId && !tareaSeleccionada) {
            const mensaje = "La tarea seleccionada ya no está disponible. Elegí otra o quitá la selección."
            cambiarError(mensaje)
            tareaRef.current?.focus()
            return
        }

        const segmentosConvertidos = segmentos.map((segmento, indice) => ({
            tipo: segmento.tipo,
            inicio: leerFechaEditada(segmento.inicio, segmento.inicioOriginal !== undefined ? segmento.inicioOriginal : registro?.segmentos[indice]?.inicio),
            fin: leerFechaEditada(segmento.fin, segmento.finOriginal !== undefined ? segmento.finOriginal : registro?.segmentos[indice]?.fin)
        }))

        let resultado

        if (registro) {
            resultado = onEditar(registro.id, {
                nombre,
                evento: eventoSeleccionado ?? null,
                tarea: tareaSeleccionada ?? null,
                segmentos: segmentosConvertidos
            })
        } else {
            resultado = onCrear({
                nombre,
                evento: eventoSeleccionado ?? null,
                tarea: tareaSeleccionada ?? null,
                inicio: segmentosConvertidos[0].inicio,
                fin: segmentosConvertidos.at(-1).fin,
                segmentos: segmentosConvertidos
            })
        }

        if (!resultado.ok) {
            cambiarError(resultado.error)
            enfocarCampoDelError(resultado.error)
            return
        }

        onCancelar()
    }

    function manejarTeclaFormulario(evento) {
        if (evento.key === "Escape") {
            evento.preventDefault()
            onCancelar()
        }
    }

    return (
        <section className="formulario-registro" aria-labelledby="titulo-formulario-registro">
            <h3 id="titulo-formulario-registro">
                {registro ? "Editar registro finalizado" : "Nuevo registro manual"}
            </h3>
            <form
                aria-labelledby="titulo-formulario-registro"
                onSubmit={guardar}
                onKeyDown={manejarTeclaFormulario}
            >
                <SelectorOrigenActividad
                    tipo="evento"
                    etiqueta="Plantilla de evento"
                    opciones={eventos}
                    categorias={categorias}
                    value={eventoId}
                    missingName={registro?.nombre}
                    ref={plantillaRef}
                    disabled={Boolean(tareaId)}
                    ordenEventos={ordenEventos}
                    cambiarOrdenEventos={cambiarOrdenEventos}
                    onChange={opcion => {
                        const nuevoId = opcion?.id ?? ""
                        const eventoPrevio = eventos.find(evento => evento.id === eventoId)
                        cambiarEventoId(nuevoId)
                        if (nuevoId) cambiarTareaId("")
                        cambiarNombre(opcion?.nombre ?? (nuevoId ? "" : eventoPrevio?.nombre ?? ""))
                        cambiarError("")
                    }}
                />

                <SelectorOrigenActividad
                    tipo="tarea"
                    etiqueta="Tarea"
                    opciones={tareas}
                    value={tareaId}
                    missingName={registro?.tareaNombre}
                    ref={tareaRef}
                    disabled={Boolean(eventoId)}
                    emptyLabel="Elegí una tarea"
                    onChange={opcion => {
                        const nuevoId = opcion?.id ?? ""
                        cambiarTareaId(nuevoId)
                        if (nuevoId) cambiarEventoId("")
                        cambiarNombre(opcion?.nombre ?? "")
                        cambiarError("")
                    }}
                />

                <label>
                    <span>Nombre del registro</span>
                    <input
                        type="text"
                        ref={nombreRef}
                        value={eventoSeleccionado?.nombre ?? tareaSeleccionada?.nombre ?? nombre}
                        placeholder="Se completa al elegir un evento o una tarea"
                        readOnly
                        disabled={!eventoSeleccionado && !tareaSeleccionada}
                        maxLength={80}
                    />
                </label>

                {segmentos.map((segmento, indice) => (
                    <div className="grupo-segmento-registro" key={`${registro?.id ?? "nuevo"}-${indice}`}>
                        {indice > 0 && (() => {
                            const anterior = segmentos[indice - 1]
                            const finAnterior = leerValorFechaHoraLocal(anterior.fin)
                            const inicioActual = leerValorFechaHoraLocal(segmento.inicio)
                            const huecoMs = finAnterior && inicioActual ? inicioActual.getTime() - finAnterior.getTime() : 0
                            return huecoMs > 0 && <p className="registro-intervalo-sin-clasificar" role="status">
                                Intervalo sin registrar: {formatearDuracion(Math.floor(huecoMs / 1000))}
                            </p>
                        })()}
                        <fieldset className="formulario-segmento">
                            <legend>Segmento {indice + 1}: {segmento.tipo === "Pausado" ? "En pausa" : segmento.tipo}</legend>
                            <label>
                                <span>Inicio{segmentos.length > 1 && ` · Segmento ${indice + 1}`}</span>
                                <input
                                    type="datetime-local"
                                    ref={indice === 0 ? inicioRef : undefined}
                                    step="1"
                                    value={segmento.inicio}
                                    onChange={cambio => actualizarSegmento(indice, "inicio", cambio.target.value)}
                                    required
                                />
                            </label>
                            <label>
                                <span>Fin{segmentos.length > 1 && ` · Segmento ${indice + 1}`}</span>
                                <input
                                    type="datetime-local"
                                    ref={indice === 0 ? finRef : undefined}
                                    step="1"
                                    value={segmento.fin}
                                    onChange={cambio => actualizarSegmento(indice, "fin", cambio.target.value)}
                                    required
                                />
                            </label>
                            {segmento.tipo === "En curso" && (
                                <button type="button" className="boton-agregar-pausa" onClick={() => agregarPausa(indice)}>
                                    Agregar pausa después de este tramo
                                </button>
                            )}
                            {segmento.tipo === "Pausado" && (
                                <div className="opciones-quitar-pausa" role="group" aria-label={`Opciones para quitar la pausa ${indice + 1}`}>
                                    <span>Al quitarla:</span>
                                    <button type="button" className="boton-quitar-pausa" onClick={() => resolverPausa(indice, true)}>
                                        Contar este tiempo como actividad
                                    </button>
                                    <button type="button" className="boton-quitar-pausa" onClick={() => resolverPausa(indice, false)}>
                                        Quitar sin contar este tiempo
                                    </button>
                                </div>
                            )}
                        </fieldset>
                    </div>
                ))}

                {error && <p className="mensaje-formulario-registro" role="alert">{error}</p>}

                <div className="acciones-formulario-registro">
                    <button type="submit">{registro ? "Guardar cambios" : "Crear registro"}</button>
                    <button type="button" onClick={onCancelar}>Cancelar</button>
                </div>
            </form>
        </section>
    )
}
