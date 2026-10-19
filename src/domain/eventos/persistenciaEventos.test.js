import assert from "node:assert/strict"
import test from "node:test"

import {
    cargarPlantillasEventos,
    CLAVE_PLANTILLAS_EVENTOS,
    guardarPlantillasEventos
} from "./persistenciaEventos.js"

const plantillasEjemplo = [
    { id: "evento-1", nombre: "Lectura", color: "#112233" }
]

function crearAlmacenamiento(valor = null) {
    const valores = new Map()

    if (valor !== null) {
        valores.set(CLAVE_PLANTILLAS_EVENTOS, valor)
    }

    return {
        valores,
        getItem(clave) {
            return valores.has(clave) ? valores.get(clave) : null
        },
        setItem(clave, contenido) {
            valores.set(clave, contenido)
        }
    }
}

test("devuelve una lista vacía cuando todavía no hay datos guardados", () => {
    assert.deepEqual(cargarPlantillasEventos(crearAlmacenamiento()), {
        ok: true,
        plantillas: []
    })
})

test("carga plantillas válidas y guarda la colección con su clave", () => {
    const almacenamiento = crearAlmacenamiento()

    assert.deepEqual(guardarPlantillasEventos(plantillasEjemplo, almacenamiento), { ok: true })
    assert.equal(
        almacenamiento.valores.get(CLAVE_PLANTILLAS_EVENTOS),
        JSON.stringify(plantillasEjemplo)
    )
    assert.deepEqual(cargarPlantillasEventos(almacenamiento), {
        ok: true,
        plantillas: plantillasEjemplo
    })
})

test("sigue cargando eventos existentes que todavía no incluyen categoría", () => {
    const existentes = [{ id: "evento-anterior", nombre: "Lectura", color: "#112233" }]
    assert.deepEqual(cargarPlantillasEventos(crearAlmacenamiento(JSON.stringify(existentes))), { ok: true, plantillas: existentes })
})

test("rechaza JSON dañado sin sobrescribir el valor original", () => {
    const contenidoOriginal = "{json incompleto"
    const almacenamiento = crearAlmacenamiento(contenidoOriginal)
    const resultado = cargarPlantillasEventos(almacenamiento)

    assert.equal(resultado.ok, false)
    assert.match(resultado.error, /JSON válido/)
    assert.equal(almacenamiento.valores.get(CLAVE_PLANTILLAS_EVENTOS), contenidoOriginal)
})

test("rechaza colecciones incompatibles y IDs duplicados sin alterarlas", () => {
    const coleccionInvalida = [
        ...plantillasEjemplo,
        { ...plantillasEjemplo[0], nombre: "Otra actividad" }
    ]
    const contenidoOriginal = JSON.stringify(coleccionInvalida)
    const almacenamiento = crearAlmacenamiento(contenidoOriginal)
    const resultado = cargarPlantillasEventos(almacenamiento)

    assert.equal(resultado.ok, false)
    assert.match(resultado.error, /datos inválidos/)
    assert.equal(almacenamiento.valores.get(CLAVE_PLANTILLAS_EVENTOS), contenidoOriginal)
})

test("comunica los errores de lectura del almacenamiento", () => {
    const almacenamiento = {
        getItem() {
            throw new Error("Acceso denegado")
        }
    }

    const resultado = cargarPlantillasEventos(almacenamiento)

    assert.equal(resultado.ok, false)
    assert.match(resultado.error, /No se pudieron leer/)
})

test("comunica los errores de escritura sin modificar el estado del almacenamiento", () => {
    const almacenamiento = {
        setItem() {
            throw new Error("Cuota excedida")
        }
    }
    const resultado = guardarPlantillasEventos(plantillasEjemplo, almacenamiento)

    assert.equal(resultado.ok, false)
    assert.match(resultado.error, /No se pudieron guardar/)
})

test("no escribe una colección inválida", () => {
    let intentosDeEscritura = 0
    const almacenamiento = {
        setItem() {
            intentosDeEscritura += 1
        }
    }
    const resultado = guardarPlantillasEventos([{ id: "", nombre: "", color: "red" }], almacenamiento)

    assert.equal(resultado.ok, false)
    assert.equal(intentosDeEscritura, 0)
})
