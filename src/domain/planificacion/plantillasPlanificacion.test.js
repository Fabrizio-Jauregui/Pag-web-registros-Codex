import assert from "node:assert/strict"
import test from "node:test"
import {
    actualizarPlantillaPlanificacion,
    aplicarPlantillaPlanificacion,
    crearPlantillaPlanificacion,
    eliminarPlantillaPlanificacion,
    normalizarOrdenEtapasCronometro,
    ordenarActividadesPlantilla,
    previsualizarPlantillaPlanificacion,
    validarColeccionPlantillasPlanificacion,
    validarPlantillaPlanificacion,
    yaAplicadaEnFecha
} from "./plantillasPlanificacion.js"
import { cargarPlantillasPlanificacion, CLAVE_PLANTILLAS_PLANIFICACION, guardarPlantillasPlanificacion } from "./persistenciaPlantillasPlanificacion.js"

const plantillaBase = { id: "rutina", nombre: "Mañana", actividades: [
    { id: "leer", nombre: "Lectura", eventoId: "evento-leer", inicioSegundos: 9 * 3600, finSegundos: 9 * 3600 + 1800, finDia: 0 },
    { id: "dormir", nombre: "Descanso", eventoId: "evento-dormir", inicioSegundos: 23 * 3600, finSegundos: 1800, finDia: 1 }
] }
const fecha = new Date(2026, 9, 17)
const ahora = new Date(2026, 9, 15, 12, 0, 0)
const generarId = (() => { let n = 0; return () => `id-${++n}` })()

function almacen() {
    const valores = new Map()
    return { valores, getItem: key => valores.get(key) ?? null, setItem: (key, value) => valores.set(key, value) }
}

function eventosPara(plantilla) {
    const eventos = new Map()
    for (const actividad of plantilla.actividades) {
        if (actividad.eventoId) eventos.set(actividad.eventoId, { id: actividad.eventoId, nombre: actividad.nombre, color: "#4F46E5" })
    }
    return [...eventos.values()]
}

test("valida nombre, actividades y fin al día siguiente explícito", () => {
    assert.equal(validarPlantillaPlanificacion(plantillaBase), null)
    assert.match(validarPlantillaPlanificacion({ ...plantillaBase, actividades: [plantillaBase.actividades[0]] }), /al menos dos/)
    assert.match(validarPlantillaPlanificacion({ ...plantillaBase, actividades: [
        { ...plantillaBase.actividades[0], finDia: 0, finSegundos: 8 * 3600 },
        plantillaBase.actividades[1]
    ] }), /posterior/)
})

test("crea, actualiza y elimina una plantilla sin modificar otros elementos", () => {
    const creada = crearPlantillaPlanificacion({ nombre: " Test ", actividades: plantillaBase.actividades }, generarId)
    assert.equal(creada.ok, true)
    assert.equal(creada.plantilla.nombre, "Test")
    const actualizada = actualizarPlantillaPlanificacion([creada.plantilla], creada.plantilla.id, { nombre: "Rutina", actividades: creada.plantilla.actividades })
    assert.equal(actualizada.plantillas[0].nombre, "Rutina")
    assert.equal(eliminarPlantillaPlanificacion(actualizada.plantillas, creada.plantilla.id).plantillas.length, 0)
})

test("aplica a una fecha como planes independientes con el mismo origen de aplicación", () => {
    let n = 0
    const resultado = aplicarPlantillaPlanificacion(plantillaBase, fecha, eventosPara(plantillaBase), { ahora }, () => `plan-${++n}`)
    assert.equal(resultado.ok, true)
    assert.equal(resultado.planes.length, 2)
    assert.equal(resultado.planes[0].inicio.getHours(), 9)
    assert.equal(resultado.planes[0].fin.getMinutes(), 30)
    assert.equal(resultado.planes[1].fin.getDate(), 18)
    assert.equal(resultado.planes[0].idAplicacionPlantilla, resultado.planes[1].idAplicacionPlantilla)
    assert.equal(yaAplicadaEnFecha(resultado.planes, plantillaBase.id, fecha), true)
    assert.equal(yaAplicadaEnFecha(resultado.planes, plantillaBase.id, new Date(2026, 9, 16)), false)
})

