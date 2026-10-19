import { expect, test } from "@playwright/test"

const key = "focus.registros.v1"

function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function dateTime(date) {
    return `${isoDate(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`
}

test("QA V8 diagnóstico: mueve un registro de ayer 15 minutos más tarde con mouse", async ({ page }) => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const start = new Date(yesterday)
    start.setHours(9, 0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)

    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(isoDate(start))
    await page.getByRole("button", { name: "Nuevo registro", exact: true }).click()
    await page.getByLabel("Nombre de la actividad").fill("QA V8 arrastre tarde")
    await page.getByLabel("Inicio").fill(dateTime(start).slice(0, 16))
    await page.getByLabel("Fin", { exact: true }).fill(dateTime(end).slice(0, 16))
    await page.getByRole("button", { name: "Crear registro", exact: true }).click()
    await page.getByRole("button", { name: "Edición directa: desactivada" }).click()

    const block = page.getByRole("button", { name: /QA V8 arrastre tarde/ })
    await block.scrollIntoViewIfNeeded()
    const box = await block.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.35)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.35 + 16, { steps: 5 })
    await page.mouse.up()

    await expect(page.getByRole("button", { name: /QA V8 arrastre tarde.*09:15 a 10:15/ })).toBeVisible()
    await expect(page.locator(".mensaje-ajuste-calendario[role=status]")).toContainText("Registro movido")
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), key)
    expect(saved[0].segmentos[0].inicio).toBe(new Date(start.getTime() + 15 * 60_000).toISOString())
})

test("QA V8 diagnóstico: mueve más tarde un registro de hoy que permanece en el pasado, en semana", async ({ page }) => {
    const now = new Date()
    now.setSeconds(0, 0)
    const start = new Date(now.getTime() - 120 * 60_000)
    const end = new Date(now.getTime() - 90 * 60_000)

    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(isoDate(start))
    await page.getByRole("button", { name: "Nuevo registro", exact: true }).click()
    await page.getByLabel("Nombre de la actividad").fill("QA V8 semana hoy")
    await page.getByLabel("Inicio").fill(dateTime(start).slice(0, 16))
    await page.getByLabel("Fin", { exact: true }).fill(dateTime(end).slice(0, 16))
    await page.getByRole("button", { name: "Crear registro", exact: true }).click()
    await page.getByRole("button", { name: "Edición directa: desactivada" }).click()
    await page.getByRole("button", { name: "Semana", exact: true }).click()

    const block = page.getByRole("button", { name: /QA V8 semana hoy/ })
    await block.scrollIntoViewIfNeeded()
    const box = await block.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 16, { steps: 5 })
    await page.mouse.up()

    await expect(page.locator(".mensaje-ajuste-calendario[role=status]")).toContainText("Registro movido")
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), key)
    expect(saved[0].segmentos[0].inicio).toBe(new Date(start.getTime() + 15 * 60_000).toISOString())
})
