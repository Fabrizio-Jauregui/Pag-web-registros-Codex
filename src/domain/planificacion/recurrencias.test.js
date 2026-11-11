import assert from "node:assert/strict"
import test from "node:test"
import { crearPlan } from "./planes.js"
import {
    cambiarRecurrencia, crearReglaRecurrencia, eliminarRecurrencia, eliminarRecurrenciasDePlantilla,
    generarAparicionesRecurrencia, cargarRecurrencias, guardarRecurrencias,
    CLAVE_RECURRENCIAS, validarColeccionRecurrencias
} from "./recurrencias.js"

function fechaLocal(valor) { const [anio, mes, dia] = valor.split("-").map(Number); return new Date(anio, mes - 1, dia) }
const eventoLectura = nombre => ({ id: `evento-${nombre.toLocaleLowerCase().replaceAll(" ", "-")}`, nombre, color: "#123456" })

function serie({ dias = [1, 3], inicio = "2026-10-12T09:30:00", fin = null } = {}, id = "serie-x") {
    const plan = crearPlan({ evento: eventoLectura("Lectura"), inicio: new Date(inicio), fin: new Date(new Date(inicio).getTime() + 30 * 60_000) }, () => "plan-x").plan
    return crearReglaRecurrencia(plan, dias, fin, () => id).regla
}

test("expande las apariciones semanales dentro del rango conservando hora y duración", () => {
    const regla = serie()
    const apariciones = generarAparicionesRecurrencia([regla], fechaLocal("2026-10-11"), new Date(2026, 9, 18, 23, 59))
    assert.deepEqual(apariciones.map(plan => plan.fechaRecurrencia), ["2026-10-12", "2026-10-14"])
    assert.equal(apariciones[0].inicio.getHours(), 9)
    assert.equal(apariciones[0].inicio.getMinutes(), 30)
    assert.equal(apariciones[0].fin - apariciones[0].inicio, 30 * 60_000)
})

test("respeta fechas de inicio y fin y puede cruzar medianoche", () => {
    const regla = serie({ dias: [1], inicio: "2026-10-12T23:50:00", fin: "2026-10-19" })
    const apariciones = generarAparicionesRecurrencia([regla], fechaLocal("2026-10-05"), fechaLocal("2026-10-26"))
    assert.equal(apariciones.length, 2)
    assert.equal(apariciones[0].fin.getDate(), 13)
})

test("editar solo una fecha crea una excepción sin alterar el resto de la serie", () => {
    const regla = serie({ dias: [1] })
    const editada = cambiarRecurrencia([regla], regla.id, "2026-10-19", {
        nombre: "Lectura larga", evento: eventoLectura("Lectura larga"),
        inicio: new Date("2026-10-19T10:00:00"), fin: new Date("2026-10-19T11:00:00")
    }, "solo")
    const semana = generarAparicionesRecurrencia(editada.reglas, fechaLocal("2026-10-12"), fechaLocal("2026-10-26"))
    assert.equal(semana.find(plan => plan.fechaRecurrencia === "2026-10-19").nombre, "Lectura larga")
    assert.equal(semana.find(plan => plan.fechaRecurrencia === "2026-10-12").nombre, "Lectura")
})

test("editar esta y siguientes divide la serie y respeta la primera fecha", () => {
    const regla = serie({ dias: [1] })
    const editada = cambiarRecurrencia([regla], regla.id, "2026-10-19", {
        nombre: "Lectura nueva", evento: eventoLectura("Lectura nueva"),
        inicio: new Date("2026-10-19T10:00:00"), fin: new Date("2026-10-19T11:00:00")
    }, "siguientes")
    const apariciones = generarAparicionesRecurrencia(editada.reglas, fechaLocal("2026-10-12"), fechaLocal("2026-11-02"))
    assert.deepEqual(apariciones.map(plan => plan.nombre), ["Lectura", "Lectura nueva", "Lectura nueva", "Lectura nueva"])
    const primera = cambiarRecurrencia([regla], regla.id, "2026-10-12", {
        nombre: "A", evento: eventoLectura("A"), inicio: new Date("2026-10-12T09:00:00"), fin: new Date("2026-10-12T10:00:00")
    }, "siguientes")
    assert.equal(generarAparicionesRecurrencia(primera.reglas, fechaLocal("2026-10-12"), fechaLocal("2026-10-12"))[0].nombre, "A")
    const cambioEnTodaLaSerie = cambiarRecurrencia(editada.reglas, editada.reglas[1].id, "2026-10-19", {
        nombre: "Nombre para toda la serie", evento: eventoLectura("Nombre para toda la serie"),
        inicio: new Date("2026-10-19T11:00:00"), fin: new Date("2026-10-19T12:00:00")
    }, "toda")
    assert.deepEqual(cambioEnTodaLaSerie.reglas.map(item => item.nombre), ["Nombre para toda la serie", "Nombre para toda la serie"])
})

test("eliminar una aparición, las siguientes o toda la serie", () => {
    const regla = serie({ dias: [1] })
    const una = eliminarRecurrencia([regla], regla.id, "2026-10-19", "solo")
    assert.equal(generarAparicionesRecurrencia(una.reglas, fechaLocal("2026-10-19"), fechaLocal("2026-10-19")).length, 0)
    const siguientes = eliminarRecurrencia([regla], regla.id, "2026-10-19", "siguientes")
    assert.deepEqual(generarAparicionesRecurrencia(siguientes.reglas, fechaLocal("2026-10-12"), fechaLocal("2026-11-02")).map(plan => plan.fechaRecurrencia), ["2026-10-12"])
    assert.equal(eliminarRecurrencia([regla], regla.id, "2026-10-12", "toda").reglas.length, 0)
    const partida = cambiarRecurrencia([regla], regla.id, "2026-10-19", {
        nombre: "Continuación", evento: eventoLectura("Continuación"), inicio: new Date("2026-10-19T09:00:00"), fin: new Date("2026-10-19T10:00:00")
    }, "siguientes")
    assert.equal(eliminarRecurrencia(partida.reglas, partida.reglas[1].id, "2026-10-19", "toda").reglas.length, 0)
})

