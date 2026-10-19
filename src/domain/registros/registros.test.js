import assert from "node:assert/strict"
import test from "node:test"

import {
    aplicarLimitesVencidos,
    continuarRegistro,
    crearRegistroManual,
    descartarRegistroPlanSinDuracion,
    editarRegistroFinalizado,
    eliminarRegistroFinalizado,
    ESTADO_REGISTRO_CANCELADO,
    ESTADO_REGISTRO_FINALIZADO,
    finalizarRegistro,
    iniciarRegistro,
    pausarRegistro,
    validarColeccionRegistros
} from "./registros.js"

const fecha = milisegundos => new Date(milisegundos)

function iniciar(nombre = "Lectura") {
    return iniciarRegistro([], nombre, fecha(0), () => "registro-1")
}

test("inicia, pausa, continúa y finaliza conservando segmentos e identidad", () => {
    const inicio = iniciar()
    const pausa = pausarRegistro(inicio.registros, "registro-1", fecha(1000))
    const continuar = continuarRegistro(pausa.registros, "registro-1", fecha(11000))
    const final = finalizarRegistro(continuar.registros, "registro-1", fecha(13000))
    const registro = final.registros[0]

    assert.equal(inicio.ok, true)
    assert.equal(pausa.ok, true)
    assert.equal(continuar.ok, true)
    assert.equal(final.ok, true)
    assert.equal(registro.id, "registro-1")
    assert.equal(registro.estado, ESTADO_REGISTRO_FINALIZADO)
    assert.deepEqual(registro.segmentos.map(segmento => segmento.tipo), [
        "En curso", "Pausado", "En curso"
    ])
    assert.equal(registro.segmentos.at(-1).fin.getTime(), 13000)
})

test("vincula registros iniciados desde un plan y permite descartar solo los que no alcanzaron un segundo", () => {
    const iniciado = iniciarRegistro([], "Desayuno", fecha(0), () => "registro-plan", null, null, "plan-1")
    assert.equal(iniciado.ok, true)
    assert.equal(iniciado.registro.planId, "plan-1")

    const descartado = descartarRegistroPlanSinDuracion(iniciado.registros, "registro-plan", fecha(500))
    assert.equal(descartado.ok, true)
    assert.equal(descartado.registros.length, 0)

    const insuficiente = descartarRegistroPlanSinDuracion(iniciado.registros, "registro-plan", fecha(1000))
    assert.equal(insuficiente.ok, false)
    assert.match(insuficiente.error, /debe conservarse/)
})

test("asocia una tarea a registros temporizados y manuales sin alterar la duración medida", () => {
    const tarea = { id: "tarea-1", nombre: "Leer", estado: "En curso" }
    const iniciado = iniciarRegistro([], "Lectura", fecha(0), () => "registro-tarea", null, tarea)
    assert.equal(iniciado.ok, true)
    assert.equal(iniciado.registro.tareaId, tarea.id)
    assert.equal(iniciado.registro.tareaNombre, tarea.nombre)
    assert.equal(finalizarRegistro(iniciado.registros, iniciado.registro.id, fecha(2000)).registros[0].segmentos[0].fin.getTime(), 2000)

    const manual = crearRegistroManual([], {
        nombre: "Lectura manual", tarea,
        inicio: fecha(0), fin: fecha(5000)
    }, () => "registro-manual-tarea", fecha(6000))
    assert.equal(manual.ok, true)
    assert.equal(manual.registro.tareaId, tarea.id)
    assert.equal(manual.registro.segmentos[0].fin.getTime() - manual.registro.segmentos[0].inicio.getTime(), 5000)
    assert.equal(crearRegistroManual([], { nombre: "Sin vínculo", tarea: { id: "", nombre: "" }, inicio: fecha(0), fin: fecha(5000) }, () => "invalido", fecha(6000)).ok, false)
})

test("no permite finalizar con menos de un segundo efectivo", () => {
    const inicio = iniciar()
    const resultado = finalizarRegistro(inicio.registros, "registro-1", fecha(999))

    assert.equal(resultado.ok, false)
    assert.equal(inicio.registros[0].segmentos[0].fin, null)
})

