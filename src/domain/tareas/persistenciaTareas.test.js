import assert from "node:assert/strict"
import test from "node:test"
import { cargarTareas, CLAVE_TAREAS, guardarTareas } from "./persistenciaTareas.js"

function crearAlmacen(datos = {}) {
    return { getItem(clave) { return Object.hasOwn(datos, clave) ? datos[clave] : null }, setItem(clave, valor) { datos[clave] = valor } }
}

const tarea = { id: "tarea-1", nombre: "Leer", estado: "Pendiente", creadaEn: "2026-10-18T12:00:00.000Z", actualizadaEn: "2026-10-18T12:00:00.000Z" }
const normalizada = { ...tarea, tipo: "tarea", objetivoId: null, padreId: null, ordenArbol: 1, destino: "backlog", ordenFocus: null }

test("carga una lista vacía y guarda y recupera tareas", () => {
    const almacen = crearAlmacen()
    assert.deepEqual(cargarTareas(almacen), { ok: true, tareas: [] })
    assert.deepEqual(guardarTareas([tarea], almacen), { ok: true })
    assert.deepEqual(cargarTareas(almacen), { ok: true, tareas: [normalizada] })
    assert.equal(CLAVE_TAREAS, "focus.tareas.v1")
})

test("migra tareas existentes a Backlog sin escribir sobre el almacenamiento al cargarlas", () => {
    const almacen = crearAlmacen({ [CLAVE_TAREAS]: JSON.stringify([tarea]) })
    assert.deepEqual(cargarTareas(almacen), { ok: true, tareas: [normalizada] })
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

test("conserva objetivos y valida padres existentes y árboles sin ciclos", () => {
    const almacen = crearAlmacen()
    const objetivo = { id: "objetivo", tipo: "objetivo", nombre: "Proyecto", estado: "Activo", creadaEn: tarea.creadaEn, actualizadaEn: tarea.actualizadaEn }
    const raiz = { ...normalizada, id: "raiz", objetivoId: objetivo.id, padreId: objetivo.id }
    const hija = { ...normalizada, id: "hija", objetivoId: objetivo.id, padreId: "raiz" }
    assert.equal(guardarTareas([objetivo, raiz, hija], almacen).ok, true)
    assert.equal(cargarTareas(almacen).ok, true)
    assert.deepEqual(cargarTareas(almacen).tareas[0], objetivo)
    assert.equal(guardarTareas([objetivo, { ...raiz, padreId: "hija" }, hija], crearAlmacen()).ok, false)
    assert.equal(guardarTareas([objetivo, { ...raiz, padreId: "ausente" }], crearAlmacen()).ok, false)
})
