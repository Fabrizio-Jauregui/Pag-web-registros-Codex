import {
    calcularLimiteRegistro,
    cerrarSegmentoAbierto,
    DURACION_MAXIMA_MS,
    calcularTiempoEfectivo,
    puedeFinalizarRegistro,
    seAlcanzoLimiteRegistro
} from "../tiempo/CalculosDuracion.js"

export const ESTADO_REGISTRO_EN_CURSO = "En curso"
export const ESTADO_REGISTRO_PAUSADO = "Pausado"
export const ESTADO_REGISTRO_FINALIZADO = "Finalizado"
export const ESTADO_REGISTRO_CANCELADO = "Cancelado"
export const MOTIVO_CANCELACION_LIMITE = "Limite de 24 horas sin un segundo efectivo"

function esFechaValida(fecha) {
    return fecha instanceof Date && Number.isFinite(fecha.getTime())
}

function validarRegistro(registro, ahora, permitirLimiteExcedido) {
    if (
        registro === null
        || typeof registro !== "object"
        || typeof registro.id !== "string"
        || registro.id.trim() === ""
        || typeof registro.nombre !== "string"
        || registro.nombre.trim() === ""
        || (registro.eventoId !== null && (
            typeof registro.eventoId !== "string" || registro.eventoId.trim() === ""
        ))
        || (registro.colorEvento !== null && (
            typeof registro.colorEvento !== "string"
            || !/^#[\da-fA-F]{6}$/.test(registro.colorEvento)
        ))
        || (registro.eventoId === null && registro.colorEvento !== null)
        || (registro.eventoId !== null && registro.colorEvento === null)
        || (registro.tareaId !== undefined && registro.tareaId !== null
            && (typeof registro.tareaId !== "string" || registro.tareaId.trim() === ""))
        || (registro.tareaNombre !== undefined && registro.tareaNombre !== null
            && (typeof registro.tareaNombre !== "string" || registro.tareaNombre.trim() === ""))
        || (registro.planId !== undefined && registro.planId !== null
            && (typeof registro.planId !== "string" || registro.planId.trim() === ""))
        || (registro.origenFocus !== undefined && typeof registro.origenFocus !== "boolean")
        || (typeof registro.tareaId === "string"
            && (typeof registro.tareaNombre !== "string" || registro.tareaNombre.trim() === ""))
        || ((registro.tareaId === undefined || registro.tareaId === null)
            && registro.tareaNombre !== undefined && registro.tareaNombre !== null)
        || !Array.isArray(registro.segmentos)
        || registro.segmentos.length === 0
        || ![
            ESTADO_REGISTRO_EN_CURSO,
            ESTADO_REGISTRO_PAUSADO,
            ESTADO_REGISTRO_FINALIZADO,
            ESTADO_REGISTRO_CANCELADO
        ].includes(registro.estado)
    ) {
        return false
    }

    if (
        [ESTADO_REGISTRO_EN_CURSO, ESTADO_REGISTRO_PAUSADO].includes(registro.estado)
        && registro.motivoCancelacion !== null
    ) {
        return false
    }

    let finAnterior = null

    for (let indice = 0; indice < registro.segmentos.length; indice += 1) {
        const segmento = registro.segmentos[indice]
        const esUltimo = indice === registro.segmentos.length - 1
        const abierto = segmento?.fin === null

        if (
            segmento === null
            || typeof segmento !== "object"
            || ![ESTADO_REGISTRO_EN_CURSO, ESTADO_REGISTRO_PAUSADO].includes(segmento.tipo)
            || !esFechaValida(segmento.inicio)
            || (!abierto && !esFechaValida(segmento.fin))
            || (indice > 0 && registro.segmentos[indice - 1].tipo === segmento.tipo)
        ) {
            return false
        }

        if (abierto !== (esUltimo && registro.estado === segmento.tipo)) {
            return false
        }

        if (finAnterior !== null && segmento.inicio.getTime() !== finAnterior) {
            return false
        }

        const fin = abierto ? ahora : segmento.fin

        if (!esFechaValida(fin) || fin.getTime() < segmento.inicio.getTime()) {
            return false
        }

        finAnterior = fin.getTime()
    }

    const estaAbierto = [ESTADO_REGISTRO_EN_CURSO, ESTADO_REGISTRO_PAUSADO]
        .includes(registro.estado)

    if (estaAbierto !== (registro.segmentos.at(-1).fin === null)) {
        return false
    }

    if (!estaAbierto && registro.estado === ESTADO_REGISTRO_FINALIZADO) {
        if (
            registro.motivoCancelacion !== null
            || registro.segmentos.at(-1).fin.getTime() > ahora.getTime()
            || !puedeFinalizarRegistro(registro.segmentos, ahora)
        ) {
            return false
        }
    }

    if (!estaAbierto && registro.estado === ESTADO_REGISTRO_CANCELADO) {
        if (
            registro.motivoCancelacion !== MOTIVO_CANCELACION_LIMITE
            || registro.segmentos.at(-1).fin.getTime()
                - registro.segmentos[0].inicio.getTime() !== DURACION_MAXIMA_MS
            || puedeFinalizarRegistro(registro.segmentos, ahora)
        ) {
            return false
        }
    }

    if (!permitirLimiteExcedido && estaAbierto) {
        const limite = calcularLimiteRegistro(registro.segmentos[0].inicio)

        if (limite === null || ahora.getTime() > limite.getTime()) {
            return false
        }
    }

    if (!estaAbierto) {
        const duracionTotal = registro.segmentos.at(-1).fin.getTime()
            - registro.segmentos[0].inicio.getTime()

        if (duracionTotal > DURACION_MAXIMA_MS) {
            return false
        }
    }

    return true
}