test("rechaza nombres vacíos y transiciones fuera de orden, y permite iniciar timers paralelos", () => {
    assert.equal(iniciarRegistro([], " ", fecha(0), () => "id").ok, false)

    const registro = iniciar()
    assert.equal(continuarRegistro(registro.registros, "registro-1", fecha(1)).ok, false)
    assert.equal(iniciarRegistro(registro.registros, "Otra", fecha(1), () => "otro").ok, true)
    assert.equal(iniciarRegistro([], "Otra", fecha(0), () => "registro-1").ok, true)
})

test("permite registros y timers superpuestos", () => {
    const primero = iniciar()
    const segundo = iniciarRegistro(primero.registros, "Escritura", fecha(0), () => "registro-2")

    assert.equal(segundo.ok, true)
    assert.equal(validarColeccionRegistros(segundo.registros, fecha(1000)), true)
    assert.equal(iniciarRegistro(segundo.registros, "Música", fecha(1000), () => "registro-3").ok, true)
})

test("finaliza al límite de 24 horas cuando alcanzó un segundo efectivo", () => {
    const inicio = iniciar()
    const pausado = pausarRegistro(inicio.registros, "registro-1", fecha(1000))
    const resultado = aplicarLimitesVencidos(pausado.registros, fecha(86400000))

    assert.equal(resultado.ok, true)
    assert.equal(resultado.cambioPorLimite, true)
    assert.equal(resultado.registros[0].estado, ESTADO_REGISTRO_FINALIZADO)
    assert.equal(resultado.registros[0].segmentos.at(-1).fin.getTime(), 86400000)
})

test("conserva como cancelado un registro que llega al límite sin un segundo efectivo", () => {
    const inicio = iniciar()
    const pausado = pausarRegistro(inicio.registros, "registro-1", fecha(500))
    const resultado = aplicarLimitesVencidos(pausado.registros, fecha(86400000))

    assert.equal(resultado.ok, true)
    assert.equal(resultado.registros[0].estado, ESTADO_REGISTRO_CANCELADO)
    assert.match(resultado.mensaje, /cancelado/)
    assert.equal(resultado.registros[0].segmentos.at(-1).fin.getTime(), 86400000)
    assert.equal(validarColeccionRegistros(resultado.registros, fecha(86400000)), true)
})

test("crea un registro manual vinculado a una plantilla y conserva su nombre y color", () => {
    const evento = { id: "evento-1", nombre: "Lectura", color: "#123ABC" }
    const resultado = crearRegistroManual([], {
        nombre: "Ignorado al elegir plantilla",
        evento,
        inicio: fecha(1000),
        fin: fecha(5000)
    }, () => "manual-1")

    assert.equal(resultado.ok, true)
    assert.equal(resultado.registro.nombre, "Lectura")
    assert.equal(resultado.registro.eventoId, "evento-1")
    assert.equal(resultado.registro.colorEvento, "#123ABC")
    assert.equal(resultado.registro.estado, ESTADO_REGISTRO_FINALIZADO)
})

test("crea un registro manual con una pausa que no cuenta como tiempo efectivo", () => {
    const resultado = crearRegistroManual([], {
        nombre: "Lectura con descanso",
        inicio: fecha(0),
        fin: fecha(9000),
        segmentos: [
            { tipo: "En curso", inicio: fecha(0), fin: fecha(3000) },
            { tipo: "Pausado", inicio: fecha(3000), fin: fecha(5000) },
            { tipo: "En curso", inicio: fecha(5000), fin: fecha(9000) }
        ]
    }, () => "manual-con-pausa", fecha(10000))

    assert.equal(resultado.ok, true)
    assert.deepEqual(resultado.registro.segmentos.map(segmento => segmento.tipo), ["En curso", "Pausado", "En curso"])
    assert.equal(validarColeccionRegistros(resultado.registros, fecha(10000)), true)
})

test("rechaza segmentos manuales con huecos, solapamientos o una pausa inicial", () => {
    const opciones = {
        nombre: "Registro irregular",
        inicio: fecha(0),
        fin: fecha(5000)
    }
    const crear = segmentos => crearRegistroManual([], { ...opciones, segmentos }, () => "irregular", fecha(10000))
    assert.equal(crear([
        { tipo: "En curso", inicio: fecha(0), fin: fecha(2000) },
        { tipo: "Pausado", inicio: fecha(3000), fin: fecha(4000) },
        { tipo: "En curso", inicio: fecha(4000), fin: fecha(5000) }
    ]).error, "Los segmentos deben ser continuos, sin huecos ni solapamientos.")
    assert.equal(crear([
        { tipo: "Pausado", inicio: fecha(0), fin: fecha(2000) },
        { tipo: "En curso", inicio: fecha(2000), fin: fecha(5000) }
    ]).error, "El registro debe comenzar y terminar con un tramo en curso.")
})

