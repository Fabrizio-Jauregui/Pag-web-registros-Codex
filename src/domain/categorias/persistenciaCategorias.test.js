import assert from "node:assert/strict"
import test from "node:test"

import { cargarCategorias, CLAVE_CATEGORIAS, guardarCategorias } from "./persistenciaCategorias.js"

function crearAlmacenamiento(valor = null) {
    const valores = new Map()
    if (valor !== null) valores.set(CLAVE_CATEGORIAS, valor)
    return { valores, getItem(clave) { return valores.get(clave) ?? null }, setItem(clave, contenido) { valores.set(clave, contenido) } }
}

test("carga vacío, guarda y vuelve a cargar categorías", () => {
    const almacen = crearAlmacenamiento()
    assert.deepEqual(cargarCategorias(almacen), { ok: true, categorias: [] })
    assert.deepEqual(guardarCategorias([{ id: "c1", nombre: "Casa" }], almacen), { ok: true })
    assert.deepEqual(cargarCategorias(almacen), { ok: true, categorias: [{ id: "c1", nombre: "Casa" }] })
})

test("rechaza JSON o colecciones inválidas sin reemplazar los datos", () => {
    const corrupto = crearAlmacenamiento("{bad")
    assert.equal(cargarCategorias(corrupto).ok, false)
    assert.equal(guardarCategorias([{ id: "c", nombre: " " }], corrupto).ok, false)
    assert.equal(corrupto.valores.get(CLAVE_CATEGORIAS), "{bad")
})