test("aplica secuencias por duración desde la hora elegida y mantiene las actividades consecutivas", () => {
    const porDuracion = {
        ...plantillaBase,
        modo: "duraciones",
        actividades: [
            { id: "almorzar", nombre: "Almorzar", eventoId: "evento-almorzar", duracionSegundos: 3600 },
            { id: "platos", nombre: "Lavar los platos", eventoId: "evento-platos", duracionSegundos: 1800 }
        ]
    }
    const resultado = aplicarPlantillaPlanificacion(porDuracion, fecha, eventosPara(porDuracion), {
        ahora,
        horaInicioSegundos: 14 * 3600 + 10
    }, (() => { let n = 0; return () => `duracion-${++n}` })())
    assert.equal(resultado.ok, true)
    assert.deepEqual(resultado.planes.map(plan => [plan.inicio.getHours(), plan.inicio.getMinutes(), plan.inicio.getSeconds()]), [[14, 0, 10], [15, 0, 10]])
    assert.deepEqual(resultado.planes.map(plan => [plan.fin.getHours(), plan.fin.getMinutes(), plan.fin.getSeconds()]), [[15, 0, 10], [15, 30, 10]])
})

test("aplica una plantilla de cronómetro sin duración ni horario propio para cada actividad", () => {
    const cronometro = {
        id: "cronometro", nombre: "Desayuno", modo: "cronometro", actividades: [
            { id: "preparar", nombre: "Preparar desayuno", eventoId: "evento-preparar", grupoCronometro: 0, ordenSecuencia: 0 },
            { id: "desayunar", nombre: "Desayunar", eventoId: "evento-desayunar", grupoCronometro: 1, ordenSecuencia: 1 },
            { id: "youtube", nombre: "Ver YouTube", eventoId: "evento-youtube", grupoCronometro: 1, ordenSecuencia: 1 }
        ]
    }
    assert.equal(validarPlantillaPlanificacion(cronometro), null)
    const resultado = aplicarPlantillaPlanificacion(cronometro, fecha, eventosPara(cronometro), { ahora, horaInicioSegundos: 9 * 3600 }, (() => { let n = 0; return () => `crono-${++n}` })())
    assert.equal(resultado.ok, true)
    assert.deepEqual(resultado.planes.map(plan => [plan.nombre, plan.inicio.getHours(), plan.inicio.getMinutes(), plan.grupoCronometro, plan.modoSeguimientoPlanificacion]), [
        ["Preparar desayuno", 9, 0, 0, "cronometro"],
        ["Desayunar", 9, 0, 1, "cronometro"],
        ["Ver YouTube", 9, 0, 1, "cronometro"]
    ])
    assert.equal(resultado.planes.every(plan => plan.fin === null), true)
    const vista = previsualizarPlantillaPlanificacion(cronometro, fecha, eventosPara(cronometro), { ahora, horaInicioSegundos: 9 * 3600 })
    assert.equal(vista.actividades.every(item => item.sinDuracion), true)
})

test("aplica una línea de tiempo relativa con solapamientos parciales y hora de inicio desplazable", () => {
    const relativa = {
        ...plantillaBase,
        modo: "relativo",
        actividades: [
            { id: "desayuno", nombre: "Desayunar", eventoId: "evento-desayuno", inicioDesplazamientoSegundos: 0, duracionSegundos: 20 * 60 },
            { id: "youtube", nombre: "Ver YouTube", eventoId: "evento-youtube", inicioDesplazamientoSegundos: 10 * 60, duracionSegundos: 30 * 60 },
            { id: "platos", nombre: "Lavar los platos", eventoId: "evento-platos", inicioDesplazamientoSegundos: 30 * 60, duracionSegundos: 20 * 60 }
        ]
    }
    const resultado = aplicarPlantillaPlanificacion(relativa, fecha, eventosPara(relativa), { ahora, horaInicioSegundos: 9 * 3600 }, (() => { let n = 0; return () => `relativo-${++n}` })())
    assert.equal(resultado.ok, true)
    assert.deepEqual(resultado.planes.map(plan => [plan.inicio.getHours(), plan.inicio.getMinutes(), plan.fin.getHours(), plan.fin.getMinutes()]), [
        [9, 0, 9, 20], [9, 10, 9, 40], [9, 30, 9, 50]
    ])
})