test("rechaza registros manuales menores a un segundo y mayores a 24 horas, y permite solaparlos", () => {
    const corto = crearRegistroManual([], {
        nombre: "Lectura",
        inicio: fecha(0),
        fin: fecha(999)
    }, () => "corto")
    const largo = crearRegistroManual([], {
        nombre: "Lectura",
        inicio: fecha(0),
        fin: fecha(86400001)
    }, () => "largo")
    const existente = crearRegistroManual([], {
        nombre: "Existente",
        inicio: fecha(0),
        fin: fecha(5000)
    }, () => "existente")
    const solapado = crearRegistroManual(existente.registros, {
        nombre: "Nuevo",
        inicio: fecha(4000),
        fin: fecha(6000)
    }, () => "solapado")

    assert.equal(corto.ok, false)
    assert.equal(corto.error, "El registro necesita al menos un segundo de tiempo efectivo.")
    assert.equal(largo.ok, false)
    assert.equal(largo.error, "El registro no puede abarcar más de 24 horas entre el inicio y el fin.")
    assert.equal(solapado.ok, true)
    const futuro = crearRegistroManual([], {
        nombre: "Futuro",
        inicio: new Date(Date.now() + 1000),
        fin: new Date(Date.now() + 5000)
    }, () => "futuro")
    assert.equal(futuro.ok, false)
    assert.equal(futuro.error, "El fin no puede ser posterior a la hora actual.")
})

test("da un error específico cuando el inicio manual no tiene una fecha válida", () => {
    const resultado = crearRegistroManual([], {
        nombre: "Lectura",
        inicio: null,
        fin: fecha(5000)
    }, () => "invalido", fecha(10000))

    assert.equal(resultado.ok, false)
    assert.equal(resultado.error, "Ingresá un inicio y un fin con fechas y horas válidas.")
})

test("acepta registros consecutivos que se tocan exactamente, incluso entre días", () => {
    const primero = crearRegistroManual([], {
        nombre: "Actividad nocturna",
        inicio: new Date(2026, 9, 13, 23, 58),
        fin: new Date(2026, 9, 14, 0, 2)
    }, () => "nocturno", new Date(2026, 9, 14, 0, 3))
    const segundo = crearRegistroManual(primero.registros, {
        nombre: "Actividad siguiente",
        inicio: new Date(2026, 9, 14, 0, 2),
        fin: new Date(2026, 9, 14, 0, 3)
    }, () => "siguiente", new Date(2026, 9, 14, 0, 4))

    assert.equal(primero.ok, true)
    assert.equal(segundo.ok, true)
    assert.equal(validarColeccionRegistros(segundo.registros, new Date(2026, 9, 14, 0, 4)), true)
})

test("edita un registro finalizado preservando sus segmentos y actualizando el vínculo", () => {
    const inicio = iniciar()
    const pausa = pausarRegistro(inicio.registros, "registro-1", fecha(1000))
    const continuar = continuarRegistro(pausa.registros, "registro-1", fecha(3000))
    const final = finalizarRegistro(continuar.registros, "registro-1", fecha(4000))
    const evento = { id: "evento-2", nombre: "Escritura", color: "#ABCDEF" }
    const editado = editarRegistroFinalizado(final.registros, "registro-1", {
        nombre: "Escritura",
        evento,
        segmentos: [
            { tipo: "En curso", inicio: fecha(10000), fin: fecha(11000) },
            { tipo: "Pausado", inicio: fecha(11000), fin: fecha(13000) },
            { tipo: "En curso", inicio: fecha(13000), fin: fecha(14000) }
        ]
    }, fecha(15000))

    assert.equal(editado.ok, true)
    assert.equal(editado.registro.estado, ESTADO_REGISTRO_FINALIZADO)
    assert.equal(editado.registro.eventoId, "evento-2")
    assert.deepEqual(editado.registro.segmentos.map(segmento => segmento.tipo), [
        "En curso", "Pausado", "En curso"
    ])
})

