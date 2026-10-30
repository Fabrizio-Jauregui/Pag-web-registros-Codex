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
    if (regla.plantillaOrigenId !== undefined
        && (typeof regla.plantillaOrigenId !== "string" || !regla.plantillaOrigenId.trim())) return false
    if (regla.plantillaOrigenNombre !== undefined
        && (typeof regla.plantillaOrigenNombre !== "string" || !regla.plantillaOrigenNombre.trim() || regla.plantillaOrigenNombre.length > 80)) return false
    if (regla.ordenSeguimiento !== undefined
        && (!Number.isInteger(regla.ordenSeguimiento) || regla.ordenSeguimiento < 0)) return false
    if (regla.idSerie !== undefined && (typeof regla.idSerie !== "string" || !regla.idSerie.trim())) return false
    if (typeof regla.nombre !== "string" || !regla.nombre.trim() || regla.nombre.length > 80) return false
    if (regla.eventoId !== null && typeof regla.eventoId !== "string") return false
    if (regla.colorEvento !== null && !/^#[\da-fA-F]{6}$/.test(regla.colorEvento)) return false
    if (regla.tareaId !== undefined && (typeof regla.tareaId !== "string" || !regla.tareaId.trim())) return false
    if (regla.tareaNombre !== undefined && (typeof regla.tareaNombre !== "string" || !regla.tareaNombre.trim())) return false
    if ((typeof regla.eventoId === "string") === (typeof regla.tareaId === "string")) return false
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
        ...(plan.tareaId ? { tareaId: plan.tareaId, tareaNombre: plan.tareaNombre } : {}),
        ...(typeof plan.plantillaOrigenId === "string" && plan.plantillaOrigenId.trim()
            ? { plantillaOrigenId: plan.plantillaOrigenId } : {}),
        ...(typeof plan.plantillaOrigenNombre === "string" && plan.plantillaOrigenNombre.trim()
            ? { plantillaOrigenNombre: plan.plantillaOrigenNombre } : {}),
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
            if (inicioExcepcion < limiteFin && finExcepcion > limiteInicio) {
                visibles.push({ ...excepcion, inicio: inicioExcepcion, fin: finExcepcion,
                    ...(Number.isInteger(excepcion.ordenSeguimiento ?? regla.ordenSeguimiento)
                        ? { ordenSeguimiento: excepcion.ordenSeguimiento ?? regla.ordenSeguimiento } : {}),
                    ...(regla.plantillaOrigenId ? { plantillaOrigenId: regla.plantillaOrigenId } : {}),
                    ...(regla.plantillaOrigenNombre ? { plantillaOrigenNombre: regla.plantillaOrigenNombre } : {}),
                    idRecurrencia: regla.id, idSerie: regla.idSerie ?? regla.id, fechaRecurrencia: fecha })
            }
        }
        const cursor = new Date(Math.max(desde.getTime(), fechaInicio.getTime()))
        while (cursor <= hasta && (!fechaFin || cursor <= fechaFin)) {
            const fecha = formatearFechaISO(cursor)
            if (regla.diasSemana.includes(cursor.getDay()) && !Object.hasOwn(regla.excepciones, fecha)) {
                    const inicio = fechaConHora(cursor, regla.segundosInicio, regla.milisegundosInicio)
                    const fin = new Date(inicio.getTime() + regla.duracionMs)
                    visibles.push({ id: `recurrencia-${regla.id}-${fecha}`, nombre: regla.nombre,
                        eventoId: regla.eventoId, colorEvento: regla.colorEvento, inicio, fin,
                        ...(regla.tareaId ? { tareaId: regla.tareaId, tareaNombre: regla.tareaNombre } : {}),
                        ...(Number.isInteger(regla.ordenSeguimiento) ? { ordenSeguimiento: regla.ordenSeguimiento } : {}),
                        ...(regla.plantillaOrigenId ? { plantillaOrigenId: regla.plantillaOrigenId } : {}),
                        ...(regla.plantillaOrigenNombre ? { plantillaOrigenNombre: regla.plantillaOrigenNombre } : {}),
                        idRecurrencia: regla.id, idSerie: regla.idSerie ?? regla.id, fechaRecurrencia: fecha })
            }
            cursor.setDate(cursor.getDate() + 1)
        }
    }
    return visibles
}

