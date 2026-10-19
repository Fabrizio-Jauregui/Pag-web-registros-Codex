import assert from "node:assert/strict"
import test from "node:test"

import { actualizarCategoria, crearCategoria, eliminarCategoria, validarCategoria } from "./categorias.js"

test("crea, valida, actualiza y elimina categorías con identidad estable", () => {
    const creada = crearCategoria("  Movimiento ", () => "cat-1")
    assert.deepEqual(creada, { ok: true, categoria: { id: "cat-1", nombre: "Movimiento" } })
    assert.equal(validarCategoria(" "), "El nombre de la categoría es obligatorio.")
    assert.match(validarCategoria("x".repeat(61)), /60 caracteres/)
    const editada = actualizarCategoria([creada.categoria], "cat-1", "Actividad física")
    assert.deepEqual(editada.categorias, [{ id: "cat-1", nombre: "Actividad física" }])
    assert.deepEqual(eliminarCategoria(editada.categorias, "cat-1").categorias, [])
})
