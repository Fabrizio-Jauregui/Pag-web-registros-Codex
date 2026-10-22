import assert from "node:assert/strict"
import test from "node:test"

import { agruparTiempoPorEvento, agruparTiempoPorTarea, calcularAnaliticaRegistros, obtenerRangoAnalitico } from "./analiticaRegistros.js"

const intervalo = (inicio, fin, tipo = "En curso") => ({ tipo, inicio, fin })

test("obtiene límites locales de día y semana, incluso al cruzar de año", () => {
    const fecha = new Date(2026, 0, 1, 15)
    const dia = obtenerRangoAnalitico(fecha, "dia")
    const semana = obtenerRangoAnalitico(fecha, "semana")

    assert.equal(dia.inicio.getHours(), 0)
    assert.equal(dia.fin.getTime() - dia.inicio.getTime(), 24 * 60 * 60 * 1000)
    assert.equal(semana.inicio.getFullYear(), 2025)
    assert.equal(semana.inicio.getMonth(), 11)
    assert.equal(semana.inicio.getDate(), 29)
    assert.equal(semana.fin.getFullYear(), 2026)
    assert.equal(semana.fin.getMonth(), 0)
    assert.equal(semana.fin.getDate(), 5)
    assert.equal(obtenerRangoAnalitico(new Date(Number.NaN), "dia"), null)
    assert.equal(obtenerRangoAnalitico(fecha, "mes"), null)
})

test("agrupa por ID de evento, une solapamientos dentro del evento y distingue otros eventos", () => {
    const inicioDia = new Date(2026, 9, 12)
    const finDia = new Date(2026, 9, 13)
    const eventos = [
        { id: "estudio", nombre: "Estudio actualizado", color: "#123456" },
        { id: "pausa-activa", nombre: "Pausa activa", color: "#654321" }
    ]
    const registros = [
        { eventoId: "estudio", nombre: "Estudio", colorEvento: "#123456", segmentos: [intervalo(new Date(2026, 9, 12, 9), new Date(2026, 9, 12, 10))] },
        { eventoId: "estudio", nombre: "Estudio", colorEvento: "#123456", segmentos: [intervalo(new Date(2026, 9, 12, 9, 30), new Date(2026, 9, 12, 10, 30))] },
        { eventoId: "pausa-activa", nombre: "Pausa activa", colorEvento: "#654321", segmentos: [intervalo(new Date(2026, 9, 12, 9, 30), new Date(2026, 9, 12, 10, 30))] },
        { eventoId: null, nombre: "Actividad manual", colorEvento: null, segmentos: [intervalo(new Date(2026, 9, 12, 11), new Date(2026, 9, 12, 11, 30))] }
    ]

    const analitica = calcularAnaliticaRegistros(registros, eventos, inicioDia, finDia, finDia)

    assert.equal(analitica.totalSegundos, 2 * 60 * 60)
    assert.deepEqual(analitica.porEvento.map(({ eventoId, nombre, segundos }) => ({ eventoId, nombre, segundos })), [
        { eventoId: "estudio", nombre: "Estudio actualizado", segundos: 90 * 60 },
        { eventoId: "pausa-activa", nombre: "Pausa activa", segundos: 60 * 60 },
        { eventoId: null, nombre: "Sin evento vinculado", segundos: 30 * 60 }
    ])
    assert.ok(analitica.porEvento.reduce((total, grupo) => total + grupo.segundos, 0) > analitica.totalSegundos)
})

test("cuenta tiempo efectivo en curso hasta ahora y excluye las pausas", () => {
    const inicio = new Date(2026, 9, 12)
    const fin = new Date(2026, 9, 13)
    const ahora = new Date(2026, 9, 12, 12)
    const registros = [{ eventoId: "estudio", nombre: "Estudio", segmentos: [
        intervalo(new Date(2026, 9, 12, 9), new Date(2026, 9, 12, 10)),
        intervalo(new Date(2026, 9, 12, 10), new Date(2026, 9, 12, 11), "Pausado"),
        intervalo(new Date(2026, 9, 12, 11), null)
    ] }]

    const grupos = agruparTiempoPorEvento(registros, [{ id: "estudio", nombre: "Estudio", color: "#123456" }], inicio, fin, ahora)
    assert.equal(grupos[0].segundos, 2 * 60 * 60)
})