test("aplica secuencias apiladas y paralelas tomando como referencia explícita el inicio de una actividad", () => {
    const secuencias = {
        ...plantillaBase,
        modo: "secuencias",
        actividades: [
            { id: "preparar", nombre: "Preparar desayuno", eventoId: "evento-preparar", duracionSegundos: 600, secuenciaId: "principal", ordenSecuencia: 0, anclaActividadId: null, desplazamientoAnclaSegundos: 0 },
            { id: "desayunar", nombre: "Desayunar", eventoId: "evento-desayunar", duracionSegundos: 1200, secuenciaId: "principal", ordenSecuencia: 1, anclaActividadId: null, desplazamientoAnclaSegundos: 0 },
            { id: "youtube", nombre: "Ver YouTube", eventoId: "evento-youtube", duracionSegundos: 1800, secuenciaId: "youtube", ordenSecuencia: 0, anclaActividadId: "desayunar", desplazamientoAnclaSegundos: 600 },
            { id: "servir", nombre: "Servir la mesa", eventoId: "evento-servir", duracionSegundos: 300, secuenciaId: "servir", ordenSecuencia: 0, anclaActividadId: "desayunar", desplazamientoAnclaSegundos: -300 }
        ]
    }
    assert.equal(validarPlantillaPlanificacion(secuencias), null)
    const resultado = aplicarPlantillaPlanificacion(secuencias, fecha, eventosPara(secuencias), { ahora, horaInicioSegundos: 9 * 3600 }, (() => { let n = 0; return () => `secuencia-${++n}` })())
    assert.equal(resultado.ok, true)
    assert.deepEqual(resultado.planes.map(plan => [plan.inicio.getHours(), plan.inicio.getMinutes(), plan.fin.getHours(), plan.fin.getMinutes()]), [
        [9, 0, 9, 10], [9, 10, 9, 30], [9, 20, 9, 50], [9, 5, 9, 10]
    ])
})

test("rechaza secuencias con anclajes inexistentes, ciclos o actividades fuera del horizonte", () => {
    const base = {
        ...plantillaBase,
        modo: "secuencias",
        actividades: [
            { id: "una", nombre: "Una", eventoId: "evento-una", duracionSegundos: 1800, secuenciaId: "principal", ordenSecuencia: 0, anclaActividadId: null, desplazamientoAnclaSegundos: 0 },
            { id: "dos", nombre: "Dos", eventoId: "evento-dos", duracionSegundos: 1800, secuenciaId: "paralela", ordenSecuencia: 0, anclaActividadId: "una", desplazamientoAnclaSegundos: 0 }
        ]
    }
    assert.match(validarPlantillaPlanificacion({ ...base, actividades: base.actividades.map(item => item.id === "dos" ? { ...item, anclaActividadId: "ausente" } : item) }), /referencia inválida/)
    const ciclo = { ...base, actividades: [...base.actividades, { id: "tres", nombre: "Tres", eventoId: "evento-tres", duracionSegundos: 1800, secuenciaId: "otra", ordenSecuencia: 0, anclaActividadId: "dos", desplazamientoAnclaSegundos: 0 }].map(item => item.id === "dos" ? { ...item, anclaActividadId: "tres" } : item) }
    assert.match(validarPlantillaPlanificacion(ciclo), /ciclos/)
    assert.match(validarPlantillaPlanificacion({ ...base, actividades: base.actividades.map(item => item.id === "dos" ? { ...item, desplazamientoAnclaSegundos: 86400 } : item) }), /primeras 24 horas/)
})

