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
        origenPuntual: true,
        categoriaIds: [],
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
    await expect(nivelZoom).toContainText("24 h visibles")
    expect(await page.locator(".calendario-dia-scroll").evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true)
    await expect(alejar).toBeDisabled()
    await expect(restablecer).toBeDisabled()

    await bloque.click()
    await acercar.click()
    await expect(nivelZoom).toContainText("2 min")
    await expect(page.locator(".calendario-dia-scroll")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Calendario ampliado" })).toHaveCount(0)
    const bloqueZoom = page.locator(".bloque-registro").filter({ hasText: "Registro QA breve" })
    await expect(bloqueZoom).toBeVisible()
    const geometriaZoom = await bloqueZoom.evaluate(element => ({
        altoBloque: element.getBoundingClientRect().height,
        altoPanel: element.closest(".calendario-dia-scroll").clientHeight
    }))
    expect(geometriaZoom.altoBloque).toBeGreaterThan(geometriaZoom.altoPanel * 0.95)
    expect(geometriaZoom.altoBloque).toBeLessThan(geometriaZoom.altoPanel * 1.05)

    while (await acercar.isEnabled()) await acercar.click()
    await expect(nivelZoom).toContainText("1 segundo")
    await expect(acercar).toBeDisabled()
    await expect(alejar).toBeEnabled()
    await expect(restablecer).toBeEnabled()
    await expect(page.locator(".calendario-dia-scroll")).toBeVisible()
    while (await alejar.isEnabled()) await alejar.click()
    await expect(nivelZoom).toContainText("24 h visibles")
    await expect(page.locator(".calendario-hora")).toHaveCount(24)
    await expect(restablecer).toBeDisabled()
    expect(erroresPagina).toEqual([])
    expect(erroresConsola).toEqual([])
})

test("seleccionar una franja acerca exactamente ese intervalo sin crear ni editar registros", async ({ page }) => {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - 1)
    await page.goto("/")
    const selectorFecha = page.getByLabel("Ir a fecha")
    await selectorFecha.fill(fechaLocalISO(fecha))
    const calendario = page.locator(".calendario-dia-scroll")
    await calendario.scrollIntoViewIfNeeded()
    const caja = await calendario.boundingBox()
    const alto = await calendario.evaluate(elemento => elemento.clientHeight)
    const x = caja.x + Math.min(caja.width - 40, 200)
    const inicioY = caja.y + alto * 9 / 24
    const finY = caja.y + alto * 10 / 24
    await page.mouse.move(x, inicioY)
    await page.mouse.down()
    await page.mouse.move(x, finY, { steps: 5 })
    await page.mouse.up()
    await page.getByRole("button", { name: "Acercar calendario" }).click()

    const salida = page.locator(".controles-zoom output")
    await expect(salida).toContainText("1 h visibles")
    await expect(salida).toContainText("09:00:00–")
    await expect(salida).toContainText("10:00:00")
    expect(await page.evaluate(() => localStorage.getItem("focus.registros.v1"))).toBeNull()
})
