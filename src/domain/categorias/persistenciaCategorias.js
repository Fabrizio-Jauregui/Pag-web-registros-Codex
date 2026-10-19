export const CLAVE_CATEGORIAS = "focus.categorias.v1"

function validarColeccion(categorias) {
    if (!Array.isArray(categorias)) return false
    const ids = new Set()
    return categorias.every(categoria => {
        if (!categoria || typeof categoria !== "object" || Array.isArray(categoria)
            || typeof categoria.id !== "string" || !categoria.id.trim() || ids.has(categoria.id)
            || typeof categoria.nombre !== "string" || !categoria.nombre.trim() || categoria.nombre.trim().length > 60) return false
        ids.add(categoria.id)
        return true
    })
}

export function cargarCategorias(almacenamiento = null) {
    try {
        const valor = (almacenamiento ?? globalThis.localStorage).getItem(CLAVE_CATEGORIAS)
        if (valor === null) return { ok: true, categorias: [] }
        let categorias
        try { categorias = JSON.parse(valor) } catch { return { ok: false, error: "Las categorías guardadas no tienen un formato JSON válido. No se modificaron los datos." } }
        return validarColeccion(categorias)
            ? { ok: true, categorias }
            : { ok: false, error: "Las categorías guardadas tienen datos inválidos. No se modificaron los datos." }
    } catch {
        return { ok: false, error: "No se pudieron leer las categorías guardadas en este navegador." }
    }
}

export function guardarCategorias(categorias, almacenamiento = null) {
    if (!validarColeccion(categorias)) return { ok: false, error: "No se guardaron los cambios porque la lista de categorías no es válida." }
    try {
        (almacenamiento ?? globalThis.localStorage).setItem(CLAVE_CATEGORIAS, JSON.stringify(categorias))
        return { ok: true }
    } catch {
        return { ok: false, error: "No se pudieron guardar las categorías en este navegador. Verificá el espacio disponible y los permisos de almacenamiento." }
    }
}