function idSerie(regla) {
    return regla.idSerie ?? regla.id
}

function sumarDias(fecha, cantidad) {
    const resultado = new Date(fecha)
    resultado.setDate(resultado.getDate() + cantidad)
    return resultado
}

function fechaDeCorteFuturo(reglas, ahora) {
    const hoy = new Date(ahora)
    hoy.setHours(0, 0, 0, 0)
    let corte = null
    for (const regla of reglas) {
        const inicioRegla = leerFechaISO(regla.fechaInicio)
        const finRegla = regla.fechaFin ? leerFechaISO(regla.fechaFin) : null
        const fechasExcepcion = Object.keys(regla.excepciones).map(leerFechaISO).filter(Boolean)
        const ultimaExcepcion = fechasExcepcion.reduce((maxima, fecha) => fecha > maxima ? fecha : maxima, hoy)
        const hasta = finRegla && finRegla < ultimaExcepcion
            ? finRegla
            : sumarDias(ultimaExcepcion > sumarDias(hoy, 8) ? ultimaExcepcion : sumarDias(hoy, 8), 1)
        const cursor = new Date(Math.max(hoy.getTime(), inicioRegla.getTime()))
        while (cursor <= hasta && (!finRegla || cursor <= finRegla)) {
            const fecha = formatearFechaISO(cursor)
            if (regla.diasSemana.includes(cursor.getDay())) {
                const excepcion = regla.excepciones[fecha]
                if (excepcion !== null) {
                    const inicio = excepcion
                        ? new Date(excepcion.inicio)
                        : fechaConHora(cursor, regla.segundosInicio, regla.milisegundosInicio)
                    if (inicio >= ahora && (!corte || cursor < corte)) corte = new Date(cursor)
                }
            }
            cursor.setDate(cursor.getDate() + 1)
        }
    }
    return corte
}

function recortarSerieDesde(reglas, fechaCorte, ahora, plantillaOrigenId, plantillaOrigenNombre) {
    const fechaAnterior = sumarDias(fechaCorte, -1)
    const fechaAnteriorTexto = formatearFechaISO(fechaAnterior)
    const corteTexto = formatearFechaISO(fechaCorte)
    const recortadas = []
    for (const regla of reglas) {
        const inicio = leerFechaISO(regla.fechaInicio)
        const fin = regla.fechaFin ? leerFechaISO(regla.fechaFin) : null
        const excepciones = {}
        for (const [fecha, excepcion] of Object.entries(regla.excepciones)) {
            if (excepcion === null) {
                if (fecha < corteTexto) excepciones[fecha] = null
                continue
            }
            const inicioExcepcion = new Date(excepcion.inicio)
            if (inicioExcepcion < ahora || fecha < corteTexto) {
                excepciones[fecha] = inicioExcepcion >= ahora ? null : excepcion
            } else {
                excepciones[fecha] = null
            }
        }
        const plantilla = {
            ...(plantillaOrigenId ? { plantillaOrigenId } : {}),
            ...(plantillaOrigenNombre ? { plantillaOrigenNombre } : {})
        }
        if (inicio > fechaAnterior || (fin && fin < inicio)) {
            const excepcionesPasadas = Object.entries(excepciones).filter(([, excepcion]) =>
                excepcion && new Date(excepcion.inicio) < ahora
            )
            if (excepcionesPasadas.length === 0) continue
            const conExcepcionesHistoricas = Object.fromEntries(excepcionesPasadas)
            const fechaInicioTexto = regla.fechaInicio
            if (regla.diasSemana.includes(inicio.getDay()) && !Object.hasOwn(conExcepcionesHistoricas, fechaInicioTexto)) {
                conExcepcionesHistoricas[fechaInicioTexto] = null
            }
            recortadas.push({ ...regla, ...plantilla, fechaFin: fechaInicioTexto, excepciones: conExcepcionesHistoricas })
            continue
        }
        const nuevaFechaFin = fin && fin < fechaAnterior ? regla.fechaFin : fechaAnteriorTexto
        recortadas.push({ ...regla, ...plantilla, fechaFin: nuevaFechaFin, excepciones })
    }
    return recortadas
}