test("limita las actividades nuevas al horizonte de 24 horas y conserva plantillas anteriores al cargarlas", () => {
    const extendida = {
        ...plantillaBase,
        modo: "relativo",
        actividades: [
            { id: "tarde", nombre: "Actividad tarde", eventoId: "evento-tarde", inicioDesplazamientoSegundos: 23 * 3600, duracionSegundos: 2 * 3600 },
            { id: "otra", nombre: "Otra actividad", eventoId: "evento-otra", inicioDesplazamientoSegundos: 0, duracionSegundos: 1800 }
        ]
    }
    assert.match(validarPlantillaPlanificacion(extendida), /secuencia completa no puede superar 24 horas/)
    assert.equal(validarColeccionPlantillasPlanificacion([extendida]), true)

    const porDuracionLarga = {
        ...plantillaBase,
        modo: "duraciones",
        actividades: [
            { id: "primera", nombre: "Primera", eventoId: "evento-primera", duracionSegundos: 15 * 3600 },
            { id: "segunda", nombre: "Segunda", eventoId: "evento-segunda", duracionSegundos: 10 * 3600 }
        ]
    }
    assert.match(validarPlantillaPlanificacion(porDuracionLarga), /secuencia completa no puede superar 24 horas/)
})

test("previsualiza la misma secuencia que se aplicará sin crear identificadores ni planes", () => {
    const porDuracion = {
        ...plantillaBase,
        modo: "duraciones",
        actividades: [
            { id: "almorzar", nombre: "Almorzar", eventoId: "evento-almorzar", duracionSegundos: 3600 },
            { id: "platos", nombre: "Lavar los platos", eventoId: "evento-platos", duracionSegundos: 1800 }
        ]
    }
    const vistaPrevia = previsualizarPlantillaPlanificacion(porDuracion, fecha, eventosPara(porDuracion), {
        ahora,
        horaInicioSegundos: 14 * 3600 + 10
    })
    assert.equal(vistaPrevia.ok, true)
    assert.deepEqual(vistaPrevia.actividades.map(item => [item.nombre, item.inicio.getHours(), item.inicio.getMinutes(), item.inicio.getSeconds(), item.fin.getHours(), item.fin.getMinutes(), item.fin.getSeconds()]), [
        ["Almorzar", 14, 0, 10, 15, 0, 10],
        ["Lavar los platos", 15, 0, 10, 15, 30, 10]
    ])
})

test("rechaza duraciones inválidas e inicios pasados, y permite que una secuencia cruce medianoche", () => {
    const porDuracion = {
        ...plantillaBase,
        modo: "duraciones",
        actividades: [
            { id: "una", nombre: "Una", eventoId: "evento-una", duracionSegundos: 3600 },
            { id: "dos", nombre: "Dos", eventoId: "evento-dos", duracionSegundos: 1800 }
        ]
    }
    assert.match(validarPlantillaPlanificacion({ ...porDuracion, actividades: [{ ...porDuracion.actividades[0], duracionSegundos: 0 }, porDuracion.actividades[1]] }), /duración.*mayor que cero/)
    const hoy = new Date(2026, 9, 15)
    assert.match(aplicarPlantillaPlanificacion(porDuracion, hoy, eventosPara(porDuracion), { ahora, horaInicioSegundos: 11 * 3600 }).error, /ya pasó o ya está transcurriendo/)
    const cruzandoMedianoche = aplicarPlantillaPlanificacion(porDuracion, fecha, eventosPara(porDuracion), {
        ahora,
        horaInicioSegundos: 23 * 3600
    }, (() => { let n = 0; return () => `noche-${++n}` })())
    assert.equal(cruzandoMedianoche.ok, true)
    assert.deepEqual(cruzandoMedianoche.planes.map(plan => [plan.inicio.getDate(), plan.inicio.getHours(), plan.fin.getDate(), plan.fin.getHours(), plan.fin.getMinutes()]), [
        [17, 23, 18, 0, 0], [18, 0, 18, 0, 30]
    ])
})

