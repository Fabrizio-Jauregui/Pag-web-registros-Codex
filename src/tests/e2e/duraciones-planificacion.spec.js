import { expect, test } from "@playwright/test"

const CLAVE_PLANTILLAS_PLAN = "focus.plantillas-planes.v1"
const CLAVE_PLANES = "focus.planes.v1"

function fechaFutura(dias = 2) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + dias)
    const dos = valor => String(valor).padStart(2, "0")
    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`
}

async function abrirPlanificaciones(page) {
    await page.goto("/")
    await page.getByRole("button", { name: "Planificaciones", exact: true }).click()
}

test("secuencia por duración acepta minutos simples, unidades y el formato anterior, incluidos paralelos", async ({ page }) => {
    await abrirPlanificaciones(page)
    await page.getByRole("button", { name: /Secuencia por duración/ }).click()
    const editor = page.locator(".editor-plantilla-calendario")
    await editor.getByLabel("Nombre de la plantilla").fill("Rutina flexible")

    let actividades = editor.locator(".editor-plantilla-actividad")
    await actividades.nth(0).getByLabel("Nombre").fill("Preparar desayuno")
    await actividades.nth(0).getByLabel("Duración").fill("30")
    await actividades.nth(1).getByLabel("Nombre").fill("Desayunar")
    await actividades.nth(1).getByLabel("Duración").fill("1h 15m")
    await actividades.nth(1).click()
    await editor.getByRole("button", { name: "Agregar en paralelo a la actividad seleccionada" }).click()

    actividades = editor.locator(".editor-plantilla-actividad")
    await actividades.nth(2).getByLabel("Nombre").fill("Ver un video")
    await actividades.nth(2).getByLabel("Duración").fill("00:02:30")
    await editor.getByLabel("Relación con Desayunar").selectOption("despues")
    await editor.getByLabel("Desplazamiento respecto de Desayunar").fill("10")
    await expect(actividades.nth(2)).toContainText("Empieza en +00:40:00")
    await editor.getByRole("button", { name: "Guardar plantilla" }).click()

    const plantillas = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_PLANTILLAS_PLAN)
    expect(plantillas[0].modo).toBe("secuencias")
    expect(plantillas[0].actividades.map(item => item.duracionSegundos)).toEqual([1800, 4500, 150])
    expect(plantillas[0].actividades[2].desplazamientoAnclaSegundos).toBe(600)

    await page.getByLabel("Aplicar a la fecha").fill(fechaFutura())
    await page.getByLabel("Hora real de inicio Rutina flexible").fill("09:00:00")
    const preview = page.locator(".plantilla-plan-previsualizacion")
    await expect(preview).toContainText("09:00:00–09:30:00")
    await expect(preview).toContainText("09:30:00–10:45:00")
    await expect(preview).toContainText("09:40:00–09:42:30")
    await page.getByRole("button", { name: "Aplicar a fecha" }).click()
    const planes = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_PLANES)
    expect(planes).toHaveLength(3)
    expect(planes.map(plan => (Date.parse(plan.fin) - Date.parse(plan.inicio)) / 1000)).toEqual([1800, 4500, 150])
})

test("horarios definidos y secuencia con cronómetro mantienen sus entradas propias", async ({ page }) => {
    await abrirPlanificaciones(page)
    await page.getByRole("button", { name: /Horarios definidos/ }).click()
    const formulario = page.getByRole("form", { name: "Nueva plantilla de planificación" })
    await formulario.getByLabel("Nombre de la plantilla").fill("Rutina con horarios")
    await formulario.getByLabel("Nombre de actividad 1").fill("Preparar")
    await formulario.getByLabel("Inicio actividad 1").fill("09:00:00")
    await formulario.getByLabel("Fin actividad 1").fill("09:30:00")
    await formulario.getByLabel("Nombre de actividad 2").fill("Desayunar")
    await formulario.getByLabel("Inicio actividad 2").fill("09:30:00")
    await formulario.getByLabel("Fin actividad 2").fill("10:00:00")
    await formulario.getByRole("button", { name: "Guardar plantilla" }).click()

    await page.getByRole("button", { name: /Secuencia con cronómetro/ }).click()
    const editor = page.locator(".editor-plantilla-cronometro")
    await editor.getByLabel("Nombre de la plantilla").fill("Rutina con cronómetro")
    const eventos = editor.locator(".editor-plantilla-actividad")
    await eventos.nth(0).getByLabel("Nombre").fill("Cocinar")
    await eventos.nth(1).getByLabel("Nombre").fill("Servir")
    await expect(editor.getByLabel("Duración")).toHaveCount(0)
    await editor.getByRole("button", { name: "Guardar plantilla" }).click()

    const plantillas = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_PLANTILLAS_PLAN)
    expect(plantillas.map(item => item.modo)).toEqual(["horarios", "cronometro"])
    expect(plantillas[0].actividades.map(item => item.finSegundos - item.inicioSegundos)).toEqual([1800, 1800])
    expect(plantillas[1].actividades.every(item => !("duracionSegundos" in item))).toBe(true)
})

test("la duración Focus planificada sigue usando minutos y se calcula desde su plantilla", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Focus", exact: true }).click()
    await page.getByLabel("Pares de bloques").selectOption("1")
    await page.getByLabel("Concentración inicial (min)").fill("15")
    await page.getByLabel("Descanso inicial (min)").fill("5")
    await page.getByRole("button", { name: "Generar bloques" }).click()
    await page.getByRole("button", { name: "Confirmar bloques" }).click()
    await page.getByLabel("Nombre para guardar plantilla").fill("Focus breve")
    await page.getByRole("button", { name: "Guardar plantilla" }).click()

    await page.getByRole("button", { name: "Planificaciones", exact: true }).click()
    await page.getByRole("button", { name: /Horarios definidos/ }).click()
    const formulario = page.getByRole("form", { name: "Nueva plantilla de planificación" })
    await formulario.getByLabel("Nombre de la plantilla").fill("Trabajo Focus")
    await formulario.getByLabel("Tipo de actividad 1").selectOption("focus")
    await formulario.getByLabel("Plantilla Focus 1").selectOption({ index: 1 })
    await expect(formulario.getByText(/Duración reservada: 00:20:00/)).toBeVisible()
    await formulario.getByLabel("Nombre de actividad 2").fill("Descanso")
    await formulario.getByRole("button", { name: "Guardar plantilla" }).click()

    const plantillas = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_PLANTILLAS_PLAN)
    expect(plantillas[0].actividades[0].configuracionFocus.bloques.map(bloque => bloque.minutos)).toEqual([15, 5])
    expect(plantillas[0].actividades[0].finDia * 86400 + plantillas[0].actividades[0].finSegundos - plantillas[0].actividades[0].inicioSegundos).toBe(1200)
})
