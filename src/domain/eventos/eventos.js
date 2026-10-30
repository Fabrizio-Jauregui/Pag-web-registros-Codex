export const COLOR_EVENTO_PREDETERMINADO = "#4F46E5"

export function validarPlantillaEvento(nombre, color) {
    if (typeof nombre !== "string" || nombre.trim() === "") {
        return "El nombre del evento es obligatorio."
    }

    if (nombre.trim().length > 80) {
        return "El nombre no puede superar los 80 caracteres."
    }

    if (typeof color !== "string" || !/^#[\da-fA-F]{6}$/.test(color)) {
        return "Seleccioná un color válido."
    }

    return null
}

export function obtenerCategoriasPlantillaEvento(plantilla) {
    if (Array.isArray(plantilla?.categoriaIds)) return plantilla.categoriaIds
    return typeof plantilla?.categoriaId === "string" && plantilla.categoriaId.trim()
        ? [plantilla.categoriaId]
        : []
}

export function normalizarPlantillaEvento(plantilla) {
    const resto = { ...plantilla }
    delete resto.categoriaId
    const categoriaIds = obtenerCategoriasPlantillaEvento(plantilla)
    return { ...resto, ...(categoriaIds.length ? { categoriaIds: [...categoriaIds] } : {}) }
}

function normalizarCategorias(categoriaIds) {
    if (categoriaIds === null || categoriaIds === undefined) return []
    if (typeof categoriaIds === "string") return categoriaIds.trim() ? [categoriaIds] : []
    if (!Array.isArray(categoriaIds)) return null
    return categoriaIds
}

function validarCategorias(categoriaIds) {
    return Array.isArray(categoriaIds)
        && categoriaIds.every(id => typeof id === "string" && id.trim())
        && new Set(categoriaIds).size === categoriaIds.length
}

export function crearPlantillaEvento(
    nombre,
    color,
    categoriaIds = [],
    generarId = () => globalThis.crypto.randomUUID()
) {
    if (typeof categoriaIds === "function") {
        generarId = categoriaIds
        categoriaIds = []
    }
    const categorias = normalizarCategorias(categoriaIds)
    if (!validarCategorias(categorias)) return { ok: false, error: "Elegí categorías válidas para el evento." }
    const error = validarPlantillaEvento(nombre, color)

    if (error !== null) {
        return { ok: false, error }
    }

    let id

    try {
        id = generarId()
    } catch {
        return { ok: false, error: "No se pudo crear la identidad del evento." }
    }

    if (typeof id !== "string" || id.trim() === "") {
        return { ok: false, error: "No se pudo crear la identidad del evento." }
    }

    return {
        ok: true,
        plantilla: {
            id,
            nombre: nombre.trim(),
            color: color.toUpperCase(),
            creadoEn: new Date().toISOString(),
            ...(categorias.length ? { categoriaIds: [...categorias] } : {})
        }
    }
}

export function marcarPlantillaEventoUsada(plantillas, id, instante = new Date()) {
    if (!Array.isArray(plantillas) || !plantillas.some(plantilla => plantilla.id === id)) {
        return { ok: false, error: "No se encontró la plantilla de evento utilizada." }
    }

    const fecha = instante instanceof Date ? instante : new Date(instante)
    if (Number.isNaN(fecha.getTime())) {
        return { ok: false, error: "No se pudo guardar la fecha de uso de la plantilla." }
    }

    return {
        ok: true,
        plantillas: plantillas.map(plantilla => plantilla.id === id
            ? { ...plantilla, ultimoUso: fecha.toISOString() }
            : plantilla)
    }
}

export function actualizarPlantillaEvento(plantillas, id, nombre, color, categoriaIds = []) {
    const indice = plantillas.findIndex(plantilla => plantilla.id === id)

    if (indice === -1) {
        return { ok: false, error: "No se encontró el evento que querés editar." }
    }

    const error = validarPlantillaEvento(nombre, color)

    if (error !== null) {
        return { ok: false, error }
    }

    const categorias = normalizarCategorias(categoriaIds)
    if (!validarCategorias(categorias)) return { ok: false, error: "Elegí categorías válidas para el evento." }

    const nuevasPlantillas = plantillas.map(plantilla => {
        if (plantilla.id !== id) return plantilla
        const actualizada = { ...plantilla, nombre: nombre.trim(), color: color.toUpperCase() }
        delete actualizada.categoriaId
        if (categorias.length) actualizada.categoriaIds = [...categorias]
        else delete actualizada.categoriaIds
        return actualizada
    })

    return { ok: true, plantillas: nuevasPlantillas }
}

export function eliminarPlantillaEvento(plantillas, id) {
    if (!plantillas.some(plantilla => plantilla.id === id)) {
        return { ok: false, error: "No se encontró el evento que querés eliminar." }
    }

    return {
        ok: true,
        plantillas: plantillas.filter(plantilla => plantilla.id !== id)
    }
}