test("no muestra grupos sin tiempo en el período", () => {
    const inicio = new Date(2026, 9, 12)
    const fin = new Date(2026, 9, 13)
    const grupos = agruparTiempoPorEvento([], [{ id: "estudio", nombre: "Estudio", color: "#123456" }], inicio, fin)

    assert.deepEqual(grupos, [])
})

test("agrupa por tarea y no confunde los registros de tareas con actividades sin evento", () => {
    const inicio = new Date(2026, 9, 12)
    const fin = new Date(2026, 9, 13)
    const registros = [
        { tareaId: "colegio", tareaNombre: "Adelantar tarea del colegio", eventoId: null, segmentos: [intervalo(new Date(2026, 9, 12, 9), new Date(2026, 9, 12, 10))] },
        { tareaId: "colegio", tareaNombre: "Adelantar tarea del colegio", eventoId: null, segmentos: [intervalo(new Date(2026, 9, 12, 10), new Date(2026, 9, 12, 10, 30))] },
        { tareaId: null, eventoId: null, nombre: "Concentración", segmentos: [intervalo(new Date(2026, 9, 12, 11), new Date(2026, 9, 12, 11, 15))] }
    ]

    const porTarea = agruparTiempoPorTarea(registros, inicio, fin, fin)
    assert.deepEqual(porTarea.map(({ tareaId, nombre, segundos }) => ({ tareaId, nombre, segundos })), [
        { tareaId: "colegio", nombre: "Adelantar tarea del colegio", segundos: 90 * 60 },
        { tareaId: null, nombre: "Sin tarea vinculada", segundos: 15 * 60 }
    ])
    const porEvento = calcularAnaliticaRegistros(registros, [], inicio, fin, fin)
    assert.deepEqual(porEvento.porEvento.map(({ nombre, segundos }) => ({ nombre, segundos })), [
        { nombre: "Sin evento vinculado", segundos: 15 * 60 }
    ])
})

test("agrupa por categoría, incluye registros manuales en sin categoría y une intervalos simultáneos", () => {
    const inicio = new Date(2026, 9, 12)
    const fin = new Date(2026, 9, 13)
    const categorias = [{ id: "salud", nombre: "Salud" }, { id: "casa", nombre: "Casa" }]
    const eventos = [
        { id: "correr", nombre: "Correr", categoriaId: "salud" },
        { id: "yoga", nombre: "Yoga", categoriaId: "salud" },
        { id: "limpiar", nombre: "Limpiar", categoriaId: "casa" },
        { id: "leer", nombre: "Leer" }
    ]
    const registros = [
        { eventoId: "correr", segmentos: [intervalo(new Date(2026, 9, 12, 9), new Date(2026, 9, 12, 10))] },
        { eventoId: "yoga", segmentos: [intervalo(new Date(2026, 9, 12, 9, 30), new Date(2026, 9, 12, 10, 30))] },
        { eventoId: "limpiar", segmentos: [intervalo(new Date(2026, 9, 12, 11), new Date(2026, 9, 12, 11, 30))] },
        { eventoId: "leer", segmentos: [intervalo(new Date(2026, 9, 12, 12), new Date(2026, 9, 12, 12, 15))] },
        { eventoId: null, segmentos: [intervalo(new Date(2026, 9, 12, 13), new Date(2026, 9, 12, 13, 10))] }
    ]
    const agrupada = calcularAnaliticaRegistros(registros, eventos, inicio, fin, fin, { categorias, agruparPor: "categoria" })
    assert.deepEqual(agrupada.porCategoria.map(({ nombre, segundos }) => ({ nombre, segundos })), [
        { nombre: "Salud", segundos: 90 * 60 },
        { nombre: "Casa", segundos: 30 * 60 },
        { nombre: "Sin categoría", segundos: 25 * 60 }
    ])
    const filtrada = calcularAnaliticaRegistros(registros, eventos, inicio, fin, fin, { categorias, categoriaId: "salud" })
    assert.equal(filtrada.totalSegundos, 90 * 60)
    assert.deepEqual(filtrada.porEvento.map(grupo => grupo.nombre), ["Correr", "Yoga"])
    const sinCategoria = calcularAnaliticaRegistros(registros, eventos, inicio, fin, fin, { categorias, categoriaId: "__sin_categoria__" })
    assert.equal(sinCategoria.totalSegundos, 25 * 60)
    assert.deepEqual(sinCategoria.porEvento.map(grupo => grupo.nombre).sort(), ["Leer", "Sin evento vinculado"])
})
