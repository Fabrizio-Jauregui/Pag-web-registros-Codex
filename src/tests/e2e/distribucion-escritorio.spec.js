import { expect, test } from "@playwright/test"

test("Flujo de usuario: mantiene el calendario amplio y las herramientas a la derecha", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto("/")

    const calendario = page.getByRole("region", { name: "Calendario" })
    const herramientas = page.getByRole("complementary", { name: "Panel de herramientas" })
    await expect(calendario).toBeVisible()
    await expect(herramientas).toBeVisible()
    await expect(herramientas.getByRole("button", { name: "Nuevo registro", exact: true })).toBeVisible()
    await expect(herramientas.getByRole("button", { name: "Planificar actividad", exact: true })).toBeVisible()

    const medidas = await page.evaluate(() => {
        const calendarioRect = document.querySelector(".calendario-panel").getBoundingClientRect()
        const herramientasRect = document.querySelector(".panel-herramientas").getBoundingClientRect()
        return {
            calendarioIzquierda: calendarioRect.left,
            herramientasIzquierda: herramientasRect.left,
            calendarioAncho: calendarioRect.width,
            herramientasAncho: herramientasRect.width,
            desbordeHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth
        }
    })
    expect(medidas.calendarioIzquierda).toBeLessThan(medidas.herramientasIzquierda)
    expect(medidas.calendarioAncho).toBeGreaterThan(medidas.herramientasAncho * 1.5)
    expect(medidas.desbordeHorizontal).toBe(false)

    await herramientas.getByRole("button", { name: "Eventos", exact: true }).click()
    await expect(calendario).toBeVisible()
    await expect(page.getByRole("region", { name: "Eventos" })).toBeVisible()
    await herramientas.getByRole("button", { name: "Planificaciones", exact: true }).click()
    await expect(calendario).toBeHidden()
    await expect(page.getByRole("region", { name: "Plantillas de planificación" })).toBeVisible()
})
