import assert from "node:assert/strict"
import test from "node:test"

import {
    crearRegistroManual,
    iniciarRegistro,
    pausarRegistro,
    ESTADO_REGISTRO_CANCELADO,
    ESTADO_REGISTRO_EN_CURSO,
    ESTADO_REGISTRO_PAUSADO,
    ESTADO_REGISTRO_FINALIZADO
} from "./registros.js"
import {
    cargarRegistros,
    CLAVE_REGISTROS,
    guardarRegistros
} from "./persistenciaRegistros.js"

const fecha = milisegundos => new Date(milisegundos)

function crearAlmacenamiento(valor = null) {
    const valores = new Map()

    if (valor !== null) {
        valores.set(CLAVE_REGISTROS, valor)
    }

    return {
        valores,
        getItem(clave) {
            return valores.has(clave) ? valores.get(clave) : null
        },
        setItem(clave, contenido) {
            valores.set(clave, contenido)
        }
    }
}

test("devuelve una colección vacía cuando no hay registros guardados", () => {
    assert.deepEqual(cargarRegistros(crearAlmacenamiento(), fecha(0)), {
        ok: true,
        registros: []
    })
})

test("guarda y recupera registros con marcas de tiempo ISO", () => {
    const inicio = iniciarRegistro([], "Lectura", fecha(1000), () => "id-1")
    const almacenamiento = crearAlmacenamiento()

    assert.deepEqual(guardarRegistros(inicio.registros, almacenamiento, fecha(2000)), { ok: true })
    assert.match(almacenamiento.valores.get(CLAVE_REGISTROS), /1970-01-01T00:00:01\.000Z/)

    const recuperado = cargarRegistros(almacenamiento, fecha(3000))
    assert.equal(recuperado.ok, true)
    assert.equal(recuperado.registros[0].estado, ESTADO_REGISTRO_EN_CURSO)
    assert.equal(recuperado.registros[0].segmentos[0].inicio.getTime(), 1000)
})

test("carga registros anteriores como no vinculados a una plantilla", () => {
    const legado = JSON.stringify([{
        id: "legado",
        nombre: "Lectura",
        estado: ESTADO_REGISTRO_FINALIZADO,
        motivoCancelacion: null,
        segmentos: [{
            tipo: ESTADO_REGISTRO_EN_CURSO,
            inicio: "1970-01-01T00:00:00.000Z",
            fin: "1970-01-01T00:00:01.000Z"
        }]
    }])
    const resultado = cargarRegistros(crearAlmacenamiento(legado), fecha(2000))

    assert.equal(resultado.ok, true)
    assert.equal(resultado.registros[0].eventoId, null)
    assert.equal(resultado.registros[0].colorEvento, null)
    assert.equal(resultado.registros[0].nombre, "Lectura")
})

test("conserva la plantilla y su color al guardar y recuperar un registro", () => {
    const inicio = crearRegistroManual([], {
        nombre: "Lectura",
        evento: { id: "evento-1", nombre: "Lectura", color: "#123ABC" },
        inicio: fecha(0),
        fin: fecha(5000)
    }, () => "id-vinculado", fecha(6000))
    const almacenamiento = crearAlmacenamiento()

    assert.equal(guardarRegistros(inicio.registros, almacenamiento, fecha(6000)).ok, true)
    const recuperado = cargarRegistros(almacenamiento, fecha(7000))

    assert.equal(recuperado.ok, true)
    assert.equal(recuperado.registros[0].eventoId, "evento-1")
    assert.equal(recuperado.registros[0].colorEvento, "#123ABC")
})

test("guarda y recupera la tarea vinculada y acepta registros antiguos sin tarea", () => {
    const inicio = crearRegistroManual([], {
        nombre: "Lectura", tarea: { id: "tarea-1", nombre: "Leer", estado: "En curso" },
        inicio: fecha(0), fin: fecha(5000)
    }, () => "id-tarea", fecha(6000))
    const almacenamiento = crearAlmacenamiento()
    assert.equal(guardarRegistros(inicio.registros, almacenamiento, fecha(6000)).ok, true)
    const recuperado = cargarRegistros(almacenamiento, fecha(7000))
    assert.equal(recuperado.ok, true)
    assert.equal(recuperado.registros[0].tareaId, "tarea-1")
    assert.equal(recuperado.registros[0].tareaNombre, "Leer")

    const antiguo = crearAlmacenamiento(JSON.stringify([{
        id: "registro-antiguo", nombre: "Sin tarea", eventoId: null, colorEvento: null,
        estado: ESTADO_REGISTRO_FINALIZADO, motivoCancelacion: null,
        segmentos: [{ tipo: ESTADO_REGISTRO_EN_CURSO, inicio: "1970-01-01T00:00:00.000Z", fin: "1970-01-01T00:00:01.000Z" }]
    }]))
    assert.equal(cargarRegistros(antiguo, fecha(2000)).ok, true)
})

test("guarda y recupera el plan de origen del registro y acepta registros anteriores sin vínculo", () => {
    const inicio = iniciarRegistro([], "Desayuno", fecha(0), () => "id-plan", null, null, "plan-1")
    const almacenamiento = crearAlmacenamiento()
    assert.equal(guardarRegistros(inicio.registros, almacenamiento, fecha(2000)).ok, true)
    const recuperado = cargarRegistros(almacenamiento, fecha(3000))
    assert.equal(recuperado.ok, true)
    assert.equal(recuperado.registros[0].planId, "plan-1")

    const anterior = crearAlmacenamiento(JSON.stringify([{
        id: "registro-sin-plan", nombre: "Actividad", eventoId: null, colorEvento: null,
        estado: ESTADO_REGISTRO_FINALIZADO, motivoCancelacion: null,
        segmentos: [{ tipo: ESTADO_REGISTRO_EN_CURSO, inicio: "1970-01-01T00:00:00.000Z", fin: "1970-01-01T00:00:01.000Z" }]
    }]))
    assert.equal(cargarRegistros(anterior, fecha(2000)).ok, true)
})

