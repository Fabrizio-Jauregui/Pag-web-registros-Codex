export const CLAVE_ORDEN_PLANTILLAS_EVENTOS = "focus.orden-plantillas-eventos.v1"
export const ORDEN_EVENTOS_PREDETERMINADO = "ultimo-uso"

export const OPCIONES_ORDEN_PLANTILLAS_EVENTOS = [
    { valor: "ultimo-uso", etiqueta: "Último uso (más reciente primero)" },
    { valor: "nombre-asc", etiqueta: "Nombre (A–Z)" },
    { valor: "nombre-desc", etiqueta: "Nombre (Z–A)" },
    { valor: "creacion-asc", etiqueta: "Creación (más antiguas primero)" },
    { valor: "creacion-desc", etiqueta: "Creación (más recientes primero)" }
]

const ordenesValidos = new Set(OPCIONES_ORDEN_PLANTILLAS_EVENTOS.map(opcion => opcion.valor))
const comparadorNombres = new Intl.Collator("es", { sensitivity: "base", numeric: true })

export function cargarOrdenPlantillasEventos(almacenamiento = null) {
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        const guardado = almacen.getItem(CLAVE_ORDEN_PLANTILLAS_EVENTOS)
        return ordenesValidos.has(guardado) ? guardado : ORDEN_EVENTOS_PREDETERMINADO
    } catch {
        return ORDEN_EVENTOS_PREDETERMINADO
    }
}

export function ordenarPlantillasEventos(plantillas, orden = ORDEN_EVENTOS_PREDETERMINADO) {
    const criterio = ordenesValidos.has(orden) ? orden : ORDEN_EVENTOS_PREDETERMINADO

    return plantillas
        .map((plantilla, indiceOriginal) => ({ plantilla, indiceOriginal }))
        .sort((a, b) => {
            let comparacion = 0

            if (criterio === "nombre-asc" || criterio === "nombre-desc") {
                comparacion = comparadorNombres.compare(a.plantilla.nombre, b.plantilla.nombre)
                if (criterio === "nombre-desc") comparacion *= -1
            } else {
                const campo = criterio === "ultimo-uso" ? "ultimoUso" : "creadoEn"
                const fechaA = Date.parse(a.plantilla[campo] ?? "")
                const fechaB = Date.parse(b.plantilla[campo] ?? "")
                const conocidaA = Number.isFinite(fechaA)
                const conocidaB = Number.isFinite(fechaB)
                const descendente = criterio === "ultimo-uso" || criterio === "creacion-desc"

                if (conocidaA !== conocidaB) {
                    // Las plantillas antiguas sin metadatos quedan antes en creación y
                    // al final en último uso, que es lo más antiguo/desconocido.
                    comparacion = conocidaA ? (descendente ? -1 : 1) : (descendente ? 1 : -1)
                } else if (conocidaA && fechaA !== fechaB) {
                    comparacion = descendente ? fechaB - fechaA : fechaA - fechaB
                }
            }

            return comparacion || a.indiceOriginal - b.indiceOriginal
        })
        .map(item => item.plantilla)
}
