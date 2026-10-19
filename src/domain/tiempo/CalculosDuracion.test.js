import assert from "node:assert/strict"
import test from "node:test"

import {
    DURACION_MAXIMA_MS,
    calcularLimiteRegistro,
    calcularTiempoEfectivo,
    calcularTiempoPausado,
    calcularTiempoRegistradoEnPeriodo,
    calcularTiempoTotalDelDia,
    calcularTiempoTranscurrido,
    cerrarSegmentoAbierto,
    puedeFinalizarRegistro,
    seAlcanzoLimiteRegistro
} from "./CalculosDuracion.js"

const instante = milisegundos => new Date(milisegundos)

test("calcula el tiempo total del día uniendo actividades superpuestas", () => {
    const fecha = new Date(2026, 9, 13)
    const registros = [
        { segmentos: [{ tipo: "En curso", inicio: new Date(2026, 9, 13, 12), fin: new Date(2026, 9, 13, 13) }] },
        { segmentos: [{ tipo: "En curso", inicio: new Date(2026, 9, 13, 12, 30), fin: new Date(2026, 9, 13, 13, 30) }] },
        { segmentos: [{ tipo: "Pausado", inicio: new Date(2026, 9, 13, 13, 30), fin: new Date(2026, 9, 13, 14) }] }
    ]

    assert.equal(calcularTiempoTotalDelDia(registros, fecha, new Date(2026, 9, 14)), 5400)
})

test("limita el tiempo total a la fecha seleccionada y a la hora actual", () => {
    const fecha = new Date(2026, 9, 13)
    const registros = [{ segmentos: [{
        tipo: "En curso",
        inicio: new Date(2026, 9, 13, 23, 30),
        fin: new Date(2026, 9, 14, 0, 30)
    }] }]

    assert.equal(calcularTiempoTotalDelDia(registros, fecha, new Date(2026, 9, 14, 0, 5)), 1800)
})

test("calcula el tiempo del período recortando sus límites y uniendo solapamientos", () => {
    const inicio = new Date(2026, 9, 13, 12)
    const fin = new Date(2026, 9, 13, 14)
    const ahora = new Date(2026, 9, 13, 13, 30)
    const registros = [
        { segmentos: [{ tipo: "En curso", inicio: new Date(2026, 9, 13, 11), fin: new Date(2026, 9, 13, 13) }] },
        { segmentos: [{ tipo: "En curso", inicio: new Date(2026, 9, 13, 12, 30), fin: new Date(2026, 9, 13, 14, 30) }] },
        { segmentos: [{ tipo: "Pausado", inicio: inicio, fin }] }
    ]

    assert.equal(calcularTiempoRegistradoEnPeriodo(registros, inicio, fin, ahora), 5400)
})

test("rechaza límites inválidos y un período vacío", () => {
    const fecha = new Date(2026, 9, 13)
    const registros = [{ segmentos: [{ tipo: "En curso", inicio: fecha, fin: new Date(fecha.getTime() + 1000) }] }]

    assert.equal(calcularTiempoRegistradoEnPeriodo(registros, fecha, fecha, new Date()), 0)
    assert.equal(calcularTiempoRegistradoEnPeriodo(registros, new Date(Number.NaN), fecha, new Date()), 0)
})

test("no permite finalizar antes de un segundo efectivo", () => {
    const segmentos = [{ tipo: "En curso", inicio: instante(0), fin: null }]

    assert.equal(puedeFinalizarRegistro(segmentos, instante(999)), false)
    assert.equal(puedeFinalizarRegistro(segmentos, instante(1000)), true)
})

test("calcula tiempo efectivo, pausado y transcurrido por separado", () => {
    const segmentos = [
        { tipo: "En curso", inicio: instante(0), fin: instante(1000) },
        { tipo: "Pausado", inicio: instante(1000), fin: instante(11000) },
        { tipo: "En curso", inicio: instante(11000), fin: null }
    ]
    const ahora = instante(12000)

    assert.equal(calcularTiempoEfectivo(segmentos, ahora), 2)
    assert.equal(calcularTiempoPausado(segmentos, ahora), 10)
    assert.equal(calcularTiempoTranscurrido(segmentos, ahora), 12)
})

test("calcula el límite máximo desde el inicio, incluyendo pausas", () => {
    const inicio = instante(5000)
    const limite = calcularLimiteRegistro(inicio)

    assert.equal(limite.getTime(), inicio.getTime() + DURACION_MAXIMA_MS)
    assert.equal(seAlcanzoLimiteRegistro(inicio, instante(limite.getTime() - 1)), false)
    assert.equal(seAlcanzoLimiteRegistro(inicio, limite), true)
})

test("cierra un único segmento abierto con un intervalo válido", () => {
    const segmentos = [{ tipo: "En curso", inicio: instante(1000), fin: null }]
    const cerrados = cerrarSegmentoAbierto(segmentos, instante(2000))

    assert.equal(cerrados[0].fin.getTime(), 2000)
    assert.equal(segmentos[0].fin, null)
})

test("rechaza segmentos abiertos múltiples y cierres anteriores al inicio", () => {
    const abierto = { tipo: "En curso", inicio: instante(1000), fin: null }

    assert.equal(
        cerrarSegmentoAbierto([abierto, abierto], instante(2000)),
        null
    )
    assert.equal(cerrarSegmentoAbierto([abierto], instante(999)), null)
})

test("rechaza segmentos que se solapan o no están en orden temporal", () => {
    const segmentos = [
        { tipo: "En curso", inicio: instante(0), fin: instante(2000) },
        { tipo: "Pausado", inicio: instante(1000), fin: null }
    ]

    assert.equal(cerrarSegmentoAbierto(segmentos, instante(3000)), null)
})