export function validarColeccionRegistros(registros, ahora = new Date(), opciones = {}) {
    if (!Array.isArray(registros) || !esFechaValida(ahora)) {
        return false
    }

    const ids = new Set()
    for (const registro of registros) {
        if (
            !validarRegistro(registro, ahora, opciones.permitirLimiteExcedido === true)
            || ids.has(registro.id)
        ) {
            return false
        }

        ids.add(registro.id)

    }
    return true
}

function validarEvento(evento) {
    return evento === null || (
        evento !== null
        && typeof evento === "object"
        && typeof evento.id === "string"
        && evento.id.trim() !== ""
        && typeof evento.nombre === "string"
        && evento.nombre.trim() !== ""
        && typeof evento.color === "string"
        && /^#[\da-fA-F]{6}$/.test(evento.color)
    )
}

function datosDeEvento(evento) {
    return evento === null
        ? { eventoId: null, colorEvento: null }
        : { eventoId: evento.id, colorEvento: evento.color.toUpperCase() }
}

function validarTarea(tarea) {
    return tarea === null || (tarea !== null
        && typeof tarea === "object"
        && typeof tarea.id === "string" && tarea.id.trim() !== ""
        && typeof tarea.nombre === "string" && tarea.nombre.trim() !== "")
}

function datosDeTarea(tarea) {
    return tarea === null ? {} : {
        tareaId: tarea.id,
        tareaNombre: tarea.nombre.trim()
    }
}

function obtenerNombre(nombre, evento) {
    return evento === null ? nombre.trim() : evento.nombre.trim()
}

function crearIdUnico(registros, generarId) {
    let id

    try {
        id = generarId()
    } catch {
        return { ok: false, error: "No se pudo crear la identidad del registro." }
    }

    if (typeof id !== "string" || id.trim() === "" || registros.some(registro => registro.id === id)) {
        return { ok: false, error: "No se pudo crear una identidad única para el registro." }
    }

    return { ok: true, id }
}

export function iniciarRegistro(
    registros,
    nombre,
    instante,
    generarId = () => globalThis.crypto.randomUUID(),
    evento = null,
    tarea = null,
    planId = null,
    opciones = {}
) {
    if (!validarColeccionRegistros(registros, instante)) {
        return { ok: false, error: "Los registros actuales tienen intervalos inválidos." }
    }

    if (!validarEvento(evento)) {
        return { ok: false, error: "La plantilla de evento seleccionada no es válida." }
    }

    if (!validarTarea(tarea)) return { ok: false, error: "La tarea seleccionada no es válida." }

    if (planId !== null && (typeof planId !== "string" || planId.trim() === "")) {
        return { ok: false, error: "El plan de origen no es válido." }
    }

    if (opciones.origenFocus !== undefined && typeof opciones.origenFocus !== "boolean") {
        return { ok: false, error: "El origen Focus del registro no es válido." }
    }

    if (typeof nombre !== "string" || (evento === null && nombre.trim() === "")) {
        return { ok: false, error: "Escribí un nombre para iniciar el registro." }
    }

    if (!esFechaValida(instante)) {
        return { ok: false, error: "No se pudo obtener una fecha válida para iniciar." }
    }

    const identidad = crearIdUnico(registros, generarId)

    if (!identidad.ok) {
        return identidad
    }

    const registro = {
        id: identidad.id,
        nombre: obtenerNombre(nombre, evento),
        ...datosDeEvento(evento),
        ...datosDeTarea(tarea),
        ...(planId ? { planId } : {}),
        ...(opciones.origenFocus ? { origenFocus: true } : {}),
        estado: ESTADO_REGISTRO_EN_CURSO,
        motivoCancelacion: null,
        segmentos: [{ tipo: ESTADO_REGISTRO_EN_CURSO, inicio: instante, fin: null }]
    }
    const nuevosRegistros = [...registros, registro]

    if (!validarColeccionRegistros(nuevosRegistros, instante)) {
        return { ok: false, error: "No se pudo validar el nuevo registro." }
    }

    return { ok: true, registros: nuevosRegistros, registro }
}

