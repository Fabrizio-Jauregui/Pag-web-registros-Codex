import assert from "node:assert/strict"
import test from "node:test"

import {
    actualizarPlan,
    crearPlan,
    eliminarAplicacionPlan,
    eliminarPlan,
    validarPlan
} from "./planes.js"
import {
    cargarPlanes,
    CLAVE_PLANES,
    guardarPlanes
} from "./persistenciaPlanes.js"

const inicio = new Date("2026-10-13T12:00:00.000Z")
const fin = new Date("2026-10-13T13:00:00.000Z")

function crearAlmacenamiento() {
    const valores = new Map()
    return {
        valores,
        getItem(clave) { return valores.get(clave) ?? null },
        setItem(clave, valor) { valores.set(clave, valor) }
    }
}

test("crea un plan independiente con nombre o plantilla", () => {
    const libre = crearPlan({ nombre: " Lectura ", inicio, fin }, () => "plan-1")
    assert.equal(libre.ok, true)
    assert.deepEqual(libre.plan, {
        id: "plan-1",
        nombre: "Lectura",
        eventoId: null,
        colorEvento: "#0F766E",
        inicio,
        fin
    })

    const vinculado = crearPlan({
        nombre: "",
        evento: { id: "evento-1", nombre: "Cerámica", color: "#123456" },
        inicio,
        fin
    }, () => "plan-2")
    assert.equal(vinculado.ok, true)
    assert.equal(vinculado.plan.eventoId, "evento-1")
    assert.equal(vinculado.plan.nombre, "Cerámica")
})

test("rechaza planes sin nombre y fechas iguales o invertidas", () => {
    assert.match(validarPlan({ nombre: "", eventoId: null, colorEvento: "#112233", inicio, fin }), /nombre/)
    assert.match(validarPlan({ nombre: "A", eventoId: null, colorEvento: "#112233", inicio, fin: inicio }), /posterior/)
    assert.match(validarPlan({ nombre: "A", eventoId: null, colorEvento: "#112233", inicio: fin, fin: inicio }), /posterior/)
})

test("permite intervalos planificados superpuestos y cruces explícitos de día", () => {
    const primero = crearPlan({ nombre: "Uno", inicio, fin }, () => "plan-1").plan
    const segundo = crearPlan({
        nombre: "Dos",
        inicio: new Date("2026-10-13T12:30:00.000Z"),
        fin: new Date("2026-10-14T00:30:00.000Z")
    }, () => "plan-2").plan
    assert.equal(validarPlan(primero), null)
    assert.equal(validarPlan(segundo), null)
})

test("actualiza y elimina solo el plan indicado", () => {
    const plan = crearPlan({ nombre: "Uno", inicio, fin }, () => "plan-1").plan
    const actualizado = actualizarPlan([plan], plan.id, {
        nombre: "Dos",
        evento: null,
        inicio,
        fin: new Date(fin.getTime() + 60_000)
    })
    assert.equal(actualizado.ok, true)
    assert.equal(actualizado.planes[0].nombre, "Dos")
    assert.equal(eliminarPlan(actualizado.planes, plan.id).planes.length, 0)
})

test("persiste y recupera fechas como instantes sin alterar otras claves", () => {
    const almacenamiento = crearAlmacenamiento()
    const plan = crearPlan({ nombre: "Lectura", inicio, fin }, () => "plan-1").plan
    almacenamiento.setItem("focus.registros.v1", "[registros intactos]")
    assert.deepEqual(guardarPlanes([plan], almacenamiento), { ok: true })
    assert.equal(almacenamiento.getItem("focus.registros.v1"), "[registros intactos]")
    assert.deepEqual(cargarPlanes(almacenamiento), { ok: true, planes: [plan] })
    assert.ok(almacenamiento.valores.has(CLAVE_PLANES))
})

test("rechaza datos de planes corruptos sin sobrescribirlos", () => {
    const contenido = "{incompleto"
    const almacenamiento = crearAlmacenamiento()
    almacenamiento.setItem(CLAVE_PLANES, contenido)
    const resultado = cargarPlanes(almacenamiento)
    assert.equal(resultado.ok, false)
    assert.match(resultado.error, /JSON válido/)
    assert.equal(almacenamiento.getItem(CLAVE_PLANES), contenido)
})

test("comunica errores de escritura", () => {
    const plan = crearPlan({ nombre: "Lectura", inicio, fin }, () => "plan-1").plan
    const almacenamiento = { setItem() { throw new Error("Cuota excedida") } }
    const resultado = guardarPlanes([plan], almacenamiento)
    assert.equal(resultado.ok, false)
    assert.match(resultado.error, /No se pudieron guardar/)
})

test("elimina solo los planes de una aplicación de plantilla", () => {
    const uno = { ...crearPlan({ nombre: "Uno", inicio, fin }, () => "plan-1").plan, idAplicacionPlantilla: "app-1" }
    const dos = { ...crearPlan({ nombre: "Dos", inicio, fin }, () => "plan-2").plan, idAplicacionPlantilla: "app-1" }
    const otraAplicacion = { ...crearPlan({ nombre: "Tres", inicio, fin }, () => "plan-3").plan, idAplicacionPlantilla: "app-2" }
    const resultado = eliminarAplicacionPlan([uno, dos, otraAplicacion], "app-1")
    assert.equal(resultado.ok, true)
    assert.equal(resultado.cantidadEliminada, 2)
    assert.deepEqual(resultado.planes, [otraAplicacion])
})

test("eliminar una aplicación inexistente devuelve un error sin cambiar los planes", () => {
    const plan = { ...crearPlan({ nombre: "Uno", inicio, fin }, () => "plan-1").plan, idAplicacionPlantilla: "app-1" }
    const planes = [plan]
    const resultado = eliminarAplicacionPlan(planes, "app-inexistente")
    assert.equal(resultado.ok, false)
    assert.deepEqual(planes, [plan])
})