test("edita o quita la tarea vinculada y conserva la relación si el cambio no la toca", () => {
    const tarea = { id: "tarea-1", nombre: "Leer" }
    const creado = crearRegistroManual([], { nombre: "Lectura", tarea, inicio: fecha(0), fin: fecha(5000) }, () => "registro-tarea-edit", fecha(6000))
    const segmentos = creado.registro.segmentos
    const conserva = editarRegistroFinalizado(creado.registros, creado.registro.id, { nombre: "Lectura corregida", evento: null, segmentos }, fecha(6000))
    assert.equal(conserva.registro.tareaId, tarea.id)
    const quita = editarRegistroFinalizado(conserva.registros, creado.registro.id, { nombre: "Lectura sin tarea", evento: null, tarea: null, segmentos }, fecha(6000))
    assert.equal(quita.ok, true)
    assert.equal("tareaId" in quita.registro, false)
})

test("rechaza editar registros no finalizados y segmentos discontinuos, y permite solapamientos", () => {
    const activo = iniciar()
    const noFinalizado = editarRegistroFinalizado(activo.registros, "registro-1", {
        nombre: "Otro",
        segmentos: activo.registros[0].segmentos
    }, fecha(1000))
    const primero = crearRegistroManual([], {
        nombre: "Primero", inicio: fecha(0), fin: fecha(4000)
    }, () => "primero")
    const segundo = crearRegistroManual(primero.registros, {
        nombre: "Segundo", inicio: fecha(6000), fin: fecha(8000)
    }, () => "segundo")
    const discontinuo = editarRegistroFinalizado(segundo.registros, "primero", {
        nombre: "Primero",
        segmentos: [
            { tipo: "En curso", inicio: fecha(10000), fin: fecha(11000) },
            { tipo: "Pausado", inicio: fecha(12000), fin: fecha(13000) },
            { tipo: "En curso", inicio: fecha(13000), fin: fecha(14000) }
        ]
    }, fecha(15000))
    const solapado = editarRegistroFinalizado(segundo.registros, "primero", {
        nombre: "Primero",
        segmentos: [{ tipo: "En curso", inicio: fecha(5000), fin: fecha(9000) }]
    }, fecha(10000))

    assert.equal(noFinalizado.ok, false)
    assert.equal(discontinuo.ok, false)
    assert.equal(discontinuo.error, "Los segmentos deben ser continuos, sin huecos ni solapamientos.")
    assert.equal(solapado.ok, true)
})

test("explica por qué una edición finalizada produce un intervalo inválido", () => {
    const existente = crearRegistroManual([], {
        nombre: "Registro",
        inicio: fecha(0),
        fin: fecha(5000)
    }, () => "registro", fecha(10000))
    const editar = (fin, ahora = fecha(10000)) => editarRegistroFinalizado(
        existente.registros,
        "registro",
        { nombre: "Registro", segmentos: [{ tipo: "En curso", inicio: fecha(0), fin }] },
        ahora
    )

    assert.equal(editar(fecha(0)).error, "El fin de cada segmento debe ser posterior a su inicio.")
    assert.equal(editar(fecha(11000)).error, "El registro no puede terminar después de la hora actual.")
    assert.equal(editar(fecha(86400001), fecha(86400002)).error,
        "El registro no puede abarcar más de 24 horas entre el inicio y el fin, incluidas las pausas.")
    assert.equal(editar(fecha(999)).error,
        "El registro necesita al menos un segundo de tiempo efectivo, sin contar las pausas.")
})

test("elimina solo registros finalizados y conserva intactos los demás", () => {
    const objetivo = crearRegistroManual([], {
        nombre: "Eliminar",
        inicio: fecha(0),
        fin: fecha(5000)
    }, () => "objetivo", fecha(10000))
    const conservar = crearRegistroManual(objetivo.registros, {
        nombre: "Conservar",
        inicio: fecha(6000),
        fin: fecha(9000)
    }, () => "conservar", fecha(10000))

    const resultado = eliminarRegistroFinalizado(conservar.registros, "objetivo")
    const noEncontrado = eliminarRegistroFinalizado(conservar.registros, "inexistente")
    const activo = eliminarRegistroFinalizado(iniciar().registros, "registro-1")

    assert.equal(resultado.ok, true)
    assert.deepEqual(resultado.registros.map(registro => registro.id), ["conservar"])
    assert.deepEqual(conservar.registros.map(registro => registro.id), ["objetivo", "conservar"])
    assert.equal(noEncontrado.error, "No se encontró el registro que querés eliminar.")
    assert.equal(activo.error, "Solo se pueden eliminar registros finalizados.")
})
