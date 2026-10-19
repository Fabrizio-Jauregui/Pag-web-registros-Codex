import assert from "node:assert/strict"
import test from "node:test"
import { actualizarTarea, cambiarDestinoTarea, crearTarea, eliminarTarea, ESTADOS_TAREA, moverTareaEnCola, posponerTareaEnCola, sincronizarEstadoTareasFocus, validarTarea } from "./tareas.js"

const fecha = () => new Date("2026-10-18T12:00:00.000Z")

test("crea una tarea normalizada con estado e identidad", () => {
    const resultado = crearTarea(" Leer ", "Pendiente", () => "tarea-1", fecha)
    assert.deepEqual(resultado, { ok: true, tarea: { id: "tarea-1", nombre: "Leer", estado: "Pendiente", destino: "backlog", ordenFocus: null, creadaEn: "2026-10-18T12:00:00.000Z", actualizadaEn: "2026-10-18T12:00:00.000Z" } })
})

test("valida nombre y estados permitidos", () => {
    assert.match(validarTarea(" ", "Pendiente"), /obligatorio/)
    assert.match(validarTarea("x".repeat(121), "Pendiente"), /120 caracteres/)
    assert.match(validarTarea("Tarea", "Iniciada"), /estado válido/)
    assert.deepEqual(ESTADOS_TAREA, ["Boceto", "Pendiente", "En curso", "Completada", "Cancelada"])
})

test("impide asignar En curso manualmente y conserva los datos ante el rechazo", () => {
    const original = crearTarea("Leer", "Pendiente", () => "tarea-1", fecha).tarea
    const resultado = actualizarTarea([original], original.id, { nombre: "Leer capítulo", estado: "En curso" }, () => new Date("2026-10-18T13:00:00.000Z"))
    assert.equal(resultado.ok, false)
    assert.equal(crearTarea("Leer", "En curso", () => "otra", fecha).ok, false)
    assert.equal(original.nombre, "Leer")
    assert.equal(actualizarTarea([original], "faltante", { nombre: "x" }).ok, false)
})

test("la sesión Focus asigna En curso solo a la tarea activa y devuelve las anteriores a Pendiente", () => {
    const originales = [
        crearTarea("A", "Pendiente", () => "a", fecha, "focus", 1).tarea,
        crearTarea("B", "Pendiente", () => "b", fecha, "focus", 2).tarea,
        { ...crearTarea("C", "Pendiente", () => "c", fecha).tarea, estado: "En curso" }
    ]
    const activa = sincronizarEstadoTareasFocus(originales, "a", fecha)
    assert.deepEqual(activa.tareas.map(tarea => tarea.estado), ["En curso", "Pendiente", "Pendiente"])
    const cambio = sincronizarEstadoTareasFocus(activa.tareas, "b", fecha)
    assert.deepEqual(cambio.tareas.map(tarea => tarea.estado), ["Pendiente", "En curso", "Pendiente"])
    const fin = sincronizarEstadoTareasFocus(cambio.tareas, null, fecha)
    assert.deepEqual(fin.tareas.map(tarea => tarea.estado), ["Pendiente", "Pendiente", "Pendiente"])
})

test("elimina solo la tarea solicitada", () => {
    const primera = crearTarea("Una", "Boceto", () => "1", fecha).tarea
    const segunda = crearTarea("Dos", "Cancelada", () => "2", fecha).tarea
    assert.deepEqual(eliminarTarea([primera, segunda], "1").tareas, [segunda])
    assert.equal(eliminarTarea([segunda], "faltante").ok, false)
})

test("mueve tareas entre Backlog y Cola Focus y conserva el orden estable", () => {
    const backlog = crearTarea("A", "Pendiente", () => "a", fecha).tarea
    const segunda = crearTarea("B", "Pendiente", () => "b", fecha, "focus", 1).tarea
    const tercera = crearTarea("C", "Pendiente", () => "c", fecha, "focus", 2).tarea
    const aCola = cambiarDestinoTarea([backlog, segunda, tercera], backlog.id, "focus")
    assert.deepEqual(aCola.tareas.map(tarea => [tarea.id, tarea.ordenFocus]), [["a", 3], ["b", 1], ["c", 2]])
    const ordenadas = moverTareaEnCola(aCola.tareas, "c", -1)
    assert.deepEqual(ordenadas.tareas.filter(tarea => tarea.destino === "focus").sort((a, b) => a.ordenFocus - b.ordenFocus).map(tarea => tarea.id), ["c", "b", "a"])
    assert.equal(moverTareaEnCola(aCola.tareas, "b", 1, "b").ok, false)
})

test("posponer mueve la activa después de la siguiente o al final", () => {
    const tareas = ["a", "b", "c", "d"].map((id, indice) => crearTarea(id, "Pendiente", () => id, fecha, "focus", indice + 1).tarea)
    const despues = posponerTareaEnCola(tareas, "a", "despues-siguiente")
    assert.deepEqual(despues.tareas.sort((a, b) => a.ordenFocus - b.ordenFocus).map(tarea => tarea.id), ["b", "a", "c", "d"])
    const final = posponerTareaEnCola(tareas, "a", "final")
    assert.deepEqual(final.tareas.sort((a, b) => a.ordenFocus - b.ordenFocus).map(tarea => tarea.id), ["b", "c", "d", "a"])
})
