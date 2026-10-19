import { expect, test } from "@playwright/test"

const claveRegistros = "focus.registros.v1"
const claveEventos = "focus.plantillas-eventos.v1"

function fechaAyer(hora, minuto = 0) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - 1)
    fecha.setHours(hora, minuto, 0, 0)
    return fecha
}

function fechaISO(fecha) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`
}

test("Flujo de usuario: administra categorías, las asigna a eventos y consulta analítica agrupada y filtrada", async ({ page }) => {
    const eventos = [{ id: "correr", nombre: "Correr", color: "#2563EB" }]
    const registros = [{ id: "r1", nombre: "Correr", eventoId: "correr", colorEvento: "#2563EB", estado: "Finalizado", motivoCancelacion: null, segmentos: [
        { tipo: "En curso", inicio: fechaAyer(9).toISOString(), fin: fechaAyer(9, 30).toISOString() }
    ] }]
    await page.addInitScript(({ claveEventos, claveRegistros, eventos, registros }) => {
        localStorage.setItem(claveEventos, JSON.stringify(eventos))
        localStorage.setItem(claveRegistros, JSON.stringify(registros))
    }, { claveEventos, claveRegistros, eventos, registros })
    await page.goto("/")
    await page.getByRole("button", { name: "Eventos", exact: true }).click()

    const panelCategorias = page.getByRole("region", { name: "Categorías" })
    await panelCategorias.getByLabel("Nueva categoría").fill("Movimiento")
    await panelCategorias.getByRole("button", { name: "Crear categoría" }).click()
    await expect(panelCategorias.getByText("Movimiento")).toBeVisible()

    const bibliotecaEventos = page.getByRole("region", { name: "Eventos" })
    await bibliotecaEventos.getByRole("button", { name: "Editar" }).click()
    await bibliotecaEventos.getByLabel("Categoría").selectOption({ label: "Movimiento" })
    await bibliotecaEventos.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(bibliotecaEventos.getByText("Movimiento")).toBeVisible()

    await panelCategorias.getByRole("button", { name: "Editar" }).click()
    await panelCategorias.getByLabel("Editar categoría").fill("Actividad física")
    await panelCategorias.getByRole("button", { name: "Guardar", exact: true }).click()

    await page.getByRole("button", { name: "Analítica", exact: true }).click()
    const analitica = page.getByRole("region", { name: "Analítica" })
    await analitica.getByLabel("Elegir fecha").fill(fechaISO(fechaAyer(9)))
    await analitica.getByLabel("Mostrar tiempo por").selectOption("categoria")
    await expect(analitica.getByRole("list", { name: "Duración por categoría, de mayor a menor" })).toContainText("Actividad física")
    await expect(analitica.getByLabel("Tiempo registrado del período")).toContainText("00:30:00")
    await analitica.getByLabel("Filtrar categoría").selectOption({ label: "Sin categoría" })
    await expect(analitica.getByLabel("Tiempo registrado del período")).toContainText("00:00:00")
    await analitica.getByLabel("Filtrar categoría").selectOption({ label: "Actividad física" })
    await expect(analitica.getByLabel("Tiempo registrado del período")).toContainText("00:30:00")
    await analitica.getByRole("button", { name: "Semana", exact: true }).click()
    await expect(analitica.getByLabel("Tiempo registrado del período")).toContainText("00:30:00")

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole("button", { name: "Cambiar a tema claro" }).click()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    await page.getByRole("button", { name: "Eventos", exact: true }).click()
    page.once("dialog", dialog => dialog.accept())
    await panelCategorias.getByRole("button", { name: "Eliminar" }).click()
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key))[0].categoriaId ?? null, claveEventos)).toBeNull()
})
