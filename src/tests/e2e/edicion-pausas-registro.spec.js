import { expect, test } from "@playwright/test"

const CLAVE_REGISTROS = "focus.registros.v1"

async function prepararEvento(page, nombre) {
    await page.goto("/")
    await page.getByRole("button", { name: "Eventos", exact: true }).click()
    await page.getByRole("button", { name: "Crear evento", exact: true }).click()
    await page.getByLabel("Nombre", { exact: true }).fill(nombre)
    await page.getByRole("button", { name: "Guardar evento", exact: true }).click()
    await page.getByRole("button", { name: "Calendario", exact: true }).click()
    await page.getByLabel("Plantilla de evento").selectOption({ label: nombre })
    await page.getByRole("button", { name: "Iniciar", exact: true }).click()
    const actividad = page.getByRole("article", { name: `Actividad activa: ${nombre}` })
    await expect(actividad).toBeVisible()
    await expect(actividad.getByText(/Tiempo efectivo: 00:00:0[1-9]/)).toBeVisible()
    return actividad
}

async function editarDesdeCalendario(page, nombre) {
    const grupo = page.getByRole("group", { name: /Registros del/ })
    await grupo.getByRole("button", { name: new RegExp(nombre) }).last().click()
    const detalle = page.locator(".detalle-registro-calendario")
    await expect(detalle).toBeVisible()
    await detalle.getByRole("button", { name: "Editar registro" }).click()
    return page.getByRole("form", { name: "Editar registro finalizado" })
}

async function leerRegistro(page) {
    const registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS)
    return registros[0]
}

