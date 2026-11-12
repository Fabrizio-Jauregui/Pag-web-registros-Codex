import { expect, test } from "@playwright/test"
import { crearEventoParaPrueba, seleccionarOrigenEnActividad } from "./ayuda-origenes-planificacion.js"
import { validarEstadoSeguimiento } from "../../domain/planificacion/seguimientoPlanificacion.js"

const clave = "focus.recurrencias.v1"
const clavePlanes = "focus.planes.v1"
const claveRegistros = "focus.registros.v1"
const claveSeguimiento = "focus.seguimiento-planificacion.v1"
const pad = valor => String(valor).padStart(2, "0")
const fechaISO = fecha => `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`
const fechaHoraISO = fecha => `${fechaISO(fecha)}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`

async function abrirPlan(page, nombre) {
    const bloque = page.getByRole("button", { name: new RegExp(`Planificado: ${nombre}`) })
    if (await bloque.count()) {
        await bloque.click()
        return
    }
    await page.getByRole("button", { name: /Ver \d+ actividad(?:es)? cercana(?:s)?/ }).first().click()
    await page.getByRole("dialog").getByRole("button").filter({ hasText: nombre }).click()
}

test("Flujo de usuario: crea una serie semanal, la muestra en la semana siguiente y edita una aparición aislada", async ({ page }) => {
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - 14)
    inicio.setHours(9, 0, 0, 0)
    const siguiente = new Date(inicio)
    siguiente.setDate(siguiente.getDate() + 7)
    const fin = new Date(inicio.getTime() + 30 * 60_000)

    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))
    await crearEventoParaPrueba(page, "Caminata semanal")
    await page.getByRole("button", { name: "Calendario", exact: true }).click()
    await page.getByRole("button", { name: "Planificar actividad", exact: true }).click()
    const formulario = page.getByRole("form", { name: "Planificar actividad" })
    await seleccionarOrigenEnActividad(page, formulario, "evento", "Caminata semanal")
    await formulario.getByRole("textbox", { name: "Inicio", exact: true }).fill(fechaHoraISO(inicio))
    await formulario.getByLabel("Fin", { exact: true }).fill(fechaHoraISO(fin))
    await formulario.getByLabel("Repetir semanalmente").check()
    await formulario.getByLabel(["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][inicio.getDay()]).check()
    await formulario.getByRole("button", { name: "Guardar plan" }).click()

    let reglas = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), clave)
    expect(reglas).toHaveLength(1)
    expect(reglas[0].diasSemana).toEqual([inicio.getDay()])
    expect(await page.evaluate(() => localStorage.getItem("focus.planes.v1"))).toBeNull()
    await page.reload()
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))
    await abrirPlan(page, "Caminata semanal")

    await page.getByLabel("Ir a fecha").fill(fechaISO(siguiente))
    await abrirPlan(page, "Caminata semanal")
    const detalle = page.getByRole("region", { name: "Plan: Caminata semanal" })
    await detalle.getByRole("button", { name: "Editar plan" }).click()
    const edicion = page.getByRole("form", { name: "Editar actividad planificada" })
    await edicion.getByRole("combobox", { name: "Aplicar cambios a" }).selectOption("solo")
    const inicioExcepcion = new Date(siguiente.getTime() + 10 * 60_000)
    await edicion.getByRole("textbox", { name: "Inicio", exact: true }).fill(fechaHoraISO(inicioExcepcion))
    await edicion.getByRole("button", { name: "Guardar cambios" }).click()
    await abrirPlan(page, "Caminata semanal")

    reglas = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), clave)
    expect(reglas[0].excepciones[fechaISO(siguiente)].inicio).toBe(inicioExcepcion.toISOString())
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))
    await abrirPlan(page, "Caminata semanal")

    await page.getByLabel("Ir a fecha").fill(fechaISO(siguiente))
    await abrirPlan(page, "Caminata semanal")
    const detalleSiguiente = page.getByRole("region", { name: "Plan: Caminata semanal" })
    await detalleSiguiente.getByLabel("Eliminar").selectOption("siguientes")
    page.once("dialog", dialog => dialog.accept())
    await detalleSiguiente.getByRole("button", { name: "Eliminar selección" }).click()
    await expect(page.getByRole("button", { name: /Planificado: Caminata extendida/ })).toHaveCount(0)
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))
    await abrirPlan(page, "Caminata semanal")
    const detalleInicial = page.getByRole("region", { name: "Plan: Caminata semanal" })
    await detalleInicial.getByLabel("Eliminar").selectOption("toda")
    page.once("dialog", dialog => dialog.accept())
    await detalleInicial.getByRole("button", { name: "Eliminar selección" }).click()
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), clave)).toEqual([])
})

