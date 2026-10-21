import assert from "node:assert/strict"
import test from "node:test"

import { crearSecuenciaSeguimiento, validarEstadoSeguimiento } from "./seguimientoPlanificacion.js"
import {
    CLAVE_SEGUIMIENTO_PLANIFICACION,
    cargarSeguimientoPlanificacion,
    guardarSeguimientoPlanificacion
} from "./persistenciaSeguimientoPlanificacion.js"

const fecha = (hora, minuto = 0, segundo = 0) => new Date(2026, 9, 18, hora, minuto, segundo)

function plan(id, inicio, fin, eventoId = "evento") {
    return { id, nombre: id, eventoId, inicio, fin }
}

test("arma la secuencia de todo el día desde el primero o desde el evento seleccionado", () => {
    const planes = [
        plan("tarde", fecha(14), fecha(14, 30)),
        plan("primero", fecha(9), fecha(9, 10)),
        plan("medio", fecha(9, 10), fecha(9, 30))
    ]
    const eventos = [{ id: "evento", nombre: "Desayuno", color: "#123456" }]

    const desdePrimero = crearSecuenciaSeguimiento(planes, "primero", eventos)
    assert.equal(desdePrimero.ok, true)
    assert.deepEqual(desdePrimero.secuencia.map(item => item.planId), ["primero", "medio", "tarde"])
    assert.equal(desdePrimero.secuencia[0].duracionMs, 10 * 60_000)
    assert.deepEqual(desdePrimero.secuencia[0].evento, eventos[0])

    const desdeMedio = crearSecuenciaSeguimiento(planes, "medio", eventos)
    assert.deepEqual(desdeMedio.secuencia.map(item => item.planId), ["medio", "tarde"])
})

test("ordena empates de forma estable y conserva actividades sin plantilla", () => {
    const planes = [
        plan("b", fecha(9), fecha(9, 5), null),
        plan("a", fecha(9), fecha(9, 5), null)
    ]
    const resultado = crearSecuenciaSeguimiento(planes, "a")
    assert.deepEqual(resultado.secuencia.map(item => item.planId), ["a", "b"])
    assert.equal(resultado.secuencia[0].evento, null)
})

test("respeta el orden explícito de seguimiento sin cambiar los horarios ni perder solapamientos", () => {
    const planes = [
        { ...plan("activo", fecha(9), fecha(9, 5), null), ordenSeguimiento: 0 },
        { ...plan("primero-en-calendario", fecha(9, 5), fecha(9, 20), null), ordenSeguimiento: 2 },
        { ...plan("segundo-en-calendario", fecha(9, 10), fecha(9, 25), null), ordenSeguimiento: 1 }
    ]

    const resultado = crearSecuenciaSeguimiento(planes, "activo")
    assert.equal(resultado.ok, true)
    assert.deepEqual(resultado.secuencia.map(item => item.planId), [
        "activo", "segundo-en-calendario", "primero-en-calendario"
    ])
    assert.equal(resultado.secuencia[1].inicioPrevisto, fecha(9, 10).toISOString())
    assert.equal(resultado.secuencia[1].finPrevisto, fecha(9, 25).toISOString())
    assert.equal(resultado.secuencia[2].inicioPrevisto, fecha(9, 5).toISOString())
    assert.equal(resultado.secuencia[2].finPrevisto, fecha(9, 20).toISOString())
})

test("rechaza planes que no pueden producir registros válidos", () => {
    assert.match(crearSecuenciaSeguimiento([
        plan("corto", fecha(9), new Date(fecha(9).getTime() + 999), null)
    ], "corto").error, /entre un segundo y 24 horas/)

    assert.match(crearSecuenciaSeguimiento([
        plan("largo", fecha(9), new Date(fecha(9).getTime() + 24 * 60 * 60 * 1000 + 1), null)
    ], "largo").error, /entre un segundo y 24 horas/)
})

test("valida y persiste la sesión activa", () => {
    const estado = {
        id: "seguimiento-1",
        estado: "En curso",
        secuencia: [{
            planId: "plan-1", nombre: "Desayuno", evento: null,
            inicioPrevisto: fecha(9).toISOString(), finPrevisto: fecha(9, 10).toISOString(),
            duracionMs: 10 * 60_000
        }],
        indiceActual: 0,
        registroId: "registro-1",
        inicio: fecha(10).toISOString(),
        finBloque: fecha(10, 10).toISOString()
    }
    const datos = new Map()
    const almacenamiento = {
        getItem: clave => datos.get(clave) ?? null,
        setItem: (clave, valor) => datos.set(clave, valor),
        removeItem: clave => datos.delete(clave)
    }

    assert.equal(validarEstadoSeguimiento(estado), true)
    assert.equal(guardarSeguimientoPlanificacion(estado, almacenamiento).ok, true)
    assert.deepEqual(cargarSeguimientoPlanificacion(almacenamiento).estado, estado)
    assert.equal(datos.has(CLAVE_SEGUIMIENTO_PLANIFICACION), true)
    assert.equal(guardarSeguimientoPlanificacion(null, almacenamiento).ok, true)
    assert.equal(cargarSeguimientoPlanificacion(almacenamiento).estado, null)
})