function valorFechaHoraLocal(iso) {
    const fecha = new Date(iso)
    const dos = valor => String(valor).padStart(2, "0")
    const minuto = `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
    return fecha.getSeconds() === 0 ? minuto : `${minuto}:${dos(fecha.getSeconds())}`
}

test("el recorrido de desayuno quita la pausa sin convertirla en tiempo activo", async ({ page }) => {
    const nombre = "Preparar desayuno"
    await prepararEvento(page, nombre)
    let actividad = page.getByRole("article", { name: `Actividad activa: ${nombre}` })
    await actividad.getByRole("button", { name: "Pausar", exact: true }).click()
    await expect(actividad).toContainText("Estado actual: Pausado")
    await page.waitForTimeout(1100)
    await actividad.getByRole("button", { name: "Continuar", exact: true }).click()
    await expect(actividad).toContainText("Estado actual: En curso")
    await expect(actividad.getByText(/Tiempo efectivo: 00:00:0[2-9]/)).toBeVisible()
    await actividad.getByRole("button", { name: "Finalizar", exact: true }).click()

    const antes = await leerRegistro(page)
    expect(antes.segmentos.map(segmento => segmento.tipo)).toEqual(["En curso", "Pausado", "En curso"])
    const efectivoAntes = antes.segmentos
        .filter(segmento => segmento.tipo === "En curso")
        .reduce((total, segmento) => total + Date.parse(segmento.fin) - Date.parse(segmento.inicio), 0)
    const formulario = await editarDesdeCalendario(page, nombre)
    await expect(formulario.getByRole("button", { name: "Quitar sin contar este tiempo" })).toBeVisible()
    await formulario.getByRole("button", { name: "Quitar sin contar este tiempo" }).click()
    await expect(formulario.locator(".formulario-segmento")).toHaveCount(2)
    await expect(formulario.getByRole("status")).toContainText("Intervalo sin registrar")
    await formulario.getByRole("button", { name: "Guardar cambios" }).click()

    const despues = await leerRegistro(page)
    expect(despues.nombre).toBe(nombre)
    expect(despues.eventoId).toBe(antes.eventoId)
    expect(despues.segmentos.map(segmento => segmento.tipo)).toEqual(["En curso", "En curso"])
    expect(Date.parse(despues.segmentos[1].inicio) - Date.parse(despues.segmentos[0].fin)).toBeGreaterThan(0)
    const efectivoDespues = despues.segmentos.reduce((total, segmento) => (
        total + Date.parse(segmento.fin) - Date.parse(segmento.inicio)
    ), 0)
    expect(efectivoDespues).toBe(efectivoAntes)

    const detalle = page.locator(".detalle-registro-calendario")
    await expect(detalle).toContainText("Tiempo sin registrar")
    await expect(detalle.locator(".segmento-sin-registrar")).toBeVisible()
    await page.reload()
    await page.getByRole("button", { name: "Historial", exact: true }).click()
    const fila = page.getByRole("region", { name: "Historial" }).locator(".historial-fila").filter({ hasText: nombre })
    await fila.locator("summary").click()
    await expect(fila).toContainText("Tiempo sin registrar")
    await expect(fila.locator(".segmento-sin-registrar")).toBeVisible()
})

test("permite quitar una pausa terminal desde Calendario y elegir si contarla", async ({ page }) => {
    const nombre = "Desayuno con pausa final"
    await prepararEvento(page, nombre)
    const actividad = page.getByRole("article", { name: `Actividad activa: ${nombre}` })
    await actividad.getByRole("button", { name: "Pausar", exact: true }).click()
    await expect(actividad).toContainText("Estado actual: Pausado")
    await page.waitForTimeout(1100)
    await actividad.getByRole("button", { name: "Finalizar", exact: true }).click()

    const original = await leerRegistro(page)
    expect(original.segmentos.map(segmento => segmento.tipo)).toEqual(["En curso", "Pausado"])
    const finActividad = original.segmentos[0].fin
    const finPausa = original.segmentos[1].fin
    let formulario = await editarDesdeCalendario(page, nombre)
    await formulario.getByRole("button", { name: "Contar este tiempo como actividad" }).click()
    await expect(formulario.locator(".formulario-segmento")).toHaveCount(1)
    await expect(formulario.getByLabel("Fin", { exact: true })).toHaveValue(valorFechaHoraLocal(finPausa))
    await formulario.getByRole("button", { name: "Cancelar" }).click()

    formulario = await editarDesdeCalendario(page, nombre)
    await formulario.getByRole("button", { name: "Quitar sin contar este tiempo" }).click()
    await expect(formulario.locator(".formulario-segmento")).toHaveCount(1)
    await expect(formulario.getByLabel("Fin", { exact: true })).toHaveValue(valorFechaHoraLocal(finActividad))
    await formulario.getByRole("button", { name: "Guardar cambios" }).click()

    const guardado = await leerRegistro(page)
    expect(guardado.segmentos.map(segmento => segmento.tipo)).toEqual(["En curso"])
    expect(Date.parse(guardado.segmentos[0].fin)).toBeLessThan(Date.parse(finPausa))
    await page.reload()
    expect((await leerRegistro(page)).segmentos.map(segmento => segmento.tipo)).toEqual(["En curso"])
})

test("contar una pausa terminal como actividad amplía el tramo activo y lo guarda", async ({ page }) => {
    const nombre = "Pausa terminal contabilizada"
    await prepararEvento(page, nombre)
    const actividad = page.getByRole("article", { name: `Actividad activa: ${nombre}` })
    await actividad.getByRole("button", { name: "Pausar", exact: true }).click()
    await expect(actividad).toContainText("Estado actual: Pausado")
    await page.waitForTimeout(1100)
    await actividad.getByRole("button", { name: "Finalizar", exact: true }).click()

    const original = await leerRegistro(page)
    const finPausa = original.segmentos.at(-1).fin
    const formulario = await editarDesdeCalendario(page, nombre)
    await formulario.getByRole("button", { name: "Contar este tiempo como actividad" }).click()
    await expect(formulario.locator(".formulario-segmento")).toHaveCount(1)
    await formulario.getByRole("button", { name: "Guardar cambios" }).click()

    const guardado = await leerRegistro(page)
    expect(guardado.segmentos.map(segmento => segmento.tipo)).toEqual(["En curso"])
    expect(Date.parse(guardado.segmentos[0].fin)).toBe(Date.parse(finPausa))
})