function segmentoEnCursoEnInstante(registro, instante) {
    return registro.segmentos.some(segmento => segmento.tipo === ESTADO_REGISTRO_EN_CURSO
        && segmento.inicio.getTime() <= instante.getTime()
        && (segmento.fin === null || instante.getTime() < segmento.fin.getTime()))
}

export function obtenerConflictoConcentracion(registros, instante, registroIdExcluir = null) {
    const focus = registros.find(registro => registro.id !== registroIdExcluir
        && registro.origenFocus === true
        && segmentoEnCursoEnInstante(registro, instante))
    if (focus) return { tipo: "focus", registro: focus }

    const actividad = registros.find(registro => registro.id !== registroIdExcluir
        && registro.origenFocus !== true
        && segmentoEnCursoEnInstante(registro, instante))
    return actividad ? { tipo: "actividad", registro: actividad } : null
}

export function validarExclusividadConcentracion(registros, opciones = {}) {
    const candidato = opciones.candidato
    if (!candidato) return { ok: true }
    const existente = registros.filter(registro => registro.id !== candidato.id)
    for (const segmento of candidato.segmentos) {
        if (segmento?.tipo !== ESTADO_REGISTRO_EN_CURSO || !esFechaValida(segmento.inicio)
            || (segmento.fin !== null && !esFechaValida(segmento.fin))) continue
        const inicio = segmento.inicio.getTime()
        const fin = segmento.fin?.getTime() ?? Number.POSITIVE_INFINITY
        const conflicto = existente.find(registro => (registro.origenFocus === true || candidato.origenFocus === true)
            && registro.segmentos.some(otro => otro.tipo === ESTADO_REGISTRO_EN_CURSO
                && inicio < (otro.fin?.getTime() ?? Number.POSITIVE_INFINITY)
                && otro.inicio.getTime() < fin))
        if (conflicto) {
            return {
                ok: false,
                error: `El registro se superpone con la concentración Focus “${conflicto.nombre}”.`
            }
        }
    }
    return { ok: true }
}

