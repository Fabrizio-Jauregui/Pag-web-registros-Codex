import assert from "node:assert/strict"
import test from "node:test"

import { formatearDuracionEntrada, parsearDuracionEntrada } from "./duracionEntrada.js"

test("interpreta números simples como minutos y admite unidades legibles", () => {
    assert.equal(parsearDuracionEntrada("30"), 30 * 60)
    assert.equal(parsearDuracionEntrada("30 min"), 30 * 60)
    assert.equal(parsearDuracionEntrada("1h 30m"), 90 * 60)
    assert.equal(parsearDuracionEntrada("1 hora 30 minutos"), 90 * 60)
    assert.equal(parsearDuracionEntrada("45s"), 45)
})

test("conserva la compatibilidad con duraciones HH:MM y HH:MM:SS", () => {
    assert.equal(parsearDuracionEntrada("90:00"), 90 * 60)
    assert.equal(parsearDuracionEntrada("00:30:00"), 30 * 60)
    assert.equal(parsearDuracionEntrada("1:02:03"), 3723)
})

test("rechaza formatos, rangos y signos no admitidos", () => {
    assert.equal(parsearDuracionEntrada("ASD"), null)
    assert.equal(parsearDuracionEntrada("1x"), null)
    assert.equal(parsearDuracionEntrada("1:90:00"), null)
    assert.equal(parsearDuracionEntrada("25h"), null)
    assert.equal(parsearDuracionEntrada("-5m"), null)
    assert.equal(parsearDuracionEntrada("-5m", { permitirNegativa: true }), -300)
})

test("formatea duraciones breves sin forzar el formato de reloj", () => {
    assert.equal(formatearDuracionEntrada(1800), "30 min")
    assert.equal(formatearDuracionEntrada(5400), "1 h 30 min")
    assert.equal(formatearDuracionEntrada(45), "45 s")
    assert.equal(formatearDuracionEntrada(-300), "−5 min")
})
