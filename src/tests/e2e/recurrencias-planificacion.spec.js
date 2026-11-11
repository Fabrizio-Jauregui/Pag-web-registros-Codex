import { expect, test } from "@playwright/test"
import { crearEventoParaPrueba, seleccionarOrigenEnActividad } from "./ayuda-origenes-planificacion.js"

const clave = "focus.recurrencias.v1"
const pad = valor => String(valor).padStart(2, "0")
const fechaISO = fecha => `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`
const fechaHoraISO = fecha => `${fechaISO(fecha)}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`

async function abrirPlan(page, nombre) {
    const bloque = page.getByRole("button", { name: new RegExp(`Planificado: ${nombre}`) })
    if (await bloque.count()) {
        await bloque.click()
        return
    }
    await page.getByRole("button", { name: /Ver \d+ actividades? cercanas?/ }).first().click()
    await page.getByRole("dialog").getByRole("button").filter({ hasText: nombre }).click()
}

test("Flujo de usuario: crea una serie semanal, la muestra en la semana siguiente y edita una aparición aislada", async ({ page }) => {
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - 14)
    inicio.setHours(9, 0, 0, 0)
    const siguiente = new Date(inicio)
    siguiente.setDate(siguiente.getDate() + 7)
    const fin = new Date(inicio.getTime() + 30 * 60_000)

    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))
    await crearEventoParaPrueba(page, "Caminata semanal")
    await page.getByRole("button", { name: "Calendario", exact: true }).click()
    await page.getByRole("button", { name: "Planificar actividad", exact: true }).click()
    const formulario = page.getByRole("form", { name: "Planificar actividad" })
    await seleccionarOrigenEnActividad(page, formulario, "evento", "Caminata semanal")
    await formulario.getByRole("textbox", { name: "Inicio", exact: true }).fill(fechaHoraISO(inicio))
    await formulario.getByLabel("Fin", { exact: true }).fill(fechaHoraISO(fin))
    await formulario.getByLabel("Repetir semanalmente").check()
    await formulario.getByLabel(["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][inicio.getDay()]).check()
    await formulario.getByRole("button", { name: "Guardar plan" }).click()

    let reglas = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), clave)
    expect(reglas).toHaveLength(1)
    expect(reglas[0].diasSemana).toEqual([inicio.getDay()])
    expect(await page.evaluate(() => localStorage.getItem("focus.planes.v1"))).toBeNull()
    await page.reload()
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))
    await abrirPlan(page, "Caminata semanal")

    await page.getByLabel("Ir a fecha").fill(fechaISO(siguiente))
    await abrirPlan(page, "Caminata semanal")
    const detalle = page.getByRole("region", { name: "Plan: Caminata semanal" })
    await detalle.getByRole("button", { name: "Editar plan" }).click()
    const edicion = page.getByRole("form", { name: "Editar actividad planificada" })
    await edicion.getByRole("combobox", { name: "Aplicar cambios a" }).selectOption("solo")
    const inicioExcepcion = new Date(siguiente.getTime() + 10 * 60_000)
    await edicion.getByRole("textbox", { name: "Inicio", exact: true }).fill(fechaHoraISO(inicioExcepcion))
    await edicion.getByRole("button", { name: "Guardar cambios" }).click()
    await abrirPlan(page, "Caminata semanal")

    reglas = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), clave)
    expect(reglas[0].excepciones[fechaISO(siguiente)].inicio).toBe(inicioExcepcion.toISOString())
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))
    await abrirPlan(page, "Caminata semanal")

    await page.getByLabel("Ir a fecha").fill(fechaISO(siguiente))
    await abrirPlan(page, "Caminata semanal")
    const detalleSiguiente = page.getByRole("region", { name: "Plan: Caminata semanal" })
    await detalleSiguiente.getByLabel("Eliminar").selectOption("siguientes")
    page.once("dialog", dialog => dialog.accept())
    await detalleSiguiente.getByRole("button", { name: "Eliminar selección" }).click()
    await expect(page.getByRole("button", { name: /Planificado: Caminata extendida/ })).toHaveCount(0)
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))
    const bloqueInicial = page.getByRole("button", { name: /Planificado: Caminata semanal/ })
    await bloqueInicial.click()
    const detalleInicial = page.getByRole("region", { name: "Plan: Caminata semanal" })
    await detalleInicial.getByLabel("Eliminar").selectOption("toda")
    page.once("dialog", dialog => dialog.accept())
    await detalleInicial.getByRole("button", { name: "Eliminar selección" }).click()
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), clave)).toEqual([])
})