export function eliminarRecurrenciasDePlantilla(reglas, plantillaId, alcance = "todas", opciones = {}) {
    if (!Array.isArray(reglas) || typeof plantillaId !== "string" || !plantillaId.trim()) {
        return { ok: false, error: "No se pudo identificar la plantilla de planificación." }
    }
    if (!["todas", "futuras"].includes(alcance)) {
        return { ok: false, error: "Elegí si querés borrar todas las recurrencias o solo las futuras." }
    }
    const ahora = opciones.ahora ?? new Date()
    const plantillaOrigenNombre = opciones.plantillaOrigenNombre
    if (!(ahora instanceof Date) || !Number.isFinite(ahora.getTime())) {
        return { ok: false, error: "No se pudo determinar desde qué momento borrar las recurrencias futuras." }
    }
    const idsLegado = new Set(opciones.idsLegado ?? [])
    const seriesSeleccionadas = new Set(reglas
        .filter(regla => regla.plantillaOrigenId === plantillaId || idsLegado.has(regla.id))
        .map(idSerie))
    if (seriesSeleccionadas.size === 0) {
        return { ok: true, reglas, seriesAfectadas: [], seriesEliminadas: 0 }
    }

    if (alcance === "todas") {
        return {
            ok: true,
            reglas: reglas.filter(regla => !seriesSeleccionadas.has(idSerie(regla))),
            seriesAfectadas: [...seriesSeleccionadas],
            seriesEliminadas: seriesSeleccionadas.size
        }
    }

    const nuevas = []
    const seriesAfectadas = []
    for (const serieId of seriesSeleccionadas) {
        const serie = reglas.filter(regla => idSerie(regla) === serieId)
        const fechaCorte = fechaDeCorteFuturo(serie, ahora)
        const reglasRecortadas = fechaCorte
            ? recortarSerieDesde(serie, fechaCorte, ahora, plantillaId, plantillaOrigenNombre)
            : serie.map(regla => {
                const excepciones = Object.fromEntries(Object.entries(regla.excepciones).map(([fecha, excepcion]) => {
                    if (excepcion && new Date(excepcion.inicio) >= ahora) return [fecha, null]
                    return [fecha, excepcion]
                }))
                return { ...regla, plantillaOrigenId: plantillaId,
                    ...(plantillaOrigenNombre ? { plantillaOrigenNombre } : {}), excepciones }
            })
        if (JSON.stringify(reglasRecortadas) !== JSON.stringify(serie)) seriesAfectadas.push(serieId)
        nuevas.push(...reglasRecortadas)
    }
    nuevas.push(...reglas.filter(regla => !seriesSeleccionadas.has(idSerie(regla))))
    const orden = new Map(reglas.map((regla, indice) => [regla.id, indice]))
    nuevas.sort((a, b) => orden.get(a.id) - orden.get(b.id))
    return { ok: true, reglas: nuevas, seriesAfectadas, seriesEliminadas: 0 }
}

