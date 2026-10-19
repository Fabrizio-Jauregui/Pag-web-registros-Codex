import assert from "node:assert/strict"
import test from "node:test"

import {
    desplazarDia,
    formatearFechaISO,
    leerFechaISO,
    obtenerDiasSemana,
    obtenerInicioSemana,
    obtenerFechaLocalHoy
} from "./FechaCalendario.js"
import {
    obtenerFragmentosCalendario,
    leerValorFechaHoraLocal,
    obtenerValorFechaHoraLocal
} from "../../features/calendario/segmentosCalendario.js"
import {
    ALTURA_HORA_BASE,
    ALTURAS_ZOOM_CALENDARIO,
    moverNivelZoom,
    obtenerPorcentajeZoom
} from "../../features/calendario/zoomCalendario.js"

test("normaliza hoy usando la fecha local", () => {
    const ahora = new Date(2026, 9, 12, 23, 45)
    const hoy = obtenerFechaLocalHoy(ahora)

    assert.equal(hoy.getFullYear(), 2026)
    assert.equal(hoy.getMonth(), 9)
    assert.equal(hoy.getDate(), 12)
    assert.equal(hoy.getHours(), 0)
})

test("navega correctamente entre meses, años y años bisiestos", () => {
    const finDeMes = new Date(2024, 1, 29)
    const diaSiguiente = desplazarDia(finDeMes, 1)
    const finDeAnio = new Date(2025, 11, 31)

    assert.equal(formatearFechaISO(diaSiguiente), "2024-03-01")
    assert.equal(formatearFechaISO(desplazarDia(finDeAnio, 1)), "2026-01-01")
})

test("lee fechas ISO válidas y rechaza fechas imposibles", () => {
    assert.equal(formatearFechaISO(leerFechaISO("2024-02-29")), "2024-02-29")
    assert.equal(leerFechaISO("2025-02-29"), null)
    assert.equal(leerFechaISO("2025-13-01"), null)
    assert.equal(leerFechaISO("no-es-fecha"), null)
})

test("devuelve null ante fechas o desplazamientos inválidos", () => {
    assert.equal(desplazarDia(new Date(Number.NaN), 1), null)
    assert.equal(desplazarDia(new Date(2025, 0, 1), 1.5), null)
    assert.equal(formatearFechaISO(new Date(Number.NaN)), "")
})

test("calcula una semana de lunes a domingo", () => {
    const dias = obtenerDiasSemana(new Date(2026, 9, 14))

    assert.equal(formatearFechaISO(dias[0]), "2026-10-12")
    assert.equal(formatearFechaISO(dias[6]), "2026-10-18")
    assert.equal(obtenerInicioSemana(new Date(2026, 9, 18)).getDay(), 1)
})

test("calcula semanas que cruzan el año", () => {
    const dias = obtenerDiasSemana(new Date(2026, 0, 1))

    assert.equal(formatearFechaISO(dias[0]), "2025-12-29")
    assert.equal(formatearFechaISO(dias[6]), "2026-01-04")
})

test("rechaza una fecha inválida al calcular la semana", () => {
    assert.equal(obtenerInicioSemana(new Date(Number.NaN)), null)
    assert.equal(obtenerDiasSemana(new Date(Number.NaN)), null)
})

test("divide segmentos que cruzan medianoche en fragmentos diarios", () => {
    const inicio = new Date(2026, 9, 12, 23, 30)
    const fin = new Date(2026, 9, 13, 0, 30)
    const registro = {
        id: "cruza-dia",
        segmentos: [{ tipo: "En curso", inicio, fin }]
    }

    const fragmentoPrimero = obtenerFragmentosCalendario([registro], inicio, fin)
    const fragmentoSegundo = obtenerFragmentosCalendario([registro], fin, fin)

    assert.equal(fragmentoPrimero.length, 1)
    assert.equal(fragmentoSegundo.length, 1)
    assert.equal(fragmentoPrimero[0].minutosInicio, 1410)
    assert.equal(fragmentoPrimero[0].minutosFin, 1440)
    assert.equal(fragmentoSegundo[0].minutosInicio, 0)
    assert.equal(fragmentoSegundo[0].minutosFin, 30)
    assert.equal(fragmentoPrimero[0].registro.id, fragmentoSegundo[0].registro.id)
})

test("limita segmentos abiertos a 24 horas y conserva la marca de abierto", () => {
    const inicio = new Date(2026, 9, 12, 9, 0)
    const limite = new Date(inicio.getTime() + 86400000)
    const registro = {
        id: "abierto",
        segmentos: [{ tipo: "En curso", inicio, fin: null }]
    }

    const fragmentos = obtenerFragmentosCalendario(
        [registro],
        new Date(2026, 9, 13),
        new Date(limite.getTime() + 5000)
    )

    assert.equal(fragmentos.length, 1)
    assert.equal(fragmentos[0].abierto, true)
    assert.equal(fragmentos[0].fin.getTime(), limite.getTime())
})

test("serializa y valida fechas locales con milisegundos", () => {
    const fecha = new Date(2026, 9, 12, 15, 4, 7, 123)
    const valor = obtenerValorFechaHoraLocal(fecha)
    const leida = leerValorFechaHoraLocal(valor)

    assert.equal(leida.getTime(), fecha.getTime())
    assert.equal(leerValorFechaHoraLocal("2026-02-30T09:00:00.000"), null)
})

test("lee horas locales con precisión de minuto o segundo", () => {
    const inicio = leerValorFechaHoraLocal("2026-10-13T07:00")
    const fin = leerValorFechaHoraLocal("2026-10-13T07:30:45")

    assert.equal(inicio.getTime(), new Date(2026, 9, 13, 7, 0, 0).getTime())
    assert.equal(fin.getTime(), new Date(2026, 9, 13, 7, 30, 45).getTime())
    assert.equal(leerValorFechaHoraLocal("2026-02-30T09:00"), null)
})

test("el zoom avanza por niveles y respeta los límites de cada vista", () => {
    const nivelesDia = ALTURAS_ZOOM_CALENDARIO.dia
    const nivelesSemana = ALTURAS_ZOOM_CALENDARIO.semana

    assert.equal(moverNivelZoom(nivelesDia, ALTURA_HORA_BASE, 1), 80)
    assert.equal(moverNivelZoom(nivelesDia, nivelesDia.at(-1), 1), nivelesDia.at(-1))
    assert.equal(moverNivelZoom(nivelesSemana, nivelesSemana[0], -1), nivelesSemana[0])
    assert.equal(moverNivelZoom(nivelesSemana, ALTURA_HORA_BASE, -1), 56)
})

test("calcula una etiqueta de zoom proporcional a la escala base", () => {
    assert.equal(obtenerPorcentajeZoom(ALTURA_HORA_BASE), 100)
    assert.equal(obtenerPorcentajeZoom(128), 200)
    assert.equal(obtenerPorcentajeZoom(0), null)
})