test("al recuperar sigue contando desde el segmento activo y conserva las pausas", () => {
    const inicio = iniciarRegistro([], "Lectura", fecha(0), () => "id-1")
    const pausado = pausarRegistro(inicio.registros, "id-1", fecha(1000))
    const almacenamiento = crearAlmacenamiento()

    guardarRegistros(pausado.registros, almacenamiento, fecha(2000))
    const recuperado = cargarRegistros(almacenamiento, fecha(10000))

    assert.equal(recuperado.ok, true)
    assert.equal(recuperado.registros[0].estado, ESTADO_REGISTRO_PAUSADO)
    assert.equal(recuperado.registros[0].segmentos.at(-1).fin, null)
})

test("rechaza JSON dañado sin sobrescribir el registro original", () => {
    const contenidoOriginal = "{incompleto"
    const almacenamiento = crearAlmacenamiento(contenidoOriginal)
    const resultado = cargarRegistros(almacenamiento, fecha(0))

    assert.equal(resultado.ok, false)
    assert.equal(almacenamiento.valores.get(CLAVE_REGISTROS), contenidoOriginal)
})

test("rechaza registros inválidos o solapados sin modificarlos", () => {
    const datosInvalidos = JSON.stringify([{
        id: "id-1",
        nombre: "Lectura",
        estado: ESTADO_REGISTRO_EN_CURSO,
        motivoCancelacion: null,
        segmentos: [{ tipo: ESTADO_REGISTRO_EN_CURSO, inicio: "fecha-inválida", fin: null }]
    }])
    const almacenamiento = crearAlmacenamiento(datosInvalidos)

    assert.equal(cargarRegistros(almacenamiento, fecha(0)).ok, false)
    assert.equal(almacenamiento.valores.get(CLAVE_REGISTROS), datosInvalidos)
})

test("recupera registros históricos superpuestos", () => {
    const datosSolapados = JSON.stringify(["id-1", "id-2"].map(id => ({
        id,
        nombre: "Lectura",
        estado: ESTADO_REGISTRO_FINALIZADO,
        motivoCancelacion: null,
        segmentos: [{
            tipo: ESTADO_REGISTRO_EN_CURSO,
            inicio: id === "id-1" ? "1970-01-01T00:00:00.000Z" : "1970-01-01T00:00:00.500Z",
            fin: id === "id-1" ? "1970-01-01T00:00:01.000Z" : "1970-01-01T00:00:01.500Z"
        }]
    })))
    const almacenamiento = crearAlmacenamiento(datosSolapados)

    assert.equal(cargarRegistros(almacenamiento, fecha(2000)).ok, true)
    assert.equal(almacenamiento.valores.get(CLAVE_REGISTROS), datosSolapados)
})

test("recupera y persiste el cierre automático de un registro vencido", () => {
    const inicio = iniciarRegistro([], "Lectura", fecha(0), () => "id-1")
    const pausado = pausarRegistro(inicio.registros, "id-1", fecha(1000))
    const almacenamiento = crearAlmacenamiento()
    guardarRegistros(pausado.registros, almacenamiento, fecha(2000))

    const recuperado = cargarRegistros(almacenamiento, fecha(86400000))

    assert.equal(recuperado.ok, true)
    assert.equal(recuperado.registros[0].estado, ESTADO_REGISTRO_FINALIZADO)
    assert.equal(JSON.parse(almacenamiento.valores.get(CLAVE_REGISTROS))[0].estado, ESTADO_REGISTRO_FINALIZADO)
})

test("recupera como cancelado el registro vencido que no alcanzó la duración mínima", () => {
    const inicio = iniciarRegistro([], "Lectura", fecha(0), () => "id-1")
    const pausado = pausarRegistro(inicio.registros, "id-1", fecha(500))
    const almacenamiento = crearAlmacenamiento()
    guardarRegistros(pausado.registros, almacenamiento, fecha(2000))

    const recuperado = cargarRegistros(almacenamiento, fecha(86400000))

    assert.equal(recuperado.ok, true)
    assert.equal(recuperado.registros[0].estado, ESTADO_REGISTRO_CANCELADO)
    assert.equal(JSON.parse(almacenamiento.valores.get(CLAVE_REGISTROS))[0].estado, ESTADO_REGISTRO_CANCELADO)
})

test("informa los errores de lectura y escritura", () => {
    const errorLectura = cargarRegistros({
        getItem() {
            throw new Error("acceso denegado")
        }
    }, fecha(0))
    const errorEscritura = guardarRegistros([], {
        setItem() {
            throw new Error("cuota excedida")
        }
    }, fecha(0))

    assert.equal(errorLectura.ok, false)
    assert.equal(errorEscritura.ok, false)
})

test("si falla persistir el cierre al recuperar, conserva el registro cargado y avisa", () => {
    const inicio = iniciarRegistro([], "Lectura", fecha(0), () => "id-1")
    const pausado = pausarRegistro(inicio.registros, "id-1", fecha(1000))
    const almacenamiento = {
        getItem() {
            return JSON.stringify(pausado.registros)
        },
        setItem() {
            throw new Error("cuota excedida")
        }
    }
    const resultado = cargarRegistros(almacenamiento, fecha(86400000))

    assert.equal(resultado.ok, true)
    assert.equal(resultado.registros[0].estado, ESTADO_REGISTRO_FINALIZADO)
    assert.match(resultado.advertencia, /No se pudieron guardar/)
})
