import test from "node:test"
import assert from "node:assert/strict"

import {
    ALTO_COMPACTO_MARCAS,
    ALTO_MINIMO_MARCADOR,
    agruparMarcadoresCercanos,
    obtenerDuracionVisualPx
} from "./presentacionMarcasCalendario.js"

test("calcula altura temporal sin alterar la duración real", () => {
    const inicio = new Date("2026-11-08T10:00:00")
    const finBreve = new Date(inicio.getTime() + 10_000)
    const finMediaHora = new Date(inicio.getTime() + 30 * 60_000)

    assert.equal(obtenerDuracionVisualPx(inicio, finBreve, 64 / 3600), 64 / 360)
    assert.equal(obtenerDuracionVisualPx(inicio, finMediaHora, 64 / 3600), 32)
    assert.ok(ALTO_COMPACTO_MARCAS < ALTO_MINIMO_MARCADOR)
})

test("agrupa bloques visibles próximos aunque no sean compactos", () => {
    const elementos = [
        { id: "registro-a", izquierda: 30, derecha: 90, arriba: 100, abajo: 150, alto: 50 },
        { id: "plan-a", izquierda: 94, derecha: 150, arriba: 120, abajo: 170, alto: 50 },
        { id: "registro-b", izquierda: 250, derecha: 320, arriba: 100, abajo: 150, alto: 50 },
        { id: "registro-breve", izquierda: 30, derecha: 38, arriba: 151, abajo: 179, alto: 2 }
    ]

    const resultado = agruparMarcadoresCercanos(elementos)

    assert.equal(resultado.grupos.length, 1)
    assert.deepEqual(resultado.grupos[0].map(item => item.id), ["registro-a", "plan-a", "registro-breve"])
    assert.deepEqual([...resultado.idsAgrupados], ["registro-a", "plan-a", "registro-breve"])
    assert.deepEqual(resultado.compactos.map(item => item.id), ["registro-breve"])
})

test("agrupa transitivamente y deja separados los bloques que exceden la distancia", () => {
    const elementos = [
        { id: "a", izquierda: 0, derecha: 20, arriba: 0, abajo: 20, alto: 20 },
        { id: "b", izquierda: 45, derecha: 65, arriba: 15, abajo: 35, alto: 20 },
        { id: "c", izquierda: 90, derecha: 110, arriba: 30, abajo: 50, alto: 20 },
        { id: "d", izquierda: 138, derecha: 160, arriba: 30, abajo: 50, alto: 20 }
    ]

    const resultado = agruparMarcadoresCercanos(elementos)

    assert.deepEqual(resultado.grupos.map(grupo => grupo.map(item => item.id)), [["a", "b", "c"]])
    assert.deepEqual([...resultado.idsAgrupados], ["a", "b", "c"])
})

