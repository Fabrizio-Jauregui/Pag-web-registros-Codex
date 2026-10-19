import assert from "node:assert/strict"
import test from "node:test"

import { obtenerFragmentosPlanesCalendario } from "./segmentosCalendario.js"

test("representa un plan que cruza medianoche en ambos días", () => {
    const plan = {
        id: "plan-1",
        inicio: new Date(2026, 9, 13, 23, 30),
        fin: new Date(2026, 9, 14, 0, 30)
    }
    const primerDia = obtenerFragmentosPlanesCalendario([plan], new Date(2026, 9, 13))
    const segundoDia = obtenerFragmentosPlanesCalendario([plan], new Date(2026, 9, 14))
    const otroDia = obtenerFragmentosPlanesCalendario([plan], new Date(2026, 9, 15))

    assert.equal(primerDia.length, 1)
    assert.equal(primerDia[0].minutosInicio, 23 * 60 + 30)
    assert.equal(primerDia[0].minutosFin, 1440)
    assert.equal(segundoDia.length, 1)
    assert.equal(segundoDia[0].minutosInicio, 0)
    assert.equal(segundoDia[0].minutosFin, 30)
    assert.deepEqual(otroDia, [])
})
