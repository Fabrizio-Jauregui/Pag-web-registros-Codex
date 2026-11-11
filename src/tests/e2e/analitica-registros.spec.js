import { expect, test } from "@playwright/test"

const claveRegistros = "focus.registros.v1"
const claveEventos = "focus.plantillas-eventos.v1"
const claveCategorias = "focus.categorias.v1"

function fechaLocalISO(fecha) {
    const año = fecha.getFullYear()
    const mes = String(fecha.getMonth() + 1).padStart(2, "0")
    const dia = String(fecha.getDate()).padStart(2, "0")
    return `${año}-${mes}-${dia}`
}

function fechaAyer(hora, minuto = 0) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - 1)
    fecha.setHours(hora, minuto, 0, 0)
    return fecha
}

function registro(id, nombre, eventoId, inicio, fin, colorEvento = null) {
    return {
        id,
        nombre,
        eventoId,
        colorEvento,
        estado: "Finalizado",
        motivoCancelacion: null,
        segmentos: [{ tipo: "En curso", inicio: inicio.toISOString(), fin: fin.toISOString() }]
    }
}

test("Flujo de usuario: consulta totales diarios y semanales y distingue el tiempo simultáneo", async ({ page }) => {
    const eventos = [
        { id: "estudio", nombre: "Estudio", color: "#2563EB", categoriaIds: ["salud", "casa"] },
        { id: "trabajo", nombre: "Trabajo", color: "#0F766E", categoriaIds: ["salud"] }
    ]
    const categorias = [
        { id: "salud", nombre: "Salud" },
        { id: "casa", nombre: "Casa" }
    ]
    const registros = [
        registro("estudio-1", "Estudio", "estudio", fechaAyer(9), fechaAyer(10), "#2563EB"),
        registro("estudio-2", "Estudio", "estudio", fechaAyer(9, 30), fechaAyer(10, 30), "#2563EB"),
        registro("trabajo-1", "Trabajo", "trabajo", fechaAyer(9, 30), fechaAyer(10, 30), "#0F766E"),
        registro("manual-1", "Actividad manual", null, fechaAyer(11), fechaAyer(11, 30)),
        { ...registro("tarea-1", "Adelantar tarea del colegio", null, fechaAyer(11), fechaAyer(11, 20)), tareaId: "tarea-colegio", tareaNombre: "Adelantar tarea del colegio" }
    ]

    await page.addInitScript(({ claveRegistros, claveEventos, claveCategorias, registros, eventos, categorias }) => {
        localStorage.setItem(claveRegistros, JSON.stringify(registros))
        localStorage.setItem(claveEventos, JSON.stringify(eventos))
        localStorage.setItem(claveCategorias, JSON.stringify(categorias))
    }, { claveRegistros, claveEventos, claveCategorias, registros, eventos, categorias })
    await page.goto("/")
    await page.getByRole("button", { name: "Analítica", exact: true }).click()

    const panel = page.getByRole("region", { name: "Analítica" })
    await expect(panel).toBeVisible()
    await expect(page.locator(".calendario-panel")).toBeHidden()
    await expect(panel.getByLabel("Tiempo cubierto del período")).toBeVisible()
    await expect(panel.getByLabel("Suma de duraciones del período")).toBeVisible()
    await page.getByLabel("Elegir fecha").fill(fechaLocalISO(fechaAyer(9)))
    await expect(panel.getByLabel("Tiempo cubierto del período")).toContainText("02:00:00")
    await expect(panel.getByLabel("Suma de duraciones del período")).toContainText("03:50:00")
    await expect(panel.getByText("Une los horarios superpuestos para no contar dos veces el mismo tiempo.")).toBeVisible()
    await expect(panel.getByText("Suma el tiempo efectivo de cada registro. Si coinciden en horario, cuenta cada uno.")).toBeVisible()
    await expect(panel.getByRole("list", { name: "Duración por evento, de mayor a menor" }).getByText("Estudio")).toBeVisible()
    await expect(panel.getByRole("list", { name: "Duración por evento, de mayor a menor" }).getByText("01:30:00")).toBeVisible()
    await expect(panel.getByRole("list", { name: "Duración por evento, de mayor a menor" }).getByText("Trabajo")).toBeVisible()
    await expect(panel.getByRole("list", { name: "Duración por evento, de mayor a menor" }).getByText("Sin evento vinculado")).toBeVisible()
    await expect(panel.getByText(/pueden superar el tiempo cubierto del período/)).toBeVisible()

    await panel.getByLabel("Mostrar tiempo por").selectOption("actividad")
    await panel.getByLabel("Filtrar categoría").selectOption("salud")
    await expect(panel.getByLabel("Tiempo cubierto del período")).toContainText("01:30:00")
    await expect(panel.getByLabel("Suma de duraciones del período")).toContainText("03:00:00")
    await panel.getByLabel("Filtrar categoría").selectOption("casa")
    await expect(panel.getByLabel("Tiempo cubierto del período")).toContainText("01:30:00")
    await expect(panel.getByLabel("Suma de duraciones del período")).toContainText("02:00:00")
    await panel.getByLabel("Filtrar categoría").selectOption("__sin_categoria__")
    await expect(panel.getByLabel("Tiempo cubierto del período")).toContainText("00:30:00")
    await expect(panel.getByLabel("Suma de duraciones del período")).toContainText("00:50:00")
    await panel.getByLabel("Filtrar categoría").selectOption("")

    await panel.getByLabel("Mostrar tiempo por").selectOption("tarea")
    const listaTareas = panel.getByRole("list", { name: "Duración por tarea, de mayor a menor" })
    await expect(listaTareas.getByText("Adelantar tarea del colegio")).toBeVisible()
    await expect(listaTareas.getByText("00:20:00")).toBeVisible()
    await expect(listaTareas.getByText("Sin tarea vinculada")).toBeVisible()

    await panel.getByRole("button", { name: "Semana", exact: true }).click()
    await expect(panel.getByLabel("Tiempo cubierto del período")).toContainText("02:00:00")
    await expect(panel.getByLabel("Suma de duraciones del período")).toContainText("03:50:00")
    await expect(panel.getByText(/^Semana:/)).toBeVisible()

    await panel.getByRole("button", { name: "Día", exact: true }).click()
    await panel.getByRole("button", { name: "Día siguiente" }).click()
    await expect(panel.getByLabel("Tiempo cubierto del período")).toContainText("00:00:00")
    await expect(panel.getByLabel("Suma de duraciones del período")).toContainText("00:00:00")
    await expect(panel.getByText("No hay tiempo registrado en este período.")).toBeVisible()
})

test("Flujo de usuario: comunica que la analítica no está disponible si los registros fallan al cargar", async ({ page }) => {
    await page.addInitScript(clave => localStorage.setItem(clave, "{datos inválidos"), claveRegistros)
    await page.goto("/")
    await page.getByRole("button", { name: "Analítica", exact: true }).click()

    await expect(page.getByRole("alert")).toContainText("no tienen un formato JSON válido")
    await expect(page.getByLabel("Tiempo cubierto del período")).toHaveCount(0)
    await expect(page.getByLabel("Suma de duraciones del período")).toHaveCount(0)
})

test("Flujo de usuario: mantiene la analítica usable en móvil y en ambos temas", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    await page.getByRole("button", { name: "Analítica", exact: true }).click()
    const analitica = page.getByRole("region", { name: "Analítica" })
    await expect(analitica).toBeVisible()
    await expect(analitica.getByLabel("Tiempo cubierto del período")).toBeVisible()
    await expect(analitica.getByLabel("Suma de duraciones del período")).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    await page.getByRole("button", { name: "Cambiar a tema claro" }).click()
    await expect(page.locator("html")).toHaveAttribute("data-tema", "claro")
    await expect(page.getByLabel("Elegir fecha")).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
