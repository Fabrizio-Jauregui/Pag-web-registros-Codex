import assert from "node:assert/strict"
import test from "node:test"

import {
    formatearInstante,
    obtenerResumenRegistro,
    ordenarRegistrosPorInicio
} from "./historial.js"

function crearRegistro(id, inicio, segmentos = []) {
    return { id, segmentos: [{ inicio: new Date(inicio), ...segmentos[0] }] }
}

test("ordena los registros del más reciente al más antiguo sin mutar la lista", () => {
    const antiguos = crearRegistro("antiguo", "2026-01-01T10:00:00.000Z")
    const recientes = crearRegistro("reciente", "2026-01-02T10:00:00.000Z")
    const registros = [antiguos, recientes]

    assert.deepEqual(ordenarRegistrosPorInicio(registros), [recientes, antiguos])
    assert.deepEqual(registros, [antiguos, recientes])
})

test("calcula tiempo efectivo, pausado y transcurrido desde los segmentos", () => {
    const registro = {
        segmentos: [
            { tipo: "En curso", inicio: new Date("2026-01-01T10:00:00.000Z"), fin: new Date("2026-01-01T10:00:12.000Z") },
            { tipo: "Pausado", inicio: new Date("2026-01-01T10:00:12.000Z"), fin: new Date("2026-01-01T10:00:17.000Z") },
            { tipo: "En curso", inicio: new Date("2026-01-01T10:00:17.000Z"), fin: new Date("2026-01-01T10:00:25.000Z") }
        ]
    }

    assert.deepEqual(obtenerResumenRegistro(registro), {
        efectivo: 20,
        pausado: 5,
        transcurrido: 25
    })
})

test("formatea fechas y horas con opciones explícitas", () => {
    const fecha = new Date("2026-10-12T15:04:00.000Z")

    assert.match(formatearInstante(fecha, { timeZone: "UTC", dateStyle: "short" }), /12\/10\/26/)
    assert.match(formatearInstante(fecha, {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }), /15:04/)
})
