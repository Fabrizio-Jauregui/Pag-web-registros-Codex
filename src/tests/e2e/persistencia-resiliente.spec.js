import { expect, test } from "@playwright/test"

const claveEventos = "focus.plantillas-eventos.v1"
const claveRegistros = "focus.registros.v1"

test("Preparación técnica de almacenamiento: conserva datos locales inválidos y deshabilita las acciones dependientes", async ({ page }) => {
    const jsonEventosInvalido = "{json de eventos dañado"
    const jsonRegistrosInvalido = "{json de registros dañado"

    await page.addInitScript(({ claves, valores }) => {
        localStorage.setItem(claves.eventos, valores.eventos)
        localStorage.setItem(claves.registros, valores.registros)
    }, {
        claves: { eventos: claveEventos, registros: claveRegistros },
        valores: { eventos: jsonEventosInvalido, registros: jsonRegistrosInvalido },
    })
    await page.goto("/")

    await expect(page.getByRole("region", { name: "Registro de tiempo" }).getByRole("alert"))
        .toContainText("formato JSON válido")
    await expect(page.getByRole("button", { name: "Nuevo registro", exact: true })).toBeDisabled()

    await page.getByRole("button", { name: "Eventos", exact: true }).click()
    await expect(page.getByRole("region", { name: "Eventos" }).getByRole("alert"))
        .toContainText("formato JSON válido")
    await expect(page.getByRole("button", { name: "Crear evento", exact: true })).toBeDisabled()

    expect(await page.evaluate(claves => ({
        eventos: localStorage.getItem(claves.eventos),
        registros: localStorage.getItem(claves.registros),
    }), { eventos: claveEventos, registros: claveRegistros })).toEqual({
        eventos: jsonEventosInvalido,
        registros: jsonRegistrosInvalido,
    })
})

test("Preparación técnica de almacenamiento: comunica fallos al guardar eventos y registros sin fingir que se guardaron", async ({ page }) => {
    await page.addInitScript(claves => {
        const setItemOriginal = Storage.prototype.setItem
        Storage.prototype.setItem = function (clave, valor) {
            if (Object.values(claves).includes(clave)) {
                throw new DOMException("Almacenamiento lleno", "QuotaExceededError")
            }
            return setItemOriginal.call(this, clave, valor)
        }
    }, { eventos: claveEventos, registros: claveRegistros })
    await page.goto("/")

    await page.getByRole("button", { name: "Eventos", exact: true }).click()
    await page.getByRole("button", { name: "Crear evento", exact: true }).click()
    await page.getByLabel("Nombre", { exact: true }).fill("Evento no guardado")
    await page.getByRole("button", { name: "Guardar evento", exact: true }).click()
    await expect(page.getByRole("alert")).toContainText("No se pudieron guardar los eventos")
    await expect(page.getByRole("heading", { name: "Nuevo evento" })).toBeVisible()
    await page.getByRole("button", { name: "Cancelar", exact: true }).click()

    await page.getByRole("button", { name: "Calendario", exact: true }).click()
    await page.getByLabel("Nombre del temporizador").fill("Registro no guardado")
    await page.getByRole("button", { name: "Iniciar", exact: true }).click()
    await expect(page.getByRole("region", { name: "Registro de tiempo" }).getByRole("alert"))
        .toContainText("No se pudieron guardar los registros")
    await expect(page.getByText("Estado actual: Inactivo")).toBeVisible()
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("focus.registros.v1") ?? "[]").length)).toBe(0)
})
