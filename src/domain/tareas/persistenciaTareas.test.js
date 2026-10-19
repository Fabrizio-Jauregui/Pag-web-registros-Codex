import assert from "node:assert/strict"
import test from "node:test"
import { cargarTareas, CLAVE_TAREAS, guardarTareas } from "./persistenciaTareas.js"

function crearAlmacen(datos = {}) {
    return { getItem(clave) { return Object.hasOwn(datos, clave) ? datos[clave] : null }, setItem(clave, valor) { datos[clave] = valor } }
}

const tarea = { id: "tarea-1", nombre: "Leer", estado: "Pendiente", creadaEn: "2026-10-18T12:00:00.000Z", actualizadaEn: "2026-10-18T12:00:00.000Z" }

test("carga una lista vacía y guarda y recupera tareas", () => {
    const almacen = crearAlmacen()
    assert.deepEqual(cargarTareas(almacen), { ok: true, tareas: [] })
    assert.deepEqual(guardarTareas([tarea], almacen), { ok: true })
    assert.deepEqual(cargarTareas(almacen), { ok: true, tareas: [{ ...tarea, destino: "backlog", ordenFocus: null }] })
    assert.equal(CLAVE_TAREAS, "focus.tareas.v1")
})

test("migra tareas existentes a Backlog sin escribir sobre el almacenamiento al cargarlas", () => {
    const almacen = crearAlmacen({ [CLAVE_TAREAS]: JSON.stringify([tarea]) })
    assert.deepEqual(cargarTareas(almacen), { ok: true, tareas: [{ ...tarea, destino: "backlog", ordenFocus: null }] })
    assert.equal(JSON.parse(almacen.getItem(CLAVE_TAREAS))[0].destino, undefined)
})

test("migra una tarea En curso que quedó en Backlog a Pendiente", () => {
    const almacen = crearAlmacen({ [CLAVE_TAREAS]: JSON.stringify([{ ...tarea, estado: "En curso" }]) })
    assert.equal(cargarTareas(almacen).tareas[0].estado, "Pendiente")
})

test("rechaza JSON corrupto, tareas inválidas e IDs duplicados", () => {
    assert.equal(cargarTareas(crearAlmacen({ [CLAVE_TAREAS]: "{" })).ok, false)
    assert.equal(cargarTareas(crearAlmacen({ [CLAVE_TAREAS]: JSON.stringify([{ ...tarea, estado: "Raro" }]) })).ok, false)
    assert.equal(guardarTareas([tarea, tarea], crearAlmacen()).ok, false)
})

test("maneja fallos de lectura y escritura", () => {
    assert.match(cargarTareas({ getItem() { throw new Error("denegado") } }).error, /No se pudieron leer/)
    assert.match(guardarTareas([tarea], { setItem() { throw new Error("sin espacio") } }).error, /No se pudieron guardar/)
})
