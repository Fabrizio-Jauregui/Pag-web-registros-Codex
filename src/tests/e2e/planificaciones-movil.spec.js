import { expect, test } from "@playwright/test"
import { crearEventoParaPrueba, crearTareaParaPrueba } from "./ayuda-origenes-planificacion.js"

const CLAVE_PLANTILLAS = "focus.plantillas-planes.v1"
const CLAVE_PLANES = "focus.planes.v1"
const CLAVE_REGISTROS = "focus.registros.v1"
const CLAVE_SEGUIMIENTO = "focus.seguimiento-planificacion.v1"

function fechaFutura() {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + 2)
    const pad = numero => String(numero).padStart(2, "0")
    return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`
}

test("en celular selecciona un evento y una tarea anidada y aplica una secuencia por duración", async ({ page }) => {
    const padre = await crearTareaParaPrueba(page, "Preparar examen")
    const tarea = await crearTareaParaPrueba(page, "Leer capítulo", padre.id)
    expect(tarea.padreId).toBe(padre.id)
    expect(tarea.objetivoId).toBeNull()
    await crearEventoParaPrueba(page, "Estudiar en biblioteca")

    await page.getByRole("button", { name: "Planificaciones", exact: true }).click()
    await page.getByRole("button", { name: /Secuencia por duración/ }).click()
    const editor = page.locator(".editor-plantilla-calendario")
    await editor.getByLabel("Nombre de la plantilla").fill("Estudio móvil")
    const actividades = editor.locator(".editor-plantilla-actividad")

    await actividades.nth(0).locator(".selector-origen-trigger").nth(0).click()
    const selectorEvento = page.getByRole("dialog", { name: "Elegí una plantilla de evento" })
    await expect(selectorEvento).toBeVisible()
    await selectorEvento.getByLabel("Buscar plantilla").fill("Estudiar en biblioteca")
    await selectorEvento.locator(".selector-origen-opcion").filter({ hasText: "Estudiar en biblioteca" }).click()
    await actividades.nth(0).getByLabel("Duración").fill("25")

    await actividades.nth(1).locator(".selector-origen-trigger").nth(1).click()
    const selectorTarea = page.getByRole("dialog", { name: "Elegí una tarea" })
    await selectorTarea.getByRole("button", { name: /Ver 1 subtareas de Preparar examen/ }).click()
    await selectorTarea.locator(".selector-origen-opcion").filter({ hasText: "Leer capítulo" }).click()
    await actividades.nth(1).getByLabel("Duración").fill("30")
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    await editor.getByRole("button", { name: "Guardar plantilla" }).click()
    await expect(page.getByRole("heading", { name: "Estudio móvil" })).toBeVisible()
    const fecha = fechaFutura()
    await page.getByLabel("Aplicar a la fecha").fill(fecha)
    await page.getByLabel("Hora real de inicio Estudio móvil").fill("09:00:00")
    await expect(page.locator(".plantilla-plan-previsualizacion")).toContainText("09:00:00–09:25:00")
    await expect(page.locator(".plantilla-plan-previsualizacion")).toContainText("09:25:00–09:55:00")
    await page.getByRole("button", { name: "Aplicar a fecha" }).click()

    const plantillas = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_PLANTILLAS)
    const planes = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_PLANES)
    expect(plantillas[0].actividades.map(item => item.nombre)).toEqual(["Estudiar en biblioteca", "Leer capítulo"])
    expect(planes.map(plan => [plan.eventoId, plan.tareaId])).toEqual([
        [plantillas[0].actividades[0].eventoId, undefined],
        [null, tarea.id]
    ])
    expect(planes.every(plan => plan.fechaAplicacion === fecha)).toBe(true)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("en celular finaliza y deshace eventos paralelos desde Actividades activas; recupera si el seguimiento es inválido", async ({ page }) => {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + 2)
    fecha.setHours(8, 0, 0, 0)
    const dia = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`
    const hora = (h, m) => `${dia}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`

    await page.clock.install({ time: fecha })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(dia)
    for (const nombre of ["Evento móvil A", "Evento móvil B"]) {
        await page.getByRole("button", { name: "Planificar actividad", exact: true }).click()
        const formulario = page.getByRole("form", { name: "Planificar actividad" })
        await formulario.getByLabel("Actividad puntual").check()
        await formulario.getByLabel("Nombre de la actividad").fill(nombre)
        await formulario.getByRole("textbox", { name: "Inicio", exact: true }).fill(hora(9, 0))
        await formulario.getByLabel("Fin", { exact: true }).fill(hora(9, 30))
        await formulario.getByRole("button", { name: "Guardar plan" }).click()
    }

    const planA = page.getByRole("button", { name: /Planificado: Evento móvil A/ })
    if (await planA.count()) await planA.click()
    else {
        await page.getByRole("button", { name: /Ver 2 actividades cercanas/ }).click()
        await page.getByRole("dialog").getByRole("button").filter({ hasText: "Evento móvil A" }).click()
    }
    const detalle = page.getByRole("region", { name: "Plan: Evento móvil A" })
    await detalle.getByRole("button", { name: "Seguir planificación" }).click()
    await detalle.getByRole("button", { name: "Desde este evento" }).click()
    await page.clock.fastForward(1500)

    const tarjetaA = page.getByRole("article", { name: "Actividad activa: Evento móvil A" })
    await tarjetaA.getByRole("button", { name: "Finalizar" }).click()
    let registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS)
    const planIdA = (await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_PLANES))
        .find(plan => plan.nombre === "Evento móvil A").id
    expect(registros.find(registro => registro.planId === planIdA).estado).toBe("Finalizado")
    await page.getByRole("region", { name: "Finalizaciones que podés deshacer" })
        .getByRole("button", { name: "Deshacer", exact: true }).click()
    registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS)
    expect(registros.find(registro => registro.planId === planIdA).estado).toBe("En curso")

    await page.evaluate(clave => localStorage.setItem(clave, JSON.stringify({ estado: "inválido" })), CLAVE_SEGUIMIENTO)
    await page.reload()
    await expect(page.getByRole("alert").filter({ hasText: "El seguimiento guardado tiene datos inválidos" })).toBeVisible()
    const tarjetaTrasCarga = page.getByRole("article", { name: "Actividad activa: Evento móvil A" })
    await page.evaluate(claveObjetivo => {
        const quitarOriginal = Storage.prototype.removeItem
        window.__bloquearLimpiezaSeguimiento = true
        Storage.prototype.removeItem = function (clave) {
            if (clave === claveObjetivo && window.__bloquearLimpiezaSeguimiento) throw new Error("Fallo de escritura simulado")
            return quitarOriginal.call(this, clave)
        }
    }, CLAVE_SEGUIMIENTO)
    await tarjetaTrasCarga.getByRole("button", { name: "Finalizar" }).click()
    await expect(page.getByRole("alert").filter({ hasText: "No se pudo limpiar el seguimiento inválido" })).toBeVisible()
    registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS)
    expect(registros.find(registro => registro.planId === planIdA).estado).toBe("En curso")

    await page.evaluate(() => { window.__bloquearLimpiezaSeguimiento = false })
    await tarjetaTrasCarga.getByRole("button", { name: "Finalizar" }).click()
    await expect(page.getByRole("alert").filter({ hasText: "El seguimiento guardado tiene datos inválidos" })).toHaveCount(0)
    expect(await page.evaluate(clave => localStorage.getItem(clave), CLAVE_SEGUIMIENTO)).toBeNull()
    registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS)
    expect(registros.find(registro => registro.planId === planIdA).estado).toBe("Finalizado")
    const planIdB = (await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_PLANES))
        .find(plan => plan.nombre === "Evento móvil B").id
    expect(registros.find(registro => registro.planId === planIdB).estado).toBe("En curso")
    expect(await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)).length, CLAVE_PLANES)).toBe(2)
})
