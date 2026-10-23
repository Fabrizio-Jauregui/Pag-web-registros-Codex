import assert from "node:assert/strict"
import test from "node:test"

import {
    cargarHistorialFocus,
    cargarPlantillasFocus,
    cargarSesionActivaFocus,
    CLAVE_HISTORIAL_FOCUS,
    CLAVE_PLANTILLAS_FOCUS,
    CLAVE_SESION_ACTIVA_FOCUS,
    guardarHistorialFocus,
    guardarPlantillasFocus,
    guardarSesionActivaFocus
} from "./persistenciaFocus.js"
import { crearBloquesFocus } from "../../features/registros/usoSesionFocus.js"

function almacenamientoInicial() {
    const datos = new Map()
    return {
        getItem: clave => datos.get(clave) ?? null,
        setItem: (clave, valor) => datos.set(clave, valor),
        datos
    }
}

const marca = "2026-10-18T12:00:00.000Z"
const configuracion = {
    nombre: "Lectura",
    nombreActividad: "Leer",
    evento: null,
    confirmarAutomaticamente: false,
    bloques: [
        { nombre: "Concentración 1", tipo: "concentracion", minutos: 25 },
        { nombre: "Descanso 1", tipo: "descanso", minutos: 5 }
    ]
}

test("genera pares Focus y aplica límites compatibles con la duración máxima del registro", () => {
    const bloques = crearBloquesFocus(2, 25, 5)
    assert.equal(bloques.ok, true)
    assert.deepEqual(bloques.bloques.map(bloque => [bloque.tipo, bloque.minutos]), [
        ["concentracion", 25], ["descanso", 5],
        ["concentracion", 25], ["descanso", 5]
    ])
    assert.equal(crearBloquesFocus(0, 25, 5).ok, false)
    assert.equal(crearBloquesFocus(1, 181, 5).ok, false)
    assert.equal(crearBloquesFocus(8, 180, 60).ok, false)
    assert.equal(crearBloquesFocus(8, 180, 0).ok, false)
})

test("guarda y recupera plantillas, historial y estado activo de Focus", () => {
    const almacenamiento = almacenamientoInicial()
    const plantilla = { id: "plantilla-1", nombrePlantilla: "Lectura diaria", configuracion }
    const sesionActiva = {
        id: "sesion-1",
        configuracion,
        registroId: "registro-1",
        inicio: marca,
        indiceBloque: 0,
        estado: "pausada",
        finBloque: null,
        inicioTiempoMuerto: null,
        reanudarEstado: "concentracion",
        restanteMs: 30_000,
        tiempoMuertoAcumuladoMs: 0,
        extras: [{ tipo: "pausa-sesion", inicio: marca, fin: "2026-10-18T12:00:01.000Z" }],
        bloques: [{ ...configuracion.bloques[0], inicio: marca, fin: null }]
    }
    const sesion = {
        id: "sesion-1",
        configuracion,
        registroId: "registro-1",
        inicio: marca,
        fin: "2026-10-18T12:30:00.000Z",
        bloques: [{ ...configuracion.bloques[0], inicio: marca, fin: "2026-10-18T12:25:00.000Z" }],
        extras: [{ tipo: "tiempo-muerto", inicio: "2026-10-18T12:25:00.000Z", fin: "2026-10-18T12:26:00.000Z" }]
    }

    assert.deepEqual(guardarPlantillasFocus([plantilla], almacenamiento), { ok: true })
    assert.deepEqual(guardarHistorialFocus([sesion], almacenamiento), { ok: true })
    assert.deepEqual(guardarSesionActivaFocus(sesionActiva, almacenamiento), { ok: true })
    assert.deepEqual(cargarPlantillasFocus(almacenamiento).plantillas, [plantilla])
    assert.deepEqual(cargarHistorialFocus(almacenamiento).sesiones, [sesion])
    assert.deepEqual(cargarSesionActivaFocus(almacenamiento).sesion, sesionActiva)

    const llaves = [...almacenamiento.datos.keys()].sort()
    assert.deepEqual(llaves, [CLAVE_HISTORIAL_FOCUS, CLAVE_PLANTILLAS_FOCUS, CLAVE_SESION_ACTIVA_FOCUS].sort())
})

test("rechaza datos inválidos y no sobrescribe el contenido original", () => {
    const almacenamiento = almacenamientoInicial()
    almacenamiento.setItem(CLAVE_PLANTILLAS_FOCUS, "{")
    almacenamiento.setItem(CLAVE_HISTORIAL_FOCUS, "[]")
    almacenamiento.setItem(CLAVE_SESION_ACTIVA_FOCUS, JSON.stringify({ estado: "fantasma" }))

    assert.equal(cargarPlantillasFocus(almacenamiento).ok, false)
    assert.equal(cargarHistorialFocus(almacenamiento).ok, true)
    assert.equal(cargarSesionActivaFocus(almacenamiento).ok, false)
    assert.equal(guardarPlantillasFocus([{ id: "", nombrePlantilla: "", configuracion }], almacenamiento).ok, false)
    assert.equal(almacenamiento.getItem(CLAVE_PLANTILLAS_FOCUS), "{")
    assert.equal(guardarSesionActivaFocus({ estado: "fantasma" }, almacenamiento).ok, false)
    assert.equal(almacenamiento.getItem(CLAVE_SESION_ACTIVA_FOCUS), JSON.stringify({ estado: "fantasma" }))
})

test("mantiene compatible una sesión antigua y valida la preferencia de avance guardada en la sesión", () => {
    const almacenamiento = almacenamientoInicial()
    const sesionAntigua = {
        id: "sesion-antigua",
        configuracion: { ...configuracion, confirmarAutomaticamente: true },
        registroId: null,
        inicio: marca,
        indiceBloque: 1,
        estado: "descanso",
        finBloque: "2026-10-18T12:05:00.000Z",
        inicioTiempoMuerto: null,
        reanudarEstado: null,
        restanteMs: 0,
        bloques: configuracion.bloques.map((bloque, indice) => ({
            ...bloque,
            inicio: indice === 0 ? marca : null,
            fin: indice === 0 ? "2026-10-18T12:25:00.000Z" : null
        }))
    }

    assert.equal(guardarSesionActivaFocus(sesionAntigua, almacenamiento).ok, true)
    assert.deepEqual(cargarSesionActivaFocus(almacenamiento).sesion, sesionAntigua)

    const sesionAutomatica = { ...sesionAntigua, avanzarAutomaticamente: true }
    assert.equal(guardarSesionActivaFocus(sesionAutomatica, almacenamiento).ok, true)
    assert.deepEqual(cargarSesionActivaFocus(almacenamiento).sesion, sesionAutomatica)
    assert.equal(guardarSesionActivaFocus({ ...sesionAutomatica, avanzarAutomaticamente: "sí" }, almacenamiento).ok, false)
})
