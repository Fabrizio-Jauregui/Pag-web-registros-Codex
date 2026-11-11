import { expect, test } from "@playwright/test"
import { crearEventoParaPrueba, crearTareaParaPrueba } from "./ayuda-origenes-planificacion.js"

const CLAVE_PLANTILLAS = "focus.plantillas-planes.v1"
const CLAVE_PLANES = "focus.planes.v1"

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