test("rechaza referencias a eventos que ya no están y conserva las actividades aplicadas frente a ediciones", () => {
    const vinculada = { ...plantillaBase, actividades: [{ ...plantillaBase.actividades[0], eventoId: "evento-a" }, plantillaBase.actividades[1]] }
    assert.match(aplicarPlantillaPlanificacion(vinculada, fecha, [], { ahora }).error, /ya no está disponible/)
    const aplicada = aplicarPlantillaPlanificacion(plantillaBase, fecha, eventosPara(plantillaBase), { ahora }, () => "plan-a").planes[0]
    const editada = actualizarPlantillaPlanificacion([plantillaBase], plantillaBase.id, { nombre: "Otra", actividades: [{ ...plantillaBase.actividades[0], nombre: "Otra actividad" }, plantillaBase.actividades[1]] }).plantillas[0]
    assert.equal(aplicada.nombre, "Lectura")
    assert.equal(editada.actividades[0].nombre, "Otra actividad")
})

test("no permite aplicar a días pasados ni iniciar actividades antes o justo en el momento actual", () => {
    const ayer = new Date(2026, 9, 14)
    assert.match(aplicarPlantillaPlanificacion(plantillaBase, ayer, eventosPara(plantillaBase), { ahora }).error, /fecha pasada/)
    const actividadPasada = { ...plantillaBase, actividades: [
        { ...plantillaBase.actividades[0], inicioSegundos: 11 * 3600, finSegundos: 11 * 3600 + 1800 },
        plantillaBase.actividades[1]
    ] }
    assert.match(aplicarPlantillaPlanificacion(actividadPasada, new Date(2026, 9, 15), eventosPara(actividadPasada), { ahora }).error, /ya pasó o ya está transcurriendo/)
    const ahoraExacto = { ...plantillaBase, actividades: [
        { ...plantillaBase.actividades[0], inicioSegundos: 12 * 3600, finSegundos: 12 * 3600 + 1800 },
        plantillaBase.actividades[1]
    ] }
    assert.match(aplicarPlantillaPlanificacion(ahoraExacto, new Date(2026, 9, 15), eventosPara(ahoraExacto), { ahora }).error, /ya pasó o ya está transcurriendo/)
    const futuraHoy = { ...plantillaBase, actividades: [
        { ...plantillaBase.actividades[0], inicioSegundos: 13 * 3600, finSegundos: 13 * 3600 + 1800 },
        plantillaBase.actividades[1]
    ] }
    assert.equal(aplicarPlantillaPlanificacion(futuraHoy, new Date(2026, 9, 15), eventosPara(futuraHoy), { ahora }).ok, true)
})

test("persiste en una clave propia y rechaza datos corruptos sin sobrescribir", () => {
    const almacenamiento = almacen()
    almacenamiento.setItem("focus.planes.v1", "planes intactos")
    assert.deepEqual(guardarPlantillasPlanificacion([plantillaBase], almacenamiento), { ok: true })
    assert.equal(cargarPlantillasPlanificacion(almacenamiento).plantillas[0].id, plantillaBase.id)
    assert.equal(almacenamiento.getItem("focus.planes.v1"), "planes intactos")
    almacenamiento.setItem(CLAVE_PLANTILLAS_PLANIFICACION, "{mal")
    assert.equal(cargarPlantillasPlanificacion(almacenamiento).ok, false)
    assert.equal(almacenamiento.getItem(CLAVE_PLANTILLAS_PLANIFICACION), "{mal")
})