export function crearRegistroManual(
    registros,
    { nombre, evento = null, tarea = null, inicio, fin, segmentos: segmentosEntrada = null },
    generarId = () => globalThis.crypto.randomUUID(),
    ahora = new Date()
) {
    const segmentos = segmentosEntrada ?? (esFechaValida(inicio) && esFechaValida(fin)
        ? [{ tipo: ESTADO_REGISTRO_EN_CURSO, inicio, fin }]
        : null)

    if (
        !Array.isArray(segmentos)
        || segmentos.length === 0
    ) {
        if (segmentosEntrada === null && (!esFechaValida(inicio) || !esFechaValida(fin))) {
            return { ok: false, error: "Ingresá un inicio y un fin con fechas y horas válidas." }
        }
        return { ok: false, error: "Ingresá al menos un segmento con fechas y horas válidas." }
    }

    if (!esFechaValida(ahora)) {
        return { ok: false, error: "No se pudo determinar la hora actual para validar el registro." }
    }

    for (let indice = 0; indice < segmentos.length; indice += 1) {
        const segmento = segmentos[indice]
        if (!esFechaValida(segmento?.inicio) || !esFechaValida(segmento?.fin)) {
            return { ok: false, error: "Ingresá fechas y horas válidas para todos los segmentos." }
        }
        if (![ESTADO_REGISTRO_EN_CURSO, ESTADO_REGISTRO_PAUSADO].includes(segmento.tipo)) {
            return { ok: false, error: "Cada tramo debe indicar si fue en curso o en pausa." }
        }
        if ((indice === 0 || indice === segmentos.length - 1) && segmento.tipo !== ESTADO_REGISTRO_EN_CURSO) {
            return { ok: false, error: "El registro debe comenzar y terminar con un tramo en curso." }
        }
        if (indice > 0 && segmentos[indice - 1].tipo === segmento.tipo) {
            return { ok: false, error: "Los tramos en curso y en pausa deben alternarse." }
        }
        if (segmento.fin.getTime() <= segmento.inicio.getTime()) {
            return {
                ok: false,
                error: segmentos.length === 1
                    ? "El fin debe ser posterior al inicio."
                    : "El fin de cada segmento debe ser posterior a su inicio."
            }
        }
        if (indice > 0 && segmento.inicio.getTime() !== segmentos[indice - 1].fin.getTime()) {
            return { ok: false, error: "Los segmentos deben ser continuos, sin huecos ni solapamientos." }
        }
    }

    inicio = segmentos[0].inicio
    fin = segmentos.at(-1).fin

    if (fin.getTime() > ahora.getTime()) {
        return { ok: false, error: "El fin no puede ser posterior a la hora actual." }
    }

    if (fin.getTime() - inicio.getTime() > DURACION_MAXIMA_MS) {
        return {
            ok: false,
            error: "El registro no puede abarcar más de 24 horas entre el inicio y el fin."
        }
    }

    if (calcularTiempoEfectivo(segmentos, ahora) < 1) {
        return {
            ok: false,
            error: segmentos.some(segmento => segmento.tipo === ESTADO_REGISTRO_PAUSADO)
                ? "El registro necesita al menos un segundo de tiempo efectivo, sin contar las pausas."
                : "El registro necesita al menos un segundo de tiempo efectivo."
        }
    }

    if (!validarEvento(evento)) {
        return { ok: false, error: "La plantilla de evento seleccionada no es válida." }
    }

    if (!validarTarea(tarea)) return { ok: false, error: "La tarea seleccionada no es válida." }

    if (typeof nombre !== "string" || (evento === null && nombre.trim() === "")) {
        return { ok: false, error: "Escribí un nombre para el registro." }
    }

    const identidad = crearIdUnico(registros, generarId)

    if (!identidad.ok) {
        return identidad
    }

    const registro = {
        id: identidad.id,
        nombre: obtenerNombre(nombre, evento),
        ...datosDeEvento(evento),
        ...datosDeTarea(tarea),
        estado: ESTADO_REGISTRO_FINALIZADO,
        motivoCancelacion: null,
        segmentos: segmentos.map(segmento => ({ ...segmento }))
    }
    const nuevosRegistros = [...registros, registro]

    const exclusividad = validarExclusividadConcentracion(registros, { candidato: registro })
    if (!exclusividad.ok) return exclusividad

    if (!validarColeccionRegistros(nuevosRegistros, ahora)) {
        return {
            ok: false,
            error: "El registro debe durar entre un segundo efectivo y 24 horas."
        }
    }

    return { ok: true, registros: nuevosRegistros, registro }
}

export function editarRegistroFinalizado(registros, id, cambios, ahora = new Date()) {
    const registro = buscarRegistro(registros, id)

    if (!registro || registro.estado !== ESTADO_REGISTRO_FINALIZADO) {
        return { ok: false, error: "Solo se pueden editar registros finalizados." }
    }

    const evento = cambios?.evento ?? null
    const tarea = cambios && Object.hasOwn(cambios, "tarea") ? cambios.tarea : (
        registro.tareaId ? { id: registro.tareaId, nombre: registro.tareaNombre } : null
    )
    const nombre = cambios?.nombre
    const segmentos = cambios?.segmentos

    if (!validarEvento(evento)) {
        return { ok: false, error: "La plantilla de evento seleccionada no es válida." }
    }

    if (!validarTarea(tarea)) return { ok: false, error: "La tarea seleccionada no es válida." }

    if (typeof nombre !== "string" || (evento === null && nombre.trim() === "")) {
        return { ok: false, error: "Escribí un nombre para el registro." }
    }

    if (!Array.isArray(segmentos) || segmentos.length === 0) {
        return { ok: false, error: "El registro necesita al menos un segmento." }
    }

    const actualizado = {
        ...registro,
        nombre: obtenerNombre(nombre, evento),
        ...datosDeEvento(evento),
        ...datosDeTarea(tarea),
        segmentos: segmentos.map(segmento => ({ ...segmento }))
    }
    if (tarea === null) {
        delete actualizado.tareaId
        delete actualizado.tareaNombre
    }

    const exclusividad = validarExclusividadConcentracion(registros, { candidato: actualizado })
    if (!exclusividad.ok) return exclusividad

    const errorTemporal = explicarIntervalosFinalizados(actualizado, ahora)

    if (errorTemporal) {
        return { ok: false, error: errorTemporal }
    }

    return reemplazarRegistro(registros, actualizado, ahora)
}

