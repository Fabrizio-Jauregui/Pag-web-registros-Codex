import { validarColeccionPlanes } from "./planes.js"

export const CLAVE_PLANES = "focus.planes.v1"

function convertirFecha(valor) {
    if (typeof valor !== "string") return null
    const fecha = new Date(valor)
    return Number.isFinite(fecha.getTime()) && fecha.toISOString() === valor ? fecha : null
}

function deserializarPlanes(datos) {
    if (!Array.isArray(datos)) return null
    const planes = datos.map(plan => {
        if (!plan || typeof plan !== "object" || Array.isArray(plan)) return null
        const inicio = convertirFecha(plan.inicio)
        const fin = convertirFecha(plan.fin)
        if (!inicio || !fin) return null
        return { ...plan, inicio, fin }
    })
    return planes.some(plan => plan === null) ? null : planes
}

export function cargarPlanes(almacenamiento = null) {
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        const contenido = almacen.getItem(CLAVE_PLANES)
        if (contenido === null) return { ok: true, planes: [] }
        let datos
        try {
            datos = JSON.parse(contenido)
        } catch {
            return { ok: false, error: "Los planes guardados no tienen un formato JSON válido. No se modificaron los datos." }
        }
        const planes = deserializarPlanes(datos)
        if (!planes || !validarColeccionPlanes(planes)) {
            return { ok: false, error: "Los planes guardados tienen datos o intervalos inválidos. No se modificaron los datos." }
        }
        return { ok: true, planes }
    } catch {
        return { ok: false, error: "No se pudieron leer los planes guardados en este navegador." }
    }
}

export function guardarPlanes(planes, almacenamiento = null) {
    if (!validarColeccionPlanes(planes)) {
        return { ok: false, error: "No se guardaron los cambios porque los planes tienen fechas u otros datos inválidos." }
    }
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        almacen.setItem(CLAVE_PLANES, JSON.stringify(planes.map(plan => ({
            ...plan,
            inicio: plan.inicio.toISOString(),
            fin: plan.fin.toISOString()
        }))))
        return { ok: true }
    } catch {
        return { ok: false, error: "No se pudieron guardar los planes en este navegador. Verificá el espacio disponible y los permisos de almacenamiento." }
    }
}
