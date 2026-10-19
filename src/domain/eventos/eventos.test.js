import assert from "node:assert/strict"
import test from "node:test"

import {
    actualizarPlantillaEvento,
    crearPlantillaEvento,
    eliminarPlantillaEvento,
    validarPlantillaEvento
} from "./eventos.js"

test("crea una plantilla con nombre normalizado, color e ID estable", () => {
    const resultado = crearPlantillaEvento("  Guitarra  ", "#aabbcc", () => "evento-1")

    assert.deepEqual(resultado, {
        ok: true,
        plantilla: { id: "evento-1", nombre: "Guitarra", color: "#AABBCC" }
    })
})

test("valida nombre obligatorio y color hexadecimal", () => {
    assert.match(validarPlantillaEvento("   ", "#AABBCC"), /obligatorio/)
    assert.match(validarPlantillaEvento("x".repeat(81), "#AABBCC"), /80 caracteres/)
    assert.match(validarPlantillaEvento("Lectura", "red"), /color válido/)
    assert.equal(validarPlantillaEvento("Lectura", "#AABBCC"), null)
})

test("permite nombres repetidos porque las plantillas se distinguen por ID", () => {
    const primera = crearPlantillaEvento("Lectura", "#112233", () => "id-1")
    const segunda = crearPlantillaEvento("Lectura", "#445566", () => "id-2")

    assert.equal(primera.ok, true)
    assert.equal(segunda.ok, true)
    assert.notEqual(primera.plantilla.id, segunda.plantilla.id)
})

test("crea y actualiza eventos con una categoría opcional sin alterar su identidad", () => {
    const creado = crearPlantillaEvento("Trabajo", "#123456", "categoria-1", () => "evento-1")
    assert.equal(creado.plantilla.categoriaId, "categoria-1")
    const actualizado = actualizarPlantillaEvento([creado.plantilla], "evento-1", "Trabajo", "#123456", null)
    assert.equal(actualizado.plantillas[0].id, "evento-1")
    assert.equal("categoriaId" in actualizado.plantillas[0], false)
})

test("editar conserva el ID y no muta la plantilla original", () => {
    const original = { id: "id-1", nombre: "Lectura", color: "#112233" }
    const resultado = actualizarPlantillaEvento(
        [original],
        "id-1",
        "  Lectura técnica ",
        "#abcdef"
    )

    assert.equal(resultado.ok, true)
    assert.deepEqual(resultado.plantillas[0], {
        id: "id-1",
        nombre: "Lectura técnica",
        color: "#ABCDEF"
    })
    assert.deepEqual(original, { id: "id-1", nombre: "Lectura", color: "#112233" })
})

test("rechaza editar con nombre o color inválidos y con un ID inexistente", () => {
    const plantillas = [{ id: "id-1", nombre: "Lectura", color: "#112233" }]

    assert.equal(actualizarPlantillaEvento(plantillas, "id-1", " ", "#112233").ok, false)
    assert.equal(actualizarPlantillaEvento(plantillas, "id-1", "Otro", "invalid").ok, false)
    assert.equal(actualizarPlantillaEvento(plantillas, "faltante", "Otro", "#112233").ok, false)
})

test("eliminar quita solo la plantilla solicitada y conserva la lista original", () => {
    const plantillas = [
        { id: "id-1", nombre: "Lectura", color: "#112233" },
        { id: "id-2", nombre: "Lectura", color: "#445566" }
    ]
    const resultado = eliminarPlantillaEvento(plantillas, "id-1")

    assert.equal(resultado.ok, true)
    assert.deepEqual(resultado.plantillas, [plantillas[1]])
    assert.equal(plantillas.length, 2)
    assert.equal(eliminarPlantillaEvento(plantillas, "faltante").ok, false)
})
