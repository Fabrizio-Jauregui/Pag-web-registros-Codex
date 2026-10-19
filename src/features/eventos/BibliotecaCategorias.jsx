import { useState } from "react"
import "./BibliotecaCategorias.css"

export function BibliotecaCategorias({ categorias, errorCarga = "", onCrear, onActualizar, onEliminar }) {
    const [nombre, cambiarNombre] = useState("")
    const [idEditando, cambiarIdEditando] = useState(null)
    const [error, cambiarError] = useState("")

    function guardar(evento) {
        evento.preventDefault()
        const resultado = idEditando
            ? onActualizar(idEditando, nombre)
            : onCrear(nombre)
        if (!resultado.ok) { cambiarError(resultado.error); return }
        cambiarNombre("")
        cambiarIdEditando(null)
        cambiarError("")
    }

    function editar(categoria) {
        cambiarIdEditando(categoria.id)
        cambiarNombre(categoria.nombre)
        cambiarError("")
    }

    function cancelar() {
        cambiarIdEditando(null)
        cambiarNombre("")
        cambiarError("")
    }

    function eliminar(categoria) {
        if (!window.confirm(`¿Eliminar la categoría "${categoria.nombre}"? Los eventos vinculados quedarán sin categoría.`)) return
        const resultado = onEliminar(categoria.id)
        cambiarError(resultado.ok ? "" : resultado.error)
    }

    return (
        <section className="biblioteca-categorias" aria-labelledby="titulo-categorias">
            <header>
                <div><h2 id="titulo-categorias">Categorías</h2><p>Agrupá eventos para consultar su tiempo en la analítica.</p></div>
            </header>
            {errorCarga && <p className="evento-mensaje-error" role="alert">{errorCarga}</p>}
            <form className="formulario-categoria" onSubmit={guardar}>
                <label>
                    <span>{idEditando ? "Editar categoría" : "Nueva categoría"}</span>
                    <input value={nombre} maxLength={60} onChange={evento => cambiarNombre(evento.target.value)} disabled={Boolean(errorCarga)} />
                </label>
                <div className="acciones-categoria">
                    <button type="submit" disabled={Boolean(errorCarga)}>{idEditando ? "Guardar" : "Crear categoría"}</button>
                    {idEditando && <button type="button" onClick={cancelar}>Cancelar</button>}
                </div>
            </form>
            {error && <p className="evento-mensaje-error" role="alert">{error}</p>}
            {categorias.length === 0 ? <p className="eventos-vacio">Todavía no hay categorías.</p> : (
                <ul className="lista-categorias">
                    {categorias.map(categoria => <li key={categoria.id}>
                        <span>{categoria.nombre}</span>
                        <div><button type="button" onClick={() => editar(categoria)}>Editar</button><button type="button" onClick={() => eliminar(categoria)}>Eliminar</button></div>
                    </li>)}
                </ul>
            )}
        </section>
    )
}
