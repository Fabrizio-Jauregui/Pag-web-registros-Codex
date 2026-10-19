import { expect, test } from "@playwright/test"

const claveRegistros = "focus.registros.v1"

function fechaLocalISO(fecha) {
    const año = fecha.getFullYear()
    const mes = String(fecha.getMonth() + 1).padStart(2, "0")
    const dia = String(fecha.getDate()).padStart(2, "0")

    return `${año}-${mes}-${dia}`
}

test("Flujo de usuario: el calendario permite navegar entre fechas y vistas", async ({ page }) => {
    await page.goto("/")

    const selectorFecha = page.getByLabel("Ir a fecha")
    const fechaInicial = await selectorFecha.inputValue()

    await page.getByRole("button", { name: "Día siguiente" }).click()
    await expect(selectorFecha).not.toHaveValue(fechaInicial)

    await page.getByRole("button", { name: "Día anterior" }).click()
    await expect(selectorFecha).toHaveValue(fechaInicial)

    await selectorFecha.fill("2026-03-14")
    await expect(selectorFecha).toHaveValue("2026-03-14")

    await page.getByRole("button", { name: "Semana", exact: true }).click()
    await expect(page.getByRole("button", { name: "Semana anterior" })).toBeVisible()
    await expect(page.getByRole("table", { name: /^Semana del/ }).getByRole("columnheader"))
        .toHaveCount(8)

    await page.getByRole("button", { name: "Semana siguiente" }).click()
    await expect(selectorFecha).not.toHaveValue("2026-03-14")
    await page.getByRole("button", { name: "Hoy", exact: true }).click()
    await expect(selectorFecha).toHaveValue(fechaLocalISO(new Date()))

    await page.getByRole("button", { name: "Día", exact: true }).click()
    await expect(page.getByRole("button", { name: "Día anterior" })).toBeVisible()
    await expect(page.locator(".calendario-hora")).toHaveCount(24)
})

test("Datos preparados + interacción UI: el único calendario acerca desde 24 horas hasta un segundo", async ({ page }) => {
    const fin = new Date(Date.now() - 60_000)
    const inicio = new Date(fin.getTime() - 2 * 60_000)
    const registros = [{
        id: "qa-registro-breve",
        nombre: "Registro QA breve",
        eventoId: null,
        colorEvento: null,
        estado: "Finalizado",
        motivoCancelacion: null,
        segmentos: [{ tipo: "En curso", inicio: inicio.toISOString(), fin: fin.toISOString() }],
    }]
    const erroresPagina = []
    const erroresConsola = []

    page.on("pageerror", error => erroresPagina.push(error.message))
    page.on("console", mensaje => {
        if (mensaje.type() === "error") {
            erroresConsola.push(`${mensaje.text()} (${mensaje.location().url || "sin URL de origen"})`)
        }
    })
    page.on("response", respuesta => {
        if (respuesta.status() >= 400) {
            erroresConsola.push(`HTTP ${respuesta.status()}: ${respuesta.url()}`)
        }
    })
    await page.addInitScript(({ clave, datos }) => {
        window.localStorage.setItem(clave, JSON.stringify(datos))
    }, { clave: claveRegistros, datos: registros })
    await page.goto("/")

    const selectorFecha = page.getByLabel("Ir a fecha")
    await selectorFecha.fill(fechaLocalISO(inicio))

    const acercar = page.getByRole("button", { name: "Acercar calendario" })
    const alejar = page.getByRole("button", { name: "Alejar calendario" })
    const restablecer = page.getByRole("button", { name: "Restablecer", exact: true })
    const nivelZoom = page.locator(".controles-zoom output")
    const bloque = page.getByRole("button", { name: /Registro QA breve/ })
    await expect(bloque).toBeVisible()
    await expect(nivelZoom).toHaveText("24 h")
    await expect(alejar).toBeDisabled()
    await expect(restablecer).toBeDisabled()

    await bloque.click()
    await acercar.click()
    await expect(nivelZoom).toHaveText("5 min")
    await expect(page.locator(".calendario-dia-scroll")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Calendario ampliado" })).toHaveCount(0)
    const bloqueZoom = page.locator(".bloque-detalle-tramo").filter({ hasText: "Registro QA breve" })
    await expect(bloqueZoom).toBeVisible()
    const altoBloqueAmpliado = await bloqueZoom.evaluate(element => element.getBoundingClientRect().height)
    expect(altoBloqueAmpliado).toBeGreaterThan(100)

    while (await acercar.isEnabled()) await acercar.click()
    await expect(nivelZoom).toHaveText("1 segundo")
    await expect(acercar).toBeDisabled()
    await expect(alejar).toBeEnabled()
    await expect(restablecer).toBeEnabled()
    await expect(page.locator(".calendario-dia-scroll")).toBeVisible()
    while (await alejar.isEnabled()) await alejar.click()
    await expect(nivelZoom).toHaveText("24 h")
    await expect(page.locator(".calendario-hora")).toHaveCount(24)
    await expect(restablecer).toBeDisabled()
    expect(erroresPagina).toEqual([])
    expect(erroresConsola).toEqual([])
})