export function eliminarRegistroFinalizado(registros, id) {
    const registro = buscarRegistro(registros, id)

    if (!registro) {
        return { ok: false, error: "No se encontró el registro que querés eliminar." }
    }

    if (registro.estado !== ESTADO_REGISTRO_FINALIZADO) {
        return { ok: false, error: "Solo se pueden eliminar registros finalizados." }
    }

    return {
        ok: true,
        registros: registros.filter(elemento => elemento.id !== id)
    }
}

function explicarIntervalosFinalizados(registro, ahora) {
    const segmentos = registro.segmentos

    if (!esFechaValida(ahora) || !Array.isArray(segmentos) || segmentos.length === 0) {
        return null
    }

    for (let indice = 0; indice < segmentos.length; indice += 1) {
        const segmento = segmentos[indice]

        if (!esFechaValida(segmento?.inicio) || !esFechaValida(segmento?.fin)) {
            return "Ingresá fechas y horas válidas para todos los segmentos."
        }

        if (segmento.fin.getTime() <= segmento.inicio.getTime()) {
            return "El fin de cada segmento debe ser posterior a su inicio."
        }

        if (
            indice > 0
            && segmento.inicio.getTime() !== segmentos[indice - 1].fin?.getTime()
        ) {
            return "Los segmentos deben ser continuos, sin huecos ni solapamientos."
        }
    }

    const inicio = segmentos[0].inicio
    const fin = segmentos.at(-1).fin

    if (fin.getTime() > ahora.getTime()) {
        return "El registro no puede terminar después de la hora actual."
    }

    if (fin.getTime() - inicio.getTime() > DURACION_MAXIMA_MS) {
        return "El registro no puede abarcar más de 24 horas entre el inicio y el fin, incluidas las pausas."
    }

    if (calcularTiempoEfectivo(segmentos, ahora) < 1) {
        return "El registro necesita al menos un segundo de tiempo efectivo, sin contar las pausas."
    }

    return null
}

function buscarRegistro(registros, id) {
    return registros.find(registro => registro.id === id)
}

function reemplazarRegistro(registros, registroActualizado, ahora) {
    const nuevosRegistros = registros.map(registro => (
        registro.id === registroActualizado.id ? registroActualizado : registro
    ))

    if (!validarColeccionRegistros(nuevosRegistros, ahora)) {
        return { ok: false, error: "La operación produciría intervalos temporales inválidos." }
    }

    return { ok: true, registros: nuevosRegistros, registro: registroActualizado }
}

function cerrarPorLimite(registros, registro, ahora) {
    const limite = calcularLimiteRegistro(registro.segmentos[0].inicio)

    if (limite === null || !seAlcanzoLimiteRegistro(registro.segmentos[0].inicio, ahora)) {
        return null
    }

    const segmentos = cerrarSegmentoAbierto(registro.segmentos, limite)

    if (segmentos === null) {
        return { ok: false, error: "No se pudo cerrar el segmento temporal del registro." }
    }

    const duracionMinimaAlcanzada = puedeFinalizarRegistro(segmentos, limite)
    const actualizado = {
        ...registro,
        estado: duracionMinimaAlcanzada
            ? ESTADO_REGISTRO_FINALIZADO
            : ESTADO_REGISTRO_CANCELADO,
        motivoCancelacion: duracionMinimaAlcanzada ? null : MOTIVO_CANCELACION_LIMITE,
        segmentos
    }
    const resultado = reemplazarRegistro(registros, actualizado, limite)

    if (!resultado.ok) {
        return resultado
    }

    return {
        ...resultado,
        cambioPorLimite: true,
        mensaje: duracionMinimaAlcanzada
            ? "El registro se finalizó automáticamente al alcanzar las 24 horas."
            : "El registro se conservó como cancelado: alcanzó 24 horas sin un segundo efectivo."
    }
}

