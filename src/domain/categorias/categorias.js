export function validarCategoria(nombre) {
    if (typeof nombre !== "string" || nombre.trim() === "") return "El nombre de la categoría es obligatorio."
    if (nombre.trim().length > 60) return "El nombre no puede superar los 60 caracteres."
    return null
}

export function crearCategoria(nombre, generarId = () => globalThis.crypto.randomUUID()) {
    const error = validarCategoria(nombre)
    if (error) return { ok: false, error }
    let id
    try { id = generarId() } catch { return { ok: false, error: "No se pudo crear la identidad de la categoría." } }
    if (typeof id !== "string" || !id.trim()) return { ok: false, error: "No se pudo crear la identidad de la categoría." }
    return { ok: true, categoria: { id, nombre: nombre.trim() } }
}

export function actualizarCategoria(categorias, id, nombre) {
    if (!categorias.some(categoria => categoria.id === id)) return { ok: false, error: "No se encontró la categoría que querés editar." }
    const error = validarCategoria(nombre)
    if (error) return { ok: false, error }
    return { ok: true, categorias: categorias.map(categoria => categoria.id === id ? { ...categoria, nombre: nombre.trim() } : categoria) }
}

export function eliminarCategoria(categorias, id) {
    if (!categorias.some(categoria => categoria.id === id)) return { ok: false, error: "No se encontró la categoría que querés eliminar." }
    return { ok: true, categorias: categorias.filter(categoria => categoria.id !== id) }
}