test("persiste las reglas semanales separadas de los planes", () => {
    const valores = new Map()
    const storage = { getItem: clave => valores.get(clave) ?? null, setItem: (clave, valor) => valores.set(clave, valor) }
    const regla = serie()
    assert.deepEqual(guardarRecurrencias([regla], storage), { ok: true })
    assert.equal(valores.has(CLAVE_RECURRENCIAS), true)
    assert.deepEqual(cargarRecurrencias(storage), { ok: true, reglas: [regla] })
})

test("asocia a una plantilla las recurrencias nuevas creadas desde sus planes", () => {
    const plan = { ...crearPlan({ evento: eventoLectura("Lectura"), inicio: new Date("2026-10-12T09:30:00"), fin: new Date("2026-10-12T10:00:00") }, () => "plan-x").plan, plantillaOrigenId: "plantilla-x", plantillaOrigenNombre: "Rutina" }
    const resultado = crearReglaRecurrencia(plan, [1], null, () => "serie-x")
    assert.equal(resultado.ok, true)
    assert.equal(resultado.regla.plantillaOrigenId, "plantilla-x")
    assert.equal(resultado.regla.plantillaOrigenNombre, "Rutina")
    assert.equal(validarColeccionRecurrencias([resultado.regla]), true)
    const aparicion = generarAparicionesRecurrencia([resultado.regla], fechaLocal("2026-10-12"), fechaLocal("2026-10-12"))[0]
    assert.equal(aparicion.plantillaOrigenNombre, "Rutina")
})

test("elimina todas las series vinculadas y las series antiguas que selecciona el usuario", () => {
    const vinculada = { ...serie({ dias: [1] }, "serie-vinculada"), plantillaOrigenId: "plantilla-x" }
    const antigua = serie({ dias: [3] }, "serie-legado")
    const separada = serie({ dias: [5] }, "serie-ajena")
    const resultado = eliminarRecurrenciasDePlantilla([vinculada, antigua, separada], "plantilla-x", "todas", {
        ahora: new Date("2026-10-12T08:00:00"),
        idsLegado: [antigua.id]
    })
    assert.equal(resultado.ok, true)
    assert.equal(resultado.seriesEliminadas, 2)
    assert.deepEqual(resultado.reglas, [separada])
})

test("el borrado futuro recorta series conservando sus apariciones anteriores y las reglas no seleccionadas", () => {
    const vinculada = { ...serie({ dias: [1, 3] }), plantillaOrigenId: "plantilla-x" }
    const antigua = serie({ dias: [5] })
    const ahora = new Date("2026-10-13T12:00:00")
    const resultado = eliminarRecurrenciasDePlantilla([vinculada, antigua], "plantilla-x", "futuras", { ahora, plantillaOrigenNombre: "Rutina" })
    assert.equal(resultado.ok, true)
    assert.equal(resultado.seriesAfectadas.includes(vinculada.idSerie), true)
    const apariciones = generarAparicionesRecurrencia(resultado.reglas, fechaLocal("2026-10-12"), fechaLocal("2026-10-26"))
    assert.deepEqual(apariciones.filter(plan => plan.idSerie === vinculada.idSerie).map(plan => plan.fechaRecurrencia), ["2026-10-12"])
    assert.equal(resultado.reglas.find(regla => regla.idSerie === vinculada.idSerie).plantillaOrigenId, "plantilla-x")
    assert.equal(resultado.reglas.find(regla => regla.idSerie === vinculada.idSerie).plantillaOrigenNombre, "Rutina")
    assert.equal(resultado.reglas.some(regla => regla.idSerie === antigua.idSerie), true)
})

test("el borrado futuro de recurrencias usa la hora actual y conserva una excepción histórica movida", () => {
    const regla = serie({ dias: [1], inicio: "2026-10-19T09:00:00" })
    const excepcionPasada = {
        id: "excepcion-pasada", nombre: "Lectura adelantada", eventoId: "evento-lectura", colorEvento: regla.colorEvento,
        inicio: "2026-10-19T08:00:00.000", fin: "2026-10-19T08:30:00.000"
    }
    const reglaConExcepcion = { ...regla, plantillaOrigenId: "plantilla-x", excepciones: { "2026-10-19": excepcionPasada } }
    const ahora = new Date("2026-10-19T08:45:00")
    const resultado = eliminarRecurrenciasDePlantilla([reglaConExcepcion], "plantilla-x", "futuras", { ahora })
    const apariciones = generarAparicionesRecurrencia(resultado.reglas, fechaLocal("2026-10-19"), fechaLocal("2026-10-26"))
    assert.equal(apariciones.some(plan => plan.id === "excepcion-pasada"), true)
    assert.equal(apariciones.some(plan => plan.fechaRecurrencia === "2026-10-19" && plan.id !== "excepcion-pasada"), false)
    assert.equal(apariciones.some(plan => plan.fechaRecurrencia === "2026-10-26"), false)
})
