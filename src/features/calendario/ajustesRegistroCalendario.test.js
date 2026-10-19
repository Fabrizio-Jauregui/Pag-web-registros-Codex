import assert from "node:assert/strict"
import test from "node:test"

import {
    ajustarExtremoSegmentosRegistro,
    desplazarSegmentosRegistro
} from "./ajustesRegistroCalendario.js"

function crearRegistro() {
    return {
        segmentos: [
            { tipo: "En curso", inicio: new Date(2026, 9, 13, 9, 0, 12), fin: new Date(2026, 9, 13, 9, 10, 12) },
            { tipo: "Pausado", inicio: new Date(2026, 9, 13, 9, 10, 12), fin: new Date(2026, 9, 13, 9, 20, 12) },
            { tipo: "En curso", inicio: new Date(2026, 9, 13, 9, 20, 12), fin: new Date(2026, 9, 13, 9, 30, 12) }
        ]
    }
}

test("desplaza todos los segmentos por igual, mantiene pausas, segundos y el original", () => {
    const registro = crearRegistro()
    const resultado = desplazarSegmentosRegistro(registro, { dias: 1, minutos: 15 })

    assert.equal(resultado[0].inicio.getTime() - registro.segmentos[0].inicio.getTime(), (24 * 60 + 15) * 60 * 1000)
    assert.equal(resultado[1].fin.getTime() - registro.segmentos[1].fin.getTime(), (24 * 60 + 15) * 60 * 1000)
    assert.equal(resultado[0].inicio.getSeconds(), 12)
    assert.equal(resultado[0].inicio.getMilliseconds(), 0)
    assert.equal(resultado[0].fin.getTime(), resultado[1].inicio.getTime())
    assert.equal(registro.segmentos[0].inicio.getHours(), 9)
})

test("ajusta el inicio o el final sin alterar los otros límites", () => {
    const registro = crearRegistro()
    const inicio = ajustarExtremoSegmentosRegistro(registro, {
        extremo: "inicio", minutos: 5
    })
    const fin = ajustarExtremoSegmentosRegistro(registro, {
        extremo: "fin", dias: 1, minutos: 5
    })

    assert.equal(inicio[0].inicio.getMinutes(), 5)
    assert.equal(inicio[0].inicio.getSeconds(), 12)
    assert.equal(inicio[0].fin.getTime(), registro.segmentos[0].fin.getTime())
    assert.equal(fin.at(-1).fin.getDate(), registro.segmentos.at(-1).fin.getDate() + 1)
    assert.equal(fin.at(-1).fin.getMinutes(), 35)
    assert.equal(fin.at(-1).fin.getSeconds(), 12)
    assert.equal(fin[0].inicio.getTime(), registro.segmentos[0].inicio.getTime())
})

test("desplaza o ajusta un extremo con precisión de segundos para el calendario ampliado", () => {
    const registro = crearRegistro()
    const movido = desplazarSegmentosRegistro(registro, { segundos: 1 })
    const extremo = ajustarExtremoSegmentosRegistro(registro, { extremo: "fin", segundos: -2 })

    assert.equal(movido[0].inicio.getTime(), registro.segmentos[0].inicio.getTime() + 1000)
    assert.equal(movido.at(-1).fin.getTime(), registro.segmentos.at(-1).fin.getTime() + 1000)
    assert.equal(extremo.at(-1).fin.getTime(), registro.segmentos.at(-1).fin.getTime() - 2000)
    assert.equal(registro.segmentos[0].inicio.getSeconds(), 12)
})

test("rechaza desplazamientos vacíos o inválidos", () => {
    const registro = crearRegistro()

    assert.equal(desplazarSegmentosRegistro(registro), null)
    assert.equal(desplazarSegmentosRegistro(registro, { minutos: 0.5 }), null)
    assert.equal(desplazarSegmentosRegistro(registro, { segundos: 0.5 }), null)
    assert.equal(ajustarExtremoSegmentosRegistro(registro, { extremo: "medio", minutos: 1 }), null)
})
