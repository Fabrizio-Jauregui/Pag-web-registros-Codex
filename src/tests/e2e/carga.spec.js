import { expect, test } from "@playwright/test"

test("Flujo de usuario: Focus carga la interfaz principal", async ({ page }) => {
    await page.goto("/")

    await expect(page).toHaveTitle("Focus")
    await expect(page.getByRole("heading", { name: "Focus", level: 1 })).toBeVisible()
    await expect(page.getByRole("button", { name: "Calendario", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
    )
    await expect(page.getByText(/planificá lo que sigue/i)).toBeVisible()
    await expect(page.getByRole("list", { name: "Significado de los bloques del calendario" }))
        .toContainText("Tiempo registrado")
    await expect(page.getByRole("list", { name: "Significado de los bloques del calendario" }))
        .toContainText("Actividad planificada")
})
