export function ejecutarTransaccionAlmacenamiento(claves, ejecutar, almacenamiento = null) {
    if (!Array.isArray(claves) || typeof ejecutar !== "function") {
        return { ok: false, error: "No se pudo preparar el guardado coordinado." }
    }
    let almacen
    let anteriores
    try {
        almacen = almacenamiento ?? globalThis.localStorage
        anteriores = new Map(claves.map(clave => [clave, almacen.getItem(clave)]))
    } catch {
        return { ok: false, error: "No se pudieron resguardar los datos anteriores antes de guardar." }
    }

    let resultado
    try {
        resultado = ejecutar(almacen)
    } catch {
        resultado = { ok: false, error: "Falló el guardado coordinado de los cambios." }
    }
    if (resultado?.ok) return resultado

    let errorRestauracion = false
    for (const [clave, valor] of [...anteriores.entries()].reverse()) {
        try {
            if (valor === null) almacen.removeItem(clave)
            else almacen.setItem(clave, valor)
        } catch {
            errorRestauracion = true
        }
    }
    return {
        ok: false,
        error: errorRestauracion
            ? `${resultado?.error ?? "No se pudieron guardar los cambios."} Además, no se pudieron restaurar todos los datos anteriores; revisá el almacenamiento antes de continuar.`
            : resultado?.error ?? "No se pudieron guardar los cambios; se restauró el estado anterior."
    }
}
