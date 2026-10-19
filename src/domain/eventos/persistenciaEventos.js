import { validarPlantillaEvento } from "./eventos.js"

export const CLAVE_PLANTILLAS_EVENTOS = "focus.plantillas-eventos.v1"

function validarColeccion(plantillas) {
    if (!Array.isArray(plantillas)) {
        return false
    }

    const ids = new Set()

    return plantillas.every(plantilla => {
        if (
            plantilla === null
            || typeof plantilla !== "object"
            || Array.isArray(plantilla)
            || typeof plantilla.id !== "string"
            || plantilla.id.trim() === ""
            || ids.has(plantilla.id)
            || (plantilla.categoriaId !== undefined && plantilla.categoriaId !== null
                && (typeof plantilla.categoriaId !== "string" || !plantilla.categoriaId.trim()))
            || validarPlantillaEvento(plantilla.nombre, plantilla.color) !== null
        ) {
            return false
        }

        ids.add(plantilla.id)
        return true
    })
}

export function cargarPlantillasEventos(almacenamiento = null) {
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        const datosGuardados = almacen.getItem(CLAVE_PLANTILLAS_EVENTOS)

        if (datosGuardados === null) {
            return { ok: true, plantillas: [] }
        }

        let plantillas

        try {
            plantillas = JSON.parse(datosGuardados)
        } catch {
            return {
                ok: false,
                error: "Los eventos guardados no tienen un formato JSON válido. No se modificaron los datos."
            }
        }

        if (!validarColeccion(plantillas)) {
            return {
                ok: false,
                error: "Los eventos guardados tienen datos inválidos. No se modificaron los datos."
            }
        }

        return { ok: true, plantillas }
    } catch {
        return {
            ok: false,
            error: "No se pudieron leer los eventos guardados en este navegador."
        }
    }
}

export function guardarPlantillasEventos(plantillas, almacenamiento = null) {
    if (!validarColeccion(plantillas)) {
        return {
            ok: false,
            error: "No se guardaron los cambios porque la lista de eventos no es válida."
        }
    }

    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        almacen.setItem(
            CLAVE_PLANTILLAS_EVENTOS,
            JSON.stringify(plantillas)
        )
        return { ok: true }
    } catch {
        return {
            ok: false,
            error: "No se pudieron guardar los eventos en este navegador. Verificá el espacio disponible y los permisos de almacenamiento."
        }
    }
}
