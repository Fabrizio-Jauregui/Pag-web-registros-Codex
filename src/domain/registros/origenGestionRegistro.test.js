import assert from "node:assert/strict"
import test from "node:test"

import {
    obtenerOrigenGestionRegistro,
    ORIGEN_GESTION_FOCUS,
    ORIGEN_GESTION_INDEPENDIENTE,
    ORIGEN_GESTION_PLANIFICACION
} from "./origenGestionRegistro.js"

test("prioriza Focus cuando un registro tiene ambos vínculos", () => {
    assert.equal(obtenerOrigenGestionRegistro({ origenFocus: true, planId: "plan-1" }), ORIGEN_GESTION_FOCUS)
})

test("reconoce registros vinculados a un plan", () => {
    assert.equal(obtenerOrigenGestionRegistro({ planId: "plan-1" }), ORIGEN_GESTION_PLANIFICACION)
    assert.equal(obtenerOrigenGestionRegistro({ planId: "  " }), ORIGEN_GESTION_INDEPENDIENTE)
})

test("mantiene como independientes los registros sin vínculo de gestión", () => {
    assert.equal(obtenerOrigenGestionRegistro({}), ORIGEN_GESTION_INDEPENDIENTE)
    assert.equal(obtenerOrigenGestionRegistro(null), ORIGEN_GESTION_INDEPENDIENTE)
})
