import { expect, test } from "@playwright/test"

const eventos = [
    { id: "evento-a", nombre: "Evento A", color: "#4F46E5" },
    { id: "evento-b", nombre: "Evento B", color: "#0F766E" },
    { id: "evento-c", nombre: "Evento C", color: "#C2410C" }
]

const plantillas = [
    {
        id: "plantilla-cronometro",
        nombre: "Prueba cronómetro",
        modo: "cronometro",
        actividades: [
            { id: "crono-a", nombre: "Evento A", eventoId: "evento-a", grupoCronometro: 0, ordenSecuencia: 0 },
            { id: "crono-b", nombre: "Evento B", eventoId: "evento-b", grupoCronometro: 1, ordenSecuencia: 1 },
            { id: "crono-c", nombre: "Evento C", eventoId: "evento-c", grupoCronometro: 1, ordenSecuencia: 1 }
        ]
    },
    {
        id: "plantilla-duracion",
        nombre: "Prueba por duración",
        modo: "duraciones",
        actividades: [
            { id: "duracion-a", nombre: "Evento A", eventoId: "evento-a", duracionSegundos: 1800 },
            { id: "duracion-b", nombre: "Evento B", eventoId: "evento-b", duracionSegundos: 1200 }
        ]
    },
    {
        id: "plantilla-horarios",
        nombre: "Prueba horarios",
        modo: "horarios",
        actividades: [
            { id: "horario-a", nombre: "Evento A", eventoId: "evento-a", inicioSegundos: 9 * 3600, finSegundos: 9 * 3600 + 1800, finDia: 0 },
            { id: "horario-b", nombre: "Evento B", eventoId: "evento-b", inicioSegundos: 10 * 3600, finSegundos: 10 * 3600 + 1800, finDia: 0 }
        ]
    }
]

async function abrirBiblioteca(page, viewport = { width: 1280, height: 900 }) {
    await page.setViewportSize(viewport)
    await page.addInitScript(({ eventosGuardados, plantillasGuardadas }) => {
        localStorage.setItem("focus.plantillas-eventos.v1", JSON.stringify(eventosGuardados))
        localStorage.setItem("focus.plantillas-planes.v1", JSON.stringify(plantillasGuardadas))
    }, { eventosGuardados: eventos, plantillasGuardadas: plantillas })
    await page.goto("/")
    await page.getByRole("button", { name: "Planificaciones", exact: true }).click()
    await page.getByLabel("Aplicar a la fecha").fill("2027-01-15")
}

function tarjeta(page, nombre) {
    return page.locator(".lista-plantillas-plan > li").filter({ hasText: nombre })
}

test("guarda, vuelve a mostrar y aplica el nuevo orden de etapas con cronómetro", async ({ page }) => {
    await abrirBiblioteca(page)
    const rutina = tarjeta(page, "Prueba cronómetro")

    await rutina.getByRole("button", { name: "Editar secuencia" }).click()
    const editor = page.locator(".editor-plantilla-cronometro")
    await editor.getByRole("button", { name: "Bajar etapa" }).first().click()
    await editor.getByRole("button", { name: "Guardar plantilla" }).click()

    await expect(rutina.locator(".plantilla-plan-resumen ul li").nth(0)).toContainText("Evento B · Etapa 1")
    await expect(rutina.locator(".plantilla-plan-resumen ul li").nth(1)).toContainText("Evento C · Etapa 1")
    await expect(rutina.locator(".plantilla-plan-resumen ul li").nth(2)).toContainText("Evento A · Etapa 2")
    await expect(rutina.locator(".plantilla-plan-previsualizacion li strong").nth(0)).toHaveText("Evento B")
    await expect(rutina.locator(".plantilla-plan-previsualizacion li strong").nth(1)).toHaveText("Evento C")
    await expect(rutina.locator(".plantilla-plan-previsualizacion li strong").nth(2)).toHaveText("Evento A")

    await rutina.getByRole("button", { name: "Editar secuencia" }).click()
    const etapas = page.locator(".editor-plantilla-cronometro .editor-secuencia")
    await expect(etapas.nth(0)).toContainText("Evento B")
    await expect(etapas.nth(0)).toContainText("Evento C")
    await expect(etapas.nth(1)).toContainText("Evento A")
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("guarda y presenta el orden editado de una secuencia por duración", async ({ page }) => {
    await abrirBiblioteca(page, { width: 390, height: 844 })
    const rutina = tarjeta(page, "Prueba por duración")

    await rutina.getByRole("button", { name: "Editar secuencia" }).click()
    const editor = page.locator(".editor-plantilla-calendario")
    await editor.getByRole("button", { name: "Subir", exact: true }).last().click()
    await editor.getByRole("button", { name: "Guardar plantilla" }).click()

    await expect(rutina.locator(".plantilla-plan-resumen ul li").nth(0)).toContainText("Evento B")
    await expect(rutina.locator(".plantilla-plan-resumen ul li").nth(1)).toContainText("Evento A")
    await expect(rutina.locator(".plantilla-plan-previsualizacion li strong").nth(0)).toHaveText("Evento B")
    await expect(rutina.locator(".plantilla-plan-previsualizacion li strong").nth(1)).toHaveText("Evento A")

    await rutina.getByRole("button", { name: "Editar secuencia" }).click()
    const actividades = page.locator(".editor-plantilla-calendario .editor-secuencia").first().locator("fieldset")
    await expect(actividades.nth(0)).toContainText("Evento B")
    await expect(actividades.nth(1)).toContainText("Evento A")
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("ordena el resumen y la vista previa de horarios por su hora al editar", async ({ page }) => {
    await abrirBiblioteca(page)
    const rutina = tarjeta(page, "Prueba horarios")

    await rutina.getByRole("button", { name: "Editar horarios" }).click()
    await page.getByLabel("Inicio actividad 1").fill("11:00:00")
    await page.getByLabel("Fin actividad 1").fill("11:30:00")
    await page.getByLabel("Inicio actividad 2").fill("08:00:00")
    await page.getByRole("button", { name: "Guardar cambios" }).click()

    await expect(rutina.locator(".plantilla-plan-resumen ul li").nth(0)).toContainText("Evento B")
    await expect(rutina.locator(".plantilla-plan-resumen ul li").nth(1)).toContainText("Evento A")
    await expect(rutina.locator(".plantilla-plan-previsualizacion li strong").nth(0)).toHaveText("Evento B")
    await expect(rutina.locator(".plantilla-plan-previsualizacion li strong").nth(1)).toHaveText("Evento A")
    await rutina.getByRole("button", { name: "Editar horarios" }).click()
    await expect(page.getByLabel("Inicio actividad 1")).toHaveValue("11:00:00")
    await expect(page.getByLabel("Inicio actividad 2")).toHaveValue("08:00:00")
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
