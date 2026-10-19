import { expect, test } from "@playwright/test"

const claveEventos = "focus.plantillas-eventos.v1"
const claveRegistros = "focus.registros.v1"

test("Flujo de usuario: crea, edita, conserva, cancela y elimina una plantilla de evento", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Eventos", exact: true }).click()
    await page.getByRole("button", { name: "Crear evento", exact: true }).click()

    await page.getByRole("button", { name: "Guardar evento", exact: true }).click()
    await expect(page.getByRole("alert")).toContainText("El nombre del evento es obligatorio")

    await page.getByLabel("Nombre", { exact: true }).fill("Cerámica QA")
    await page.getByLabel("Color").fill("#3A7BCD")
    await page.getByRole("button", { name: "Guardar evento", exact: true }).click()

    const filaOriginal = page.locator(".evento-fila").filter({ hasText: "Cerámica QA" })
    await expect(filaOriginal).toBeVisible()
    let guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveEventos)
    expect(guardados).toHaveLength(1)
    const idOriginal = guardados[0].id
    expect(guardados[0].color).toBe("#3A7BCD")

    await filaOriginal.getByRole("button", { name: "Editar" }).click()
    await page.getByLabel("Nombre", { exact: true }).fill("Cerámica y torno")
    await page.getByLabel("Color").fill("#A13456")
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.locator(".evento-fila").filter({ hasText: "Cerámica y torno" })).toBeVisible()

    guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveEventos)
    expect(guardados).toEqual([{ id: idOriginal, nombre: "Cerámica y torno", color: "#A13456" }])

    await page.reload()
    await page.getByRole("button", { name: "Eventos", exact: true }).click()
    const filaEditada = page.locator(".evento-fila").filter({ hasText: "Cerámica y torno" })
    await expect(filaEditada).toBeVisible()

    page.once("dialog", dialog => dialog.dismiss())
    await filaEditada.getByRole("button", { name: "Eliminar" }).click()
    await expect(filaEditada).toBeVisible()

    page.once("dialog", dialog => dialog.accept())
    await filaEditada.getByRole("button", { name: "Eliminar" }).click()
    await expect(filaEditada).toHaveCount(0)
    expect(await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveEventos)).toEqual([])
    expect(await page.evaluate(clave => localStorage.getItem(clave), claveRegistros)).toBeNull()
})

test("Datos preparados + interacción UI: impide eliminar una plantilla que tiene registros vinculados", async ({ page }) => {
    const inicio = new Date(Date.now() - 6 * 60_000)
    const fin = new Date(inicio.getTime() + 2 * 60_000)
    const evento = { id: "qa-evento-vinculado", nombre: "Lectura vinculada", color: "#334455" }
    const registro = {
        id: "qa-registro-vinculado",
        nombre: evento.nombre,
        eventoId: evento.id,
        colorEvento: evento.color,
        estado: "Finalizado",
        motivoCancelacion: null,
        segmentos: [{ tipo: "En curso", inicio: inicio.toISOString(), fin: fin.toISOString() }],
    }

    await page.addInitScript(({ claves, datos }) => {
        localStorage.setItem(claves.eventos, JSON.stringify(datos.eventos))
        localStorage.setItem(claves.registros, JSON.stringify(datos.registros))
    }, {
        claves: { eventos: claveEventos, registros: claveRegistros },
        datos: { eventos: [evento], registros: [registro] },
    })
    await page.goto("/")
    await page.getByRole("button", { name: "Eventos", exact: true }).click()

    const fila = page.locator(".evento-fila").filter({ hasText: evento.nombre })
    page.once("dialog", dialog => dialog.accept())
    await fila.getByRole("button", { name: "Eliminar" }).click()

    await expect(page.getByRole("alert")).toContainText("está vinculada a uno o más registros")
    await expect(fila).toBeVisible()
    expect(await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveEventos))
        .toEqual([evento])
    expect(await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros))
        .toHaveLength(1)
})