test("Flujo de usuario: edita toda una serie del jueves e inicia su aparición sin activar el plan de las 18", async ({ page }) => {
    const jueves = new Date()
    jueves.setDate(jueves.getDate() + (4 - jueves.getDay() + 7) % 7)
    jueves.setHours(9, 0, 0, 0)
    const hasta = new Date(jueves)
    hasta.setDate(hasta.getDate() + 14)
    const inicio = new Date(jueves)
    inicio.setHours(10, 15, 0, 0)
    const finOriginal = new Date(inicio.getTime() + 60 * 60_000)
    const finEditado = new Date(inicio.getTime() + 90 * 60_000)

    await page.clock.install({ time: jueves })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fechaISO(jueves))
    await crearEventoParaPrueba(page, "Caminata semanal")
    await page.getByRole("button", { name: "Calendario", exact: true }).click()

    await page.getByRole("button", { name: "Planificar actividad", exact: true }).click()
    const formularioSerie = page.getByRole("form", { name: "Planificar actividad" })
    await seleccionarOrigenEnActividad(page, formularioSerie, "evento", "Caminata semanal")
    await formularioSerie.getByRole("textbox", { name: "Inicio", exact: true }).fill(fechaHoraISO(inicio))
    await formularioSerie.getByLabel("Fin", { exact: true }).fill(fechaHoraISO(finOriginal))
    await formularioSerie.getByLabel("Repetir semanalmente").check()
    await formularioSerie.getByLabel("Jueves").check()
    await formularioSerie.getByLabel("Hasta (opcional)").fill(fechaISO(hasta))
    await formularioSerie.getByRole("button", { name: "Guardar plan" }).click()

    await page.getByRole("button", { name: "Planificar actividad", exact: true }).click()
    const formularioIndependiente = page.getByRole("form", { name: "Planificar actividad" })
    await formularioIndependiente.getByLabel("Actividad puntual").check()
    await formularioIndependiente.getByLabel("Nombre de la actividad").fill("Plan independiente de las 18")
    const inicioIndependiente = new Date(jueves)
    inicioIndependiente.setHours(18, 0, 0, 0)
    const finIndependiente = new Date(inicioIndependiente.getTime() + 30 * 60_000)
    await formularioIndependiente.getByRole("textbox", { name: "Inicio", exact: true }).fill(fechaHoraISO(inicioIndependiente))
    await formularioIndependiente.getByLabel("Fin", { exact: true }).fill(fechaHoraISO(finIndependiente))
    await formularioIndependiente.getByRole("button", { name: "Guardar plan" }).click()

    await abrirPlan(page, "Caminata semanal")
    const detalle = page.getByRole("region", { name: "Plan: Caminata semanal" })
    await detalle.getByRole("button", { name: "Editar plan" }).click()
    const edicion = page.getByRole("form", { name: "Editar actividad planificada" })
    await edicion.getByRole("combobox", { name: "Aplicar cambios a" }).selectOption("toda")
    await edicion.getByLabel("Fin", { exact: true }).fill(fechaHoraISO(finEditado))
    await edicion.getByRole("button", { name: "Guardar cambios" }).click()

    const reglas = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), clave)
    expect(reglas).toHaveLength(1)
    expect(reglas[0].duracionMs).toBe(90 * 60_000)
    let planes = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), clavePlanes)
    const planIndependiente = planes.find(plan => plan.nombre === "Plan independiente de las 18")
    expect(planIndependiente).toBeTruthy()

    await abrirPlan(page, "Caminata semanal")
    const detalleEditado = page.getByRole("region", { name: "Plan: Caminata semanal" })
    await detalleEditado.getByRole("button", { name: "Seguir planificación" }).click()
    await detalleEditado.getByRole("button", { name: "Desde este evento" }).click()

    const panel = page.getByRole("region", { name: "Siguiendo la planificación" })
    await expect(panel).toBeVisible()
    const seguimiento = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), claveSeguimiento)
    expect(validarEstadoSeguimiento(seguimiento)).toBe(true)
    expect(seguimiento.secuencia.map(item => item.planId)).toContain(planIndependiente.id)
    const registros = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), claveRegistros)
    const activos = registros.filter(registro => ["En curso", "Pausado"].includes(registro.estado))
    expect(activos.map(registro => registro.planId)).toEqual(seguimiento.registrosActivos.map(item => item.planId))
    expect(activos.some(registro => registro.planId === planIndependiente.id)).toBe(false)
})

