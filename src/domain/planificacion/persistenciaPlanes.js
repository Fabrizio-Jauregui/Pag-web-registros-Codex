import { validarColeccionPlanes, validarPlan } from "./planes.js"

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
        const fin = plan.modoSeguimientoPlanificacion === "cronometro" && plan.fin === null ? null : convertirFecha(plan.fin)
        if (!inicio || (plan.modoSeguimientoPlanificacion === "cronometro" ? plan.fin !== null : !fin)) return null
        return { ...plan, inicio, fin }
    })
    return planes.some(plan => plan === null) ? null : planes
}

function analizarPlanes(datos) {
    if (!Array.isArray(datos)) return { planes: [], problemas: [{ indice: null, titulo: "Colección de planes", detalle: "El contenido guardado no es una lista de planes.", bruto: null }] }
    const planes = []
    const problemas = []
    const ids = new Set()
    datos.forEach((bruto, indice) => {
        const plan = deserializarPlanes([bruto])?.[0]
        let detalle = ""
        if (!plan) detalle = "Faltan datos o hay fechas de planificación inválidas."
        else if (typeof plan.id !== "string" || !plan.id.trim()) detalle = "El plan no tiene un identificador válido."
        else if (ids.has(plan.id)) detalle = "El identificador del plan está repetido."
        else detalle = validarPlan(plan) ?? ""
        if (detalle) problemas.push({ indice, titulo: plan?.nombre || `Plan ${indice + 1}`, detalle, bruto })
        else { planes.push(plan); ids.add(plan.id) }
    })
    return { planes, problemas }
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
        const analisis = analizarPlanes(datos)
        if (analisis.problemas.some(problema => problema.indice === null)) return { ok: false, error: analisis.problemas[0].detalle, problemas: analisis.problemas }
        return { ok: true, planes: analisis.planes, ...(analisis.problemas.length ? { problemas: analisis.problemas } : {}) }
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
        let invalidos = []
        try {
            const originales = JSON.parse(almacen.getItem(CLAVE_PLANES) ?? "[]")
            if (!Array.isArray(originales)) return { ok: false, error: "El contenido de planes no se puede modificar hasta eliminar la colección corrupta." }
            invalidos = analizarPlanes(originales).problemas.map(problema => problema.bruto)
        } catch { return { ok: false, error: "El contenido de planes no se puede modificar hasta eliminar la colección corrupta." } }
        almacen.setItem(CLAVE_PLANES, JSON.stringify([...planes.map(plan => ({
            ...plan,
            inicio: plan.inicio.toISOString(),
            fin: plan.fin?.toISOString() ?? null
        })), ...invalidos]))
        return { ok: true }
    } catch {
        return { ok: false, error: "No se pudieron guardar los planes en este navegador. Verificá el espacio disponible y los permisos de almacenamiento." }
    }
}

export function eliminarPlanInvalido(indice, almacenamiento = null) {
    try {
        const almacen = almacenamiento ?? globalThis.localStorage
        const originales = JSON.parse(almacen.getItem(CLAVE_PLANES) ?? "null")
        if (!Array.isArray(originales) || !Number.isInteger(indice) || indice < 0 || indice >= originales.length) return { ok: false, error: "No se encontró ese plan inválido." }
        originales.splice(indice, 1)
        almacen.setItem(CLAVE_PLANES, JSON.stringify(originales))
        return { ok: true }
    } catch { return { ok: false, error: "No se pudo eliminar el plan inválido." } }
}