export function cambiarRecurrencia(reglas, id, fecha, cambios, alcance = "solo") {
    const regla = reglas.find(item => item.id === id)
    if (!regla) return { ok: false, error: "No se encontró la serie semanal." }
    if (alcance === "toda") return { ok: true, reglas: reglas.map(item => (
        (item.idSerie ?? item.id) === (regla.idSerie ?? regla.id) ? actualizarBase(item, cambios) : item
    )) }
    if (alcance === "solo") {
        const inicio = cambios.inicio.toISOString(); const fin = cambios.fin.toISOString()
        const excepciones = { ...regla.excepciones, [fecha]: { id: `excepcion-${id}-${fecha}`, nombre: cambios.evento?.nombre ?? cambios.tarea?.nombre ?? cambios.nombre.trim(),
            eventoId: cambios.evento?.id ?? null, colorEvento: cambios.evento?.color ?? regla.colorEvento,
            ...(cambios.tarea ? { tareaId: cambios.tarea.id, tareaNombre: cambios.tarea.nombre } : {}),
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
    const actualizada = { ...regla, nombre: cambios.evento?.nombre ?? cambios.tarea?.nombre ?? cambios.nombre.trim(), eventoId: cambios.evento?.id ?? null,
        colorEvento: cambios.evento?.color ?? regla.colorEvento,
        ...(cambios.tarea ? { tareaId: cambios.tarea.id, tareaNombre: cambios.tarea.nombre } : {}),
        ...(Number.isInteger(cambios.ordenSeguimiento) ? { ordenSeguimiento: cambios.ordenSeguimiento } : {}),
        segundosInicio: cambios.inicio.getHours() * 3600 + cambios.inicio.getMinutes() * 60 + cambios.inicio.getSeconds(),
        milisegundosInicio: cambios.inicio.getMilliseconds(), duracionMs: cambios.fin - cambios.inicio }
    if (!cambios.tarea) {
        delete actualizada.tareaId
        delete actualizada.tareaNombre
    }
    return actualizada
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
        const reglasBrutas = JSON.parse(texto)
        if (!Array.isArray(reglasBrutas)) return { ok: false, reglas: [], error: "Las recurrencias guardadas no tienen formato de lista." }
        const reglas = []
        const problemas = []
        const ids = new Set()
        reglasBrutas.forEach((regla, indice) => {
            const errorId = ids.has(regla?.id)
            const tieneEvento = typeof regla?.eventoId === "string" && regla.eventoId.trim() !== ""
            const tieneTarea = typeof regla?.tareaId === "string" && regla.tareaId.trim() !== ""
            if (!validarReglaRecurrencia(regla) || errorId) problemas.push({ indice, titulo: regla?.nombre || `Recurrencia ${indice + 1}`, detalle: errorId ? "El identificador de la recurrencia está repetido." : tieneEvento === tieneTarea ? "Debe tener exactamente un origen: una plantilla de evento o una tarea." : "La recurrencia tiene fechas, repeticiones o excepciones inválidas." })
            else { reglas.push(regla); ids.add(regla.id) }
        })
        return { ok: true, reglas, ...(problemas.length ? { problemas } : {}) }
    } catch { return { ok: false, error: "No se pudieron leer las recurrencias guardadas." } }
}

export function guardarRecurrencias(reglas, almacenamiento = null) {
    if (!validarColeccionRecurrencias(reglas)) return { ok: false, error: "No se guardaron las recurrencias porque contienen datos inválidos." }
    try {
        almacenamiento ??= globalThis.localStorage
        let invalidas = []
        try {
            const actuales = JSON.parse(almacenamiento.getItem(CLAVE_RECURRENCIAS) ?? "[]")
            if (!Array.isArray(actuales)) return { ok: false, error: "La colección de recurrencias está corrupta; eliminála desde la revisión de datos antes de continuar." }
            const vistos = new Set()
            invalidas = actuales.filter(regla => {
                if (!validarReglaRecurrencia(regla) || vistos.has(regla?.id)) return true
                vistos.add(regla.id); return false
            })
        } catch { return { ok: false, error: "La colección de recurrencias está corrupta; eliminála desde la revisión de datos antes de continuar." }
        }
        almacenamiento.setItem(CLAVE_RECURRENCIAS, JSON.stringify([...reglas, ...invalidas])); return { ok: true }
    }
    catch { return { ok: false, error: "No se pudieron guardar las recurrencias en este navegador." } }
}

export function eliminarRecurrenciaInvalida(indice, almacenamiento = null) {
    try { almacenamiento ??= globalThis.localStorage; const reglas = JSON.parse(almacenamiento.getItem(CLAVE_RECURRENCIAS) ?? "null"); if (!Array.isArray(reglas) || !Number.isInteger(indice) || indice < 0 || indice >= reglas.length) return { ok: false, error: "No se encontró esa recurrencia inválida." }; reglas.splice(indice, 1); almacenamiento.setItem(CLAVE_RECURRENCIAS, JSON.stringify(reglas)); return { ok: true } }
    catch { return { ok: false, error: "No se pudo eliminar la recurrencia inválida." } }
}
