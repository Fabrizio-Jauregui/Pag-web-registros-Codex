import { expect, test } from "@playwright/test"

const claveRegistros = "focus.registros.v1"

function fechaLocalISO(fecha) {
    return [
        fecha.getFullYear(),
        String(fecha.getMonth() + 1).padStart(2, "0"),
        String(fecha.getDate()).padStart(2, "0"),
    ].join("-")
}

test("Datos preparados + interacción UI: muestra en ambos días un registro que cruza la medianoche en la semana", async ({ page }) => {
    const hoy = new Date()
    const lunesSemanaPasada = new Date(hoy)
    lunesSemanaPasada.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) - 7)
    lunesSemanaPasada.setHours(0, 0, 0, 0)
    const inicio = new Date(lunesSemanaPasada)
    inicio.setDate(inicio.getDate() + 2)
    inicio.setHours(23, 58, 0, 0)
    const fin = new Date(inicio)
    fin.setDate(fin.getDate() + 1)
    fin.setHours(0, 2, 0, 0)
    const registro = {
        id: "qa-cruce-medianoche",
        nombre: "Registro de medianoche",
        eventoId: null,
        colorEvento: null,
        estado: "Finalizado",
        motivoCancelacion: null,
        segmentos: [{ tipo: "En curso", inicio: inicio.toISOString(), fin: fin.toISOString() }],
    }

    await page.addInitScript(({ clave, datos }) => {
        localStorage.setItem(clave, JSON.stringify(datos))
    }, { clave: claveRegistros, datos: [registro] })
    await page.goto("/")
    const selectorFecha = page.getByLabel("Ir a fecha")
    await selectorFecha.fill(fechaLocalISO(inicio))
    await page.getByRole("button", { name: "Semana", exact: true }).click()

    await expect(page.getByRole("table", { name: /^Semana del/ }).getByRole("columnheader"))
        .toHaveCount(8)
    await expect(page.getByRole("button", { name: /Registro de medianoche/ })).toHaveCount(2)

    await page.getByRole("button", { name: "Día", exact: true }).click()
    await expect(page.getByRole("button", { name: /Registro de medianoche/ })).toHaveCount(1)
    const siguienteDia = new Date(inicio)
    siguienteDia.setDate(siguienteDia.getDate() + 1)
    await selectorFecha.fill(fechaLocalISO(siguienteDia))
    await expect(page.getByRole("button", { name: /Registro de medianoche/ })).toHaveCount(1)
})
