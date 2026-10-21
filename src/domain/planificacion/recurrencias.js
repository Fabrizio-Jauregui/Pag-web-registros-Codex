import { formatearFechaISO, leerFechaISO } from "../tiempo/FechaCalendario.js"
import { validarPlan } from "./planes.js"

export const CLAVE_RECURRENCIAS = "focus.recurrencias.v1"

function fechaConHora(fecha, segundosDelDia, milisegundos) {
    const resultado = new Date(fecha)
    resultado.setHours(0, 0, 0, 0)
    resultado.setMilliseconds(segundosDelDia * 1000 + milisegundos)
    return resultado
}

export function validarReglaRecurrencia(regla) {
    if (!regla || typeof regla !== "object" || typeof regla.id !== "string" || !regla.id.trim()) return false
    if (regla.ordenSeguimiento !== undefined
        && (!Number.isInteger(regla.ordenSeguimiento) || regla.ordenSeguimiento < 0)) return false
    if (regla.idSerie !== undefined && (typeof regla.idSerie !== "string" || !regla.idSerie.trim())) return false
    if (typeof regla.nombre !== "string" || !regla.nombre.trim() || regla.nombre.length > 80) return false
    if (regla.eventoId !== null && typeof regla.eventoId !== "string") return false
    if (regla.colorEvento !== null && !/^#[\da-fA-F]{6}$/.test(regla.colorEvento)) return false
    const inicio = leerFechaISO(regla.fechaInicio)
    const fin = regla.fechaFin === null ? null : leerFechaISO(regla.fechaFin)
    if (!inicio || (regla.fechaFin !== null && (!fin || fin < inicio))) return false
    if (!Array.isArray(regla.diasSemana) || regla.diasSemana.length === 0
        || regla.diasSemana.some(dia => !Number.isInteger(dia) || dia < 0 || dia > 6)
        || new Set(regla.diasSemana).size !== regla.diasSemana.length) return false
    if (!Number.isInteger(regla.segundosInicio) || regla.segundosInicio < 0 || regla.segundosInicio >= 86400) return false
    if (!Number.isInteger(regla.milisegundosInicio) || regla.milisegundosInicio < 0 || regla.milisegundosInicio > 999) return false
    if (!Number.isFinite(regla.duracionMs) || regla.duracionMs <= 0) return false
    if (!regla.excepciones || typeof regla.excepciones !== "object" || Array.isArray(regla.excepciones)) return false
    for (const [fecha, excepcion] of Object.entries(regla.excepciones)) {
        if (!leerFechaISO(fecha)) return false
        if (excepcion !== null) {
            const plan = { ...excepcion, inicio: new Date(excepcion.inicio), fin: new Date(excepcion.fin) }
            if (validarPlan(plan) || typeof excepcion.id !== "string") return false
        }
    }
    return true
}

export function validarColeccionRecurrencias(reglas) {
    return Array.isArray(reglas) && new Set(reglas.map(regla => regla?.id)).size === reglas.length
        && reglas.every(validarReglaRecurrencia)
}

export function crearReglaRecurrencia(plan, diasSemana, fechaFin = null, generarId = () => globalThis.crypto.randomUUID()) {
    const inicioDia = new Date(plan.inicio)
    inicioDia.setHours(0, 0, 0, 0)
    const regla = {
        id: generarId(), idSerie: null, nombre: plan.nombre, eventoId: plan.eventoId, colorEvento: plan.colorEvento,
        fechaInicio: formatearFechaISO(inicioDia), fechaFin,
        diasSemana: [...new Set(diasSemana)].sort((a, b) => a - b),
        segundosInicio: plan.inicio.getHours() * 3600 + plan.inicio.getMinutes() * 60 + plan.inicio.getSeconds(),
        milisegundosInicio: plan.inicio.getMilliseconds(), duracionMs: plan.fin.getTime() - plan.inicio.getTime(), excepciones: {}
    }
    regla.idSerie = regla.id
    return validarReglaRecurrencia(regla) ? { ok: true, regla } : { ok: false, error: "La regla semanal no es válida." }
}

export function generarAparicionesRecurrencia(reglas, inicioRango, finRango) {
    if (!Array.isArray(reglas) || !(inicioRango instanceof Date) || !(finRango instanceof Date)) return []
    const visibles = []
    const desde = new Date(inicioRango); desde.setHours(0, 0, 0, 0)
    const hasta = new Date(finRango); hasta.setHours(0, 0, 0, 0)
    const limiteInicio = desde.getTime()
    const limiteFin = new Date(hasta); limiteFin.setDate(limiteFin.getDate() + 1)
    for (const regla of reglas) {
        if (!validarReglaRecurrencia(regla)) continue
        const fechaInicio = leerFechaISO(regla.fechaInicio)
        const fechaFin = regla.fechaFin ? leerFechaISO(regla.fechaFin) : null
        for (const [fecha, excepcion] of Object.entries(regla.excepciones)) {
            if (!excepcion) continue
            const inicioExcepcion = new Date(excepcion.inicio)
            const finExcepcion = new Date(excepcion.fin)
            if (inicioExcepcion < limiteFin && finExcepcion > limiteInicio
                && (fecha < formatearFechaISO(desde) || fecha > formatearFechaISO(hasta))) {
                    visibles.push({ ...excepcion, inicio: inicioExcepcion, fin: finExcepcion,
                    ...(Number.isInteger(excepcion.ordenSeguimiento ?? regla.ordenSeguimiento)
                        ? { ordenSeguimiento: excepcion.ordenSeguimiento ?? regla.ordenSeguimiento } : {}),
                    idRecurrencia: regla.id, idSerie: regla.idSerie ?? regla.id, fechaRecurrencia: fecha })
            }
        }
        const cursor = new Date(Math.max(desde.getTime(), fechaInicio.getTime()))
        while (cursor <= hasta && (!fechaFin || cursor <= fechaFin)) {
            const fecha = formatearFechaISO(cursor)
            if (regla.diasSemana.includes(cursor.getDay())) {
                if (Object.hasOwn(regla.excepciones, fecha)) {
                    const excepcion = regla.excepciones[fecha]
                    if (excepcion) visibles.push({ ...excepcion, inicio: new Date(excepcion.inicio), fin: new Date(excepcion.fin),
                        ...(Number.isInteger(excepcion.ordenSeguimiento ?? regla.ordenSeguimiento)
                            ? { ordenSeguimiento: excepcion.ordenSeguimiento ?? regla.ordenSeguimiento } : {}),
                        idRecurrencia: regla.id, fechaRecurrencia: fecha })
                } else {
                    const inicio = fechaConHora(cursor, regla.segundosInicio, regla.milisegundosInicio)
                    const fin = new Date(inicio.getTime() + regla.duracionMs)
                    visibles.push({ id: `recurrencia-${regla.id}-${fecha}`, nombre: regla.nombre,
                        eventoId: regla.eventoId, colorEvento: regla.colorEvento, inicio, fin,
                        ...(Number.isInteger(regla.ordenSeguimiento) ? { ordenSeguimiento: regla.ordenSeguimiento } : {}),
                        idRecurrencia: regla.id, idSerie: regla.idSerie ?? regla.id, fechaRecurrencia: fecha })
                }
            }
            cursor.setDate(cursor.getDate() + 1)
        }
    }
    return visibles
}

export function cambiarRecurrencia(reglas, id, fecha, cambios, alcance = "solo") {
    const regla = reglas.find(item => item.id === id)
    if (!regla) return { ok: false, error: "No se encontró la serie semanal." }
    if (alcance === "toda") return { ok: true, reglas: reglas.map(item => (
        (item.idSerie ?? item.id) === (regla.idSerie ?? regla.id) ? actualizarBase(item, cambios) : item
    )) }
    if (alcance === "solo") {
        const inicio = cambios.inicio.toISOString(); const fin = cambios.fin.toISOString()
        const excepciones = { ...regla.excepciones, [fecha]: { id: `excepcion-${id}-${fecha}`, nombre: cambios.nombre,
            eventoId: cambios.evento?.id ?? null, colorEvento: cambios.evento?.color ?? regla.colorEvento,
            ...(Number.isInteger(cambios.ordenSeguimiento) ? { ordenSeguimiento: cambios.ordenSeguimiento } : {}),
            inicio, fin } }
        return { ok: true, reglas: reglas.map(item => item.id === id ? { ...item, excepciones } : item) }
    }
    if (alcance === "siguientes") {
        const fechaAnterior = leerFechaISO(fecha); fechaAnterior.setDate(fechaAnterior.getDate() - 1)
        const nueva = actualizarBase({ ...regla, id: `${regla.id}-desde-${fecha}`, fechaInicio: fecha,
            fechaFin: regla.fechaFin, excepciones: Object.fromEntries(Object.entries(regla.excepciones).filter(([dia]) => dia > fecha)) }, cambios)
        const anteriores = { ...regla, fechaFin: formatearFechaISO(fechaAnterior), excepciones: Object.fromEntries(Object.entries(regla.excepciones).filter(([dia]) => dia < fecha)) }
        const antes = fechaAnterior >= leerFechaISO(regla.fechaInicio) ? [anteriores] : []
        return { ok: true, reglas: [...reglas.filter(item => item.id !== id), ...antes, nueva] }
    }
    return { ok: false, error: "Elegí el alcance de la serie." }
}

function actualizarBase(regla, cambios) {
    return { ...regla, nombre: cambios.nombre.trim(), eventoId: cambios.evento?.id ?? null,
        colorEvento: cambios.evento?.color ?? regla.colorEvento,
        ...(Number.isInteger(cambios.ordenSeguimiento) ? { ordenSeguimiento: cambios.ordenSeguimiento } : {}),
        segundosInicio: cambios.inicio.getHours() * 3600 + cambios.inicio.getMinutes() * 60 + cambios.inicio.getSeconds(),
        milisegundosInicio: cambios.inicio.getMilliseconds(), duracionMs: cambios.fin - cambios.inicio }
}

export function eliminarRecurrencia(reglas, id, fecha, alcance = "solo") {
    const regla = reglas.find(item => item.id === id)
    if (!regla) return { ok: false, error: "No se encontró la serie semanal." }
    if (alcance === "toda") return { ok: true, reglas: reglas.filter(item => (
        (item.idSerie ?? item.id) !== (regla.idSerie ?? regla.id)
    )) }
    if (alcance === "solo") return { ok: true, reglas: reglas.map(item => item.id === id
        ? { ...item, excepciones: { ...item.excepciones, [fecha]: null } } : item) }
    if (alcance === "siguientes") {
        const fechaAnterior = leerFechaISO(fecha); fechaAnterior.setDate(fechaAnterior.getDate() - 1)
        const anteriores = reglas.filter(item => item.id !== id)
        if (fechaAnterior >= leerFechaISO(regla.fechaInicio)) anteriores.push({ ...regla, fechaFin: formatearFechaISO(fechaAnterior),
            excepciones: Object.fromEntries(Object.entries(regla.excepciones).filter(([dia]) => dia < fecha)) })
        return { ok: true, reglas: anteriores }
    }
    return { ok: false, error: "Elegí el alcance de la serie." }
}

export function cargarRecurrencias(almacenamiento = null) {
    try {
        almacenamiento ??= globalThis.localStorage
        const texto = almacenamiento.getItem(CLAVE_RECURRENCIAS)
        if (texto === null) return { ok: true, reglas: [] }
        const reglas = JSON.parse(texto)
        return validarColeccionRecurrencias(reglas) ? { ok: true, reglas }
            : { ok: false, error: "Las recurrencias guardadas tienen datos inválidos. No se modificaron." }
    } catch { return { ok: false, error: "No se pudieron leer las recurrencias guardadas." } }
}

export function guardarRecurrencias(reglas, almacenamiento = null) {
    if (!validarColeccionRecurrencias(reglas)) return { ok: false, error: "No se guardaron las recurrencias porque contienen datos inválidos." }
    try { almacenamiento ??= globalThis.localStorage; almacenamiento.setItem(CLAVE_RECURRENCIAS, JSON.stringify(reglas)); return { ok: true } }
    catch { return { ok: false, error: "No se pudieron guardar las recurrencias en este navegador." } }
}