export function aplicarLimitesVencidos(registros, ahora = new Date()) {
    let registrosActualizados = registros
    let cambioPorLimite = false
    let mensaje = ""

    for (const registro of registros) {
        if (![ESTADO_REGISTRO_EN_CURSO, ESTADO_REGISTRO_PAUSADO].includes(registro.estado)) {
            continue
        }

        const resultado = cerrarPorLimite(registrosActualizados, registro, ahora)

        if (resultado && !resultado.ok) {
            return resultado
        }
        if (resultado?.cambioPorLimite) {
            registrosActualizados = resultado.registros
            cambioPorLimite = true
            mensaje = resultado.mensaje
        }
    }

    return { ok: true, registros: registrosActualizados, cambioPorLimite, mensaje }
}

function resolverLimiteAntesDeOperacion(registros, id, instante) {
    const registro = buscarRegistro(registros, id)

    if (!registro) {
        return { ok: false, error: "No se encontró el registro." }
    }

    return cerrarPorLimite(registros, registro, instante)
}

export function pausarRegistro(registros, id, instante) {
    const registro = buscarRegistro(registros, id)

    if (!registro || registro.estado !== ESTADO_REGISTRO_EN_CURSO) {
        return { ok: false, error: "Solo se puede pausar un registro en curso." }
    }

    const porLimite = resolverLimiteAntesDeOperacion(registros, id, instante)

    if (porLimite !== null) {
        return porLimite
    }

    const segmentos = cerrarSegmentoAbierto(registro.segmentos, instante)

    if (segmentos === null) {
        return { ok: false, error: "No se pudo cerrar el segmento en curso." }
    }

    const actualizado = {
        ...registro,
        estado: ESTADO_REGISTRO_PAUSADO,
        segmentos: [...segmentos, { tipo: ESTADO_REGISTRO_PAUSADO, inicio: instante, fin: null }]
    }

    return reemplazarRegistro(registros, actualizado, instante)
}

export function continuarRegistro(registros, id, instante) {
    const registro = buscarRegistro(registros, id)

    if (!registro || registro.estado !== ESTADO_REGISTRO_PAUSADO) {
        return { ok: false, error: "Solo se puede continuar un registro pausado." }
    }

    const porLimite = resolverLimiteAntesDeOperacion(registros, id, instante)

    if (porLimite !== null) {
        return porLimite
    }

    const segmentos = cerrarSegmentoAbierto(registro.segmentos, instante)

    if (segmentos === null) {
        return { ok: false, error: "No se pudo cerrar el segmento pausado." }
    }

    const actualizado = {
        ...registro,
        estado: ESTADO_REGISTRO_EN_CURSO,
        segmentos: [...segmentos, { tipo: ESTADO_REGISTRO_EN_CURSO, inicio: instante, fin: null }]
    }

    return reemplazarRegistro(registros, actualizado, instante)
}

export function finalizarRegistro(registros, id, instante) {
    const registro = buscarRegistro(registros, id)

    if (
        !registro
        || ![ESTADO_REGISTRO_EN_CURSO, ESTADO_REGISTRO_PAUSADO].includes(registro.estado)
    ) {
        return { ok: false, error: "Solo se puede finalizar un registro activo o pausado." }
    }

    const porLimite = resolverLimiteAntesDeOperacion(registros, id, instante)

    if (porLimite !== null) {
        return porLimite
    }

    const segmentos = cerrarSegmentoAbierto(registro.segmentos, instante)

    if (segmentos === null) {
        return { ok: false, error: "No se pudo cerrar el segmento del registro." }
    }

    if (!puedeFinalizarRegistro(segmentos, instante)) {
        return { ok: false, error: "El registro necesita al menos un segundo efectivo para finalizarse." }
    }

    return reemplazarRegistro(registros, {
        ...registro,
        estado: ESTADO_REGISTRO_FINALIZADO,
        motivoCancelacion: null,
        segmentos
    }, instante)
}

export function descartarRegistroPlanSinDuracion(registros, id, instante) {
    const registro = buscarRegistro(registros, id)
    if (!registro || !registro.planId
        || ![ESTADO_REGISTRO_EN_CURSO, ESTADO_REGISTRO_PAUSADO].includes(registro.estado)) {
        return { ok: false, error: "Solo se puede descartar un registro de plan activo." }
    }
    if (!esFechaValida(instante) || calcularTiempoEfectivo(registro.segmentos, instante) >= 1) {
        return { ok: false, error: "El registro ya tiene tiempo suficiente y debe conservarse." }
    }

    const nuevosRegistros = registros.filter(elemento => elemento.id !== id)
    if (!validarColeccionRegistros(nuevosRegistros, instante)) {
        return { ok: false, error: "No se pudo descartar el registro de duración insuficiente." }
    }
    return { ok: true, registros: nuevosRegistros }
}