test("conserva al guardar el orden reordenado de las etapas del cronómetro y sus paralelos", () => {
    const cronometro = {
        id: "cronometro-ordenado",
        nombre: "Rutina con cronómetro",
        modo: "cronometro",
        actividades: [
            { id: "primera", nombre: "Primera etapa", eventoId: "evento-primera", grupoCronometro: 1, ordenSecuencia: 1 },
            { id: "paralela-a", nombre: "Paralela A", eventoId: "evento-paralela-a", grupoCronometro: 0, ordenSecuencia: 0 },
            { id: "paralela-b", nombre: "Paralela B", eventoId: "evento-paralela-b", grupoCronometro: 0, ordenSecuencia: 0 }
        ]
    }
    const normalizadas = normalizarOrdenEtapasCronometro(cronometro.actividades)
    assert.deepEqual(normalizadas.map(item => [item.id, item.grupoCronometro, item.ordenSecuencia]), [
        ["primera", 1, 1], ["paralela-a", 0, 0], ["paralela-b", 0, 0]
    ])

    const actualizada = actualizarPlantillaPlanificacion([cronometro], cronometro.id, { ...cronometro, actividades: normalizadas })
    assert.equal(actualizada.ok, true)
    const almacenamiento = almacen()
    assert.deepEqual(guardarPlantillasPlanificacion(actualizada.plantillas, almacenamiento), { ok: true })
    const recargada = cargarPlantillasPlanificacion(almacenamiento)
    assert.equal(recargada.ok, true)
    assert.deepEqual(ordenarActividadesPlantilla(recargada.plantillas[0]).map(item => item.id), [
        "paralela-a", "paralela-b", "primera"
    ])
    const aplicada = aplicarPlantillaPlanificacion(
        recargada.plantillas[0], fecha, eventosPara(recargada.plantillas[0]),
        { ahora, horaInicioSegundos: 9 * 3600 },
        (() => { let n = 0; return () => `etapa-${++n}` })()
    )
    assert.equal(aplicada.ok, true)
    assert.deepEqual(aplicada.planes.map(plan => [plan.nombre, plan.grupoCronometro, plan.ordenSeguimiento]), [
        ["Paralela A", 0, 0], ["Paralela B", 0, 1], ["Primera etapa", 1, 2]
    ])
})

test("ordena secuencias por su inicio calculado y mantiene estables las actividades paralelas", () => {
    const secuencias = {
        ...plantillaBase,
        modo: "secuencias",
        actividades: [
            { id: "segunda", nombre: "Segunda", eventoId: "evento-segunda", duracionSegundos: 600, secuenciaId: "principal", ordenSecuencia: 1, anclaActividadId: null, desplazamientoAnclaSegundos: 0 },
            { id: "primera", nombre: "Primera", eventoId: "evento-primera", duracionSegundos: 600, secuenciaId: "principal", ordenSecuencia: 0, anclaActividadId: null, desplazamientoAnclaSegundos: 0 },
            { id: "paralela", nombre: "Paralela", eventoId: "evento-paralela", duracionSegundos: 300, secuenciaId: "paralela", ordenSecuencia: 0, anclaActividadId: "primera", desplazamientoAnclaSegundos: 0 }
        ]
    }
    assert.deepEqual(ordenarActividadesPlantilla(secuencias).map(item => item.id), ["primera", "paralela", "segunda"])
})

test("ordena los horarios definidos por inicio y conserva el orden estable de los empates", () => {
    const horarios = {
        ...plantillaBase,
        actividades: [
            { ...plantillaBase.actividades[1], inicioSegundos: 23 * 3600 },
            { ...plantillaBase.actividades[0], inicioSegundos: 8 * 3600 },
            { id: "paralela", nombre: "Paralela", eventoId: "evento-paralela", inicioSegundos: 8 * 3600, finSegundos: 9 * 3600, finDia: 0 }
        ]
    }
    assert.deepEqual(ordenarActividadesPlantilla(horarios).map(item => item.id), ["leer", "paralela", "dormir"])
})

test("carga plantillas antiguas de una actividad para poder editarlas sin bloquear la biblioteca", () => {
    const unaActividad = { ...plantillaBase, actividades: [plantillaBase.actividades[0]] }
    assert.equal(validarPlantillaPlanificacion(unaActividad), "Agregá al menos dos actividades a la plantilla.")
    const almacenamiento = almacen()
    almacenamiento.setItem(CLAVE_PLANTILLAS_PLANIFICACION, JSON.stringify([unaActividad]))
    assert.equal(cargarPlantillasPlanificacion(almacenamiento).ok, true)
})
