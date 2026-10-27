import { expect, test } from "@playwright/test"

test("Flujo de usuario: mantiene la navegación estable en todas las secciones y tamaños", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto("/")

    const calendario = page.getByRole("region", { name: "Calendario" })
    const herramientas = page.getByRole("complementary", { name: "Panel de herramientas" })
    const navegacion = page.getByRole("navigation", { name: "Secciones de Focus" })
    const secciones = ["Calendario", "Focus", "Historial", "Eventos", "Planificaciones", "Analítica", "Tareas"]
    await expect(calendario).toBeVisible()
    await expect(herramientas).toBeVisible()
    await expect(navegacion).toBeVisible()
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

    async function verificarNavegacionEstable() {
        const rectanguloInicial = await navegacion.evaluate(elemento => {
            const { x, y, width, height } = elemento.getBoundingClientRect()
            return { x, y, width, height }
        })
        const medidasBotones = await navegacion.getByRole("button").evaluateAll(botones =>
            botones.map(boton => {
                const { width, height } = boton.getBoundingClientRect()
                return { width, height }
            })
        )
        expect(medidasBotones).toHaveLength(secciones.length)
        expect(new Set(medidasBotones.map(medida => medida.height)).size).toBe(1)

        const botonEventos = navegacion.getByRole("button", { name: "Eventos", exact: true })
        await botonEventos.focus()
        await page.keyboard.press("Enter")
        await expect(botonEventos).toHaveAttribute("aria-pressed", "true")
        await expect(botonEventos).toHaveCSS("outline-style", "solid")

        for (const nombre of secciones) {
            const boton = navegacion.getByRole("button", { name: nombre, exact: true })
            await boton.click()
            await expect(boton).toHaveAttribute("aria-pressed", "true")
            await expect(navegacion).toHaveJSProperty("hidden", false)
            await expect(navegacion).toHaveAttribute("aria-label", "Secciones de Focus")
            const rectanguloActual = await navegacion.evaluate(elemento => {
                const { x, y, width, height } = elemento.getBoundingClientRect()
                return { x, y, width, height }
            })
            expect(rectanguloActual).toEqual(rectanguloInicial)
        }
    }

    await verificarNavegacionEstable()

    await page.setViewportSize({ width: 390, height: 844 })
    await verificarNavegacionEstable()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})