test("si no puede guardar el seguimiento tras una recurrencia, revierte el registro y permite reintentar", async ({ page }) => {
    const jueves = new Date()
    jueves.setDate(jueves.getDate() + (4 - jueves.getDay() + 7) % 7)
    jueves.setHours(9, 0, 0, 0)
    const hasta = new Date(jueves)
    hasta.setDate(hasta.getDate() + 14)
    const inicio = new Date(jueves)
    inicio.setHours(10, 15, 0, 0)
    const fin = new Date(inicio.getTime() + 30 * 60_000)

    await page.clock.install({ time: jueves })
    await page.addInitScript(claveObjetivo => {
        const setItemOriginal = Storage.prototype.setItem
        window.__fallarGuardadoSeguimiento = true
        Storage.prototype.setItem = function (claveStorage, valor) {
            if (claveStorage === claveObjetivo && window.__fallarGuardadoSeguimiento) {
                throw new Error("Fallo de almacenamiento de prueba")
            }
            return setItemOriginal.call(this, claveStorage, valor)
        }
    }, claveSeguimiento)
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fechaISO(jueves))
    await crearEventoParaPrueba(page, "Caminata semanal")
    await page.getByRole("button", { name: "Calendario", exact: true }).click()
    await page.getByRole("button", { name: "Planificar actividad", exact: true }).click()
    const formulario = page.getByRole("form", { name: "Planificar actividad" })
    await seleccionarOrigenEnActividad(page, formulario, "evento", "Caminata semanal")
    await formulario.getByRole("textbox", { name: "Inicio", exact: true }).fill(fechaHoraISO(inicio))
    await formulario.getByLabel("Fin", { exact: true }).fill(fechaHoraISO(fin))
    await formulario.getByLabel("Repetir semanalmente").check()
    await formulario.getByLabel("Jueves").check()
    await formulario.getByLabel("Hasta (opcional)").fill(fechaISO(hasta))
    await formulario.getByRole("button", { name: "Guardar plan" }).click()

    await abrirPlan(page, "Caminata semanal")
    const detalle = page.getByRole("region", { name: "Plan: Caminata semanal" })
    await detalle.getByRole("button", { name: "Seguir planificación" }).click()
    await detalle.getByRole("button", { name: "Desde este evento" }).click()
    await expect(detalle.getByRole("alert")).toContainText("No se pudo guardar el seguimiento")
    await expect(page.getByRole("region", { name: "Siguiendo la planificación" })).toHaveCount(0)

    let registros = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), claveRegistros)
    expect(registros ?? []).toEqual([])
    expect(await page.evaluate(key => localStorage.getItem(key), claveSeguimiento)).toBeNull()

    await page.evaluate(() => { window.__fallarGuardadoSeguimiento = false })
    await detalle.getByRole("button", { name: "Desde este evento" }).click()
    const panel = page.getByRole("region", { name: "Siguiendo la planificación" })
    await expect(panel).toBeVisible()
    const seguimiento = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), claveSeguimiento)
    expect(validarEstadoSeguimiento(seguimiento)).toBe(true)
    registros = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), claveRegistros)
    expect(registros).toHaveLength(1)
    expect(registros[0].estado).toBe("En curso")
})
