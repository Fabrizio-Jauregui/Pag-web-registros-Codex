import { useEffect, useRef, useState } from "react"

import { COLOR_EVENTO_PREDETERMINADO } from "../../domain/eventos/eventos.js"
import "./BibliotecaEventos.css"

export function BibliotecaEventos({
    plantillas,
    categorias = [],
    errorCategorias = "",
    errorCarga = "",
    onCrear,
    onActualizar,
    onEliminar
}) {
    const [formularioAbierto, cambiarFormularioAbierto] = useState(false)
    const [idEditando, cambiarIdEditando] = useState(null)
    const [nombre, cambiarNombre] = useState("")
    const [color, cambiarColor] = useState(COLOR_EVENTO_PREDETERMINADO)
    const [categoriaId, cambiarCategoriaId] = useState("")
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
            const destino = focoAlCerrarRef.current?.isConnected
                ? focoAlCerrarRef.current
                : botonCrearRef.current
            destino?.focus()
            focoAlCerrarRef.current = null
        }
    }, [formularioAbierto, idEditando])

    function abrirNuevaPlantilla(evento) {
        focoAlCerrarRef.current = evento.currentTarget
        cambiarIdEditando(null)
        cambiarNombre("")
        cambiarColor(COLOR_EVENTO_PREDETERMINADO)
        cambiarCategoriaId("")
        cambiarError("")
        cambiarFormularioAbierto(true)
    }

    function abrirEdicion(plantilla, evento) {
        focoAlCerrarRef.current = evento.currentTarget
        cambiarIdEditando(plantilla.id)
        cambiarNombre(plantilla.nombre)
        cambiarColor(plantilla.color)
        cambiarCategoriaId(plantilla.categoriaId ?? "")
        cambiarError("")
        cambiarFormularioAbierto(true)
    }

    function cancelarFormulario() {
        cambiarFormularioAbierto(false)
        cambiarIdEditando(null)
        cambiarError("")
    }

    function manejarTeclaFormulario(evento) {
        if (evento.key === "Escape") {
            evento.preventDefault()
            cancelarFormulario()
        }
    }

    function guardarPlantilla(evento) {
        evento.preventDefault()

        const resultado = idEditando === null
            ? onCrear(nombre, color, categoriaId || null)
            : onActualizar(idEditando, nombre, color, categoriaId || null)

        if (!resultado.ok) {
            cambiarError(resultado.error)
            return
        }

        cancelarFormulario()
    }

    function eliminarPlantilla(plantilla) {
        const confirmado = window.confirm(
            `¿Querés eliminar el evento "${plantilla.nombre}"?`
        )

        if (!confirmado) {
            return
        }

        const resultado = onEliminar(plantilla.id)

        if (!resultado.ok) {
            cambiarError(resultado.error)
        } else {
            cambiarError("")
        }
    }

    return (
        <section className="biblioteca-eventos" aria-labelledby="titulo-eventos">
            <header className="biblioteca-eventos-header">
                <div>
                    <h2 id="titulo-eventos">Eventos</h2>
                    <p>Plantillas reutilizables para tus actividades.</p>
                </div>
                {!formularioAbierto && (
                    <button
                        type="button"
                        className="boton-crear-evento"
                        onClick={abrirNuevaPlantilla}
                        ref={botonCrearRef}
                        disabled={Boolean(errorCarga)}
                    >
                        Crear evento
                    </button>
                )}
            </header>

            {errorCarga && (
                <p className="evento-mensaje-error" role="alert">{errorCarga}</p>
            )}

            {error && !formularioAbierto && (
                <p className="evento-mensaje-error" role="alert">{error}</p>
            )}

            {formularioAbierto && (
                <form
                    className="formulario-evento"
                    aria-labelledby="titulo-formulario-evento"
                    onSubmit={guardarPlantilla}
                    onKeyDown={manejarTeclaFormulario}
                >
                    <h3 id="titulo-formulario-evento">
                        {idEditando === null ? "Nuevo evento" : "Editar evento"}
                    </h3>

                    <label className="campo-evento">
                        <span>Nombre</span>
                        <input
                            type="text"
                            ref={campoNombreRef}
                            value={nombre}
                            maxLength={80}
                            onChange={evento => cambiarNombre(evento.target.value)}
                        />
                    </label>

                    <label className="campo-evento campo-color-evento">
                        <span>Color</span>
                        <input
                            type="color"
                            value={color}
                            onChange={evento => cambiarColor(evento.target.value)}
                        />
                    </label>

                    <label className="campo-evento">
                        <span>Categoría</span>
                        <select value={categoriaId} onChange={evento => cambiarCategoriaId(evento.target.value)}>
                            <option value="">Sin categoría</option>
                            {categoriaId && !categorias.some(categoria => categoria.id === categoriaId) && <option value={categoriaId}>Categoría no disponible</option>}
                            {categorias.map(categoria => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
                        </select>
                        {errorCategorias && <small role="status">{errorCategorias}</small>}
                    </label>

                    {error && (
                        <p id="error-formulario-evento" className="evento-mensaje-error" role="alert">
                            {error}
                        </p>
                    )}

                    <div className="acciones-formulario-evento">
                        <button type="submit" className="boton-crear-evento">
                            {idEditando === null ? "Guardar evento" : "Guardar cambios"}
                        </button>
                        <button type="button" onClick={cancelarFormulario}>
                            Cancelar
                        </button>
                    </div>
                </form>
            )}

            {plantillas.length === 0 ? (
                <p className="eventos-vacio">
                    {errorCarga
                        ? "No se pueden mostrar los eventos guardados."
                        : "Todavía no hay eventos. Creá una plantilla para empezar."}
                </p>
            ) : (
                <ul className="lista-eventos">
                    {plantillas.map(plantilla => (
                        <li className="evento-fila" key={plantilla.id}>
                            <span
                                className="evento-muestra-color"
                                style={{ backgroundColor: plantilla.color }}
                                aria-hidden="true"
                            />
                            <span className="evento-nombre">{plantilla.nombre}{categorias.find(categoria => categoria.id === plantilla.categoriaId)?.nombre && <small className="evento-categoria">{categorias.find(categoria => categoria.id === plantilla.categoriaId).nombre}</small>}</span>
                            <div className="evento-acciones">
                                <button type="button" onClick={evento => abrirEdicion(plantilla, evento)}>
                                    Editar
                                </button>
                                <button type="button" onClick={() => eliminarPlantilla(plantilla)}>
                                    Eliminar
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
