import { expect, test } from "@playwright/test"

const claveTareas = "focus.tareas.v1"

test("Flujo de usuario: crea, cambia estado, edita, conserva tras recargar y elimina una tarea", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Tareas", exact: true }).click()

    await page.getByRole("button", { name: "Crear tarea", exact: true }).click()
    await page.getByRole("button", { name: "Guardar tarea", exact: true }).click()
    await expect(page.getByRole("alert")).toContainText("El nombre de la tarea es obligatorio")
    await page.getByLabel("Nombre", { exact: true }).fill("Preparar presentación")
    await page.getByRole("button", { name: "Guardar tarea", exact: true }).click()

    const tarea = page.getByRole("listitem").filter({ hasText: "Preparar presentación" })
    await expect(tarea).toBeVisible()
    let guardadas = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveTareas)
    expect(guardadas).toHaveLength(1)
    const idOriginal = guardadas[0].id
    expect(guardadas[0].estado).toBe("Pendiente")

    await expect(page.getByLabel("Estado de Preparar presentación").locator('option[value="En curso"]')).toHaveCount(0)
    await tarea.getByRole("button", { name: "Editar" }).click()
    await page.getByLabel("Nombre", { exact: true }).fill("Preparar presentación final")
    await page.getByRole("combobox", { name: "Estado", exact: true }).selectOption("Completada")
    await page.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(page.getByText("Preparar presentación final")).toBeVisible()

    guardadas = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveTareas)
    expect(guardadas).toHaveLength(1)
    expect(guardadas[0]).toMatchObject({ id: idOriginal, nombre: "Preparar presentación final", estado: "Completada" })
    await page.reload()
    await page.getByRole("button", { name: "Tareas", exact: true }).click()
    const tareaEditada = page.getByRole("listitem").filter({ hasText: "Preparar presentación final" })
    await expect(tareaEditada).toBeVisible()
    await expect(page.getByRole("heading", { name: "Completadas" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Canceladas" })).toBeVisible()

    page.once("dialog", dialog => dialog.dismiss())
    await tareaEditada.getByRole("button", { name: "Eliminar" }).click()
    await expect(tareaEditada).toBeVisible()
    page.once("dialog", dialog => dialog.accept())
    await tareaEditada.getByRole("button", { name: "Eliminar" }).click()
    await expect(tareaEditada).toHaveCount(0)
    expect(await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveTareas)).toEqual([])
})

test("separa las tareas completadas de las canceladas", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Tareas", exact: true }).click()
    await page.getByRole("button", { name: "Crear tarea", exact: true }).click()
    await page.getByLabel("Nombre", { exact: true }).fill("Tarea para cancelar")
    await page.getByRole("button", { name: "Guardar tarea", exact: true }).click()
    const tarea = page.getByRole("listitem").filter({ hasText: "Tarea para cancelar" })
    await tarea.getByLabel("Estado de Tarea para cancelar").selectOption("Cancelada")
    await expect(page.getByRole("heading", { name: "Canceladas" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Completadas" })).toBeVisible()
    const grupoCanceladas = page.locator(".tareas-grupo").filter({ has: page.getByRole("heading", { name: "Canceladas" }) })
    const grupoCompletadas = page.locator(".tareas-grupo").filter({ has: page.getByRole("heading", { name: "Completadas" }) })
    await expect(grupoCanceladas).toContainText("Tarea para cancelar")
    await expect(grupoCompletadas).not.toContainText("Tarea para cancelar")
})

test("no crea tareas si los datos guardados están corruptos", async ({ page }) => {
    await page.addInitScript(clave => localStorage.setItem(clave, "{"), claveTareas)
    await page.goto("/")
    await page.getByRole("button", { name: "Tareas", exact: true }).click()
    await expect(page.getByRole("alert")).toContainText("formato JSON válido")
    await expect(page.getByRole("button", { name: "Crear tarea" })).toBeDisabled()
    expect(await page.evaluate(clave => localStorage.getItem(clave), claveTareas)).toBe("{")
})
