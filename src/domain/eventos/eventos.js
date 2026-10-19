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

export function crearPlantillaEvento(
    nombre,
    color,
    categoriaId = null,
    generarId = () => globalThis.crypto.randomUUID()
) {
    if (typeof categoriaId === "function") {
        generarId = categoriaId
        categoriaId = null
    }
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
            ...(categoriaId ? { categoriaId } : {})
        }
    }
}

export function actualizarPlantillaEvento(plantillas, id, nombre, color, categoriaId = null) {
    const indice = plantillas.findIndex(plantilla => plantilla.id === id)

    if (indice === -1) {
        return { ok: false, error: "No se encontró el evento que querés editar." }
    }

    const error = validarPlantillaEvento(nombre, color)

    if (error !== null) {
        return { ok: false, error }
    }

    const nuevasPlantillas = plantillas.map(plantilla => {
        if (plantilla.id !== id) return plantilla
        const actualizada = { ...plantilla, nombre: nombre.trim(), color: color.toUpperCase() }
        if (categoriaId) actualizada.categoriaId = categoriaId
        else delete actualizada.categoriaId
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
