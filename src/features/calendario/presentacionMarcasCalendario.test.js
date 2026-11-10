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

test("agrupa marcas compactas por bandas de colisión limitadas y conserva las aisladas", () => {
    const elementos = [
        { id: "registro-a", x: 30, y: 3, alto: 2 },
        { id: "plan-a", x: 650, y: 26, alto: 1 },
        { id: "registro-b", x: 150, y: 30, alto: 2 },
        { id: "registro-c", x: 110, y: 58, alto: 2 },
        { id: "bloque-legible", x: 32, y: 4, alto: 20 }
    ]

    const resultado = agruparMarcadoresCercanos(elementos, ALTO_MINIMO_MARCADOR, 84)

    assert.equal(resultado.grupos.length, 3)
    assert.deepEqual(resultado.grupos[0].elementos.map(item => item.id), ["registro-a", "plan-a"])
    assert.equal(resultado.grupos[0].yIndicador, 14)
    assert.deepEqual(resultado.grupos.map(grupo => grupo.elementos.map(item => item.id)), [
        ["registro-a", "plan-a"],
        ["registro-b"],
        ["registro-c"]
    ])
    assert.deepEqual([...resultado.idsAgrupados], ["registro-a", "plan-a", "registro-b", "registro-c"])
    assert.deepEqual(resultado.compactos.map(item => item.id), ["registro-a", "plan-a", "registro-b", "registro-c"])
})

