import assert from "node:assert/strict"
import test from "node:test"
import { ejecutarTransaccionAlmacenamiento } from "./transaccionAlmacenamiento.js"

function crearAlmacen(valoresIniciales = new Map()) {
    return {
        valores: valoresIniciales,
        getItem: clave => valoresIniciales.get(clave) ?? null,
        setItem: (clave, valor) => valoresIniciales.set(clave, valor),
        removeItem: clave => valoresIniciales.delete(clave)
    }
}

test("guarda todos los valores de la transacción cuando cada escritura funciona", () => {
    const almacen = crearAlmacen(new Map([["plantilla", "vieja"], ["planes", "anteriores"]]))
    const resultado = ejecutarTransaccionAlmacenamiento(["plantilla", "planes"], storage => {
        storage.setItem("plantilla", "nueva")
        storage.setItem("planes", "actualizados")
        return { ok: true }
    }, almacen)
    assert.deepEqual(resultado, { ok: true })
    assert.equal(almacen.getItem("plantilla"), "nueva")
    assert.equal(almacen.getItem("planes"), "actualizados")
})

test("restaura las claves anteriores si falla una escritura intermedia", () => {
    const valores = new Map([["plantilla", "vieja"], ["planes", "anteriores"], ["recurrencias", "serie"]])
    let fallar = true
    const almacen = {
        valores,
        getItem: clave => valores.get(clave) ?? null,
        setItem(clave, valor) {
            if (clave === "recurrencias" && fallar) { fallar = false; throw new Error("Cuota excedida") }
            valores.set(clave, valor)
        },
        removeItem: clave => valores.delete(clave)
    }
    const resultado = ejecutarTransaccionAlmacenamiento(["plantilla", "planes", "recurrencias"], storage => {
        storage.setItem("plantilla", "nueva")
        storage.setItem("planes", "actualizados")
        storage.setItem("recurrencias", "eliminadas")
        return { ok: true }
    }, almacen)
    assert.equal(resultado.ok, false)
    assert.equal(valores.get("plantilla"), "vieja")
    assert.equal(valores.get("planes"), "anteriores")
    assert.equal(valores.get("recurrencias"), "serie")
})

test("restaura la ausencia de claves que todavía no existían", () => {
    const almacen = crearAlmacen(new Map([["plantilla", "vieja"]]))
    const resultado = ejecutarTransaccionAlmacenamiento(["plantilla", "planes"], storage => {
        storage.setItem("plantilla", "nueva")
        storage.setItem("planes", "nuevos")
        return { ok: false, error: "No se pudo sincronizar la secuencia." }
    }, almacen)
    assert.equal(resultado.ok, false)
    assert.equal(almacen.getItem("plantilla"), "vieja")
    assert.equal(almacen.getItem("planes"), null)
})
