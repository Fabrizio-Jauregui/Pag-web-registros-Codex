import { expect, test } from "@playwright/test"

const clavePlanes = "focus.planes.v1"
const claveRegistros = "focus.registros.v1"

function datosHoy() {
    const hoy = new Date()
    const pad = numero => String(numero).padStart(2, "0")
    const fecha = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`
    return { fecha, hora: (hora, minuto) => `${fecha}T${pad(hora)}:${pad(minuto)}` }
}

async function crearPlan(page, nombre, inicio, fin) {
    await page.getByRole("button", { name: "Planificar actividad", exact: true }).click()
    const formulario = page.getByRole("form", { name: "Planificar actividad" })
    await formulario.getByLabel("Nombre de la actividad").fill(nombre)
    await formulario.getByLabel("Inicio").fill(inicio)
    await formulario.getByLabel("Fin", { exact: true }).fill(fin)
    await formulario.getByRole("button", { name: "Guardar plan", exact: true }).click()
}

function bloqueDelPlan(page, nombre) {
    return page.getByRole("region", { name: "Calendario" })
        .getByRole("group", { name: /Registros del/ })
        .getByRole("button", { name: new RegExp(`Planificado: ${nombre}`) })
}

test("Flujo de usuario: sigue todos los planes del día y crea registros en secuencia desde ahora", async ({ page }) => {
    const { fecha, hora } = datosHoy()
    await page.clock.install({ time: new Date() })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fecha)
    await crearPlan(page, "Preparar desayuno", hora(9, 0), hora(9, 1))
    await crearPlan(page, "Desayunar", hora(9, 10), hora(9, 11))

    await bloqueDelPlan(page, "Preparar desayuno").click()
    const detalle = page.getByRole("region", { name: "Plan: Preparar desayuno" })
    await detalle.getByRole("button", { name: "Seguir planificación" }).click()
    await detalle.getByRole("button", { name: "Desde el primero del día" }).click()

    const panel = page.getByRole("region", { name: "Siguiendo la planificación" })
    await expect(panel).toContainText("Preparar desayuno")
    const registrosIniciales = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registrosIniciales).toHaveLength(1)
    expect(registrosIniciales[0].planId).toBeTruthy()
    expect(new Date(registrosIniciales[0].segmentos[0].inicio).getTime()).toBeGreaterThan(Date.now() - 5000)

    await page.clock.fastForward(60_000)
    await expect(panel).toContainText("Evento 2 de 2", { timeout: 5000 })
    await expect(panel).toContainText("Desayunar")
    await page.clock.fastForward(60_000)
    await expect(panel).toHaveCount(0, { timeout: 5000 })

    const registrosFinales = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    const planes = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), clavePlanes)
    expect(registrosFinales).toHaveLength(2)
    expect(registrosFinales.map(registro => registro.estado)).toEqual(["Finalizado", "Finalizado"])
    expect(registrosFinales.map(registro => registro.planId)).toEqual(planes.map(plan => plan.id))
})

test("Flujo de usuario: pausa, recarga, salta el evento actual y detiene la secuencia", async ({ page }) => {
    const { fecha, hora } = datosHoy()
    await page.clock.install({ time: new Date() })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fecha)
    await crearPlan(page, "Lectura inicial", hora(9, 0), hora(9, 30))
    await crearPlan(page, "Lectura siguiente", hora(10, 0), hora(10, 30))
    await bloqueDelPlan(page, "Lectura inicial").click()
    const detalle = page.getByRole("region", { name: "Plan: Lectura inicial" })
    await detalle.getByRole("button", { name: "Seguir planificación" }).click()
    await detalle.getByRole("button", { name: "Desde este evento" }).click()

    const panel = page.getByRole("region", { name: "Siguiendo la planificación" })
    await expect(panel).toContainText("Lectura inicial")
    await page.clock.fastForward(1100)
    await panel.getByRole("button", { name: "Pausar" }).click()
    await expect(panel).toContainText("Pausado")
    await page.reload()

    const panelRecargado = page.getByRole("region", { name: "Siguiendo la planificación" })
    await expect(panelRecargado).toContainText("Lectura inicial")
    await expect(panelRecargado).toContainText("Pausado")
    await page.clock.fastForward(10_000)
    await expect(panelRecargado).toContainText("Lectura inicial")
    await panelRecargado.getByRole("button", { name: "Continuar" }).click()
    await page.clock.fastForward(1100)
    await panelRecargado.getByRole("button", { name: "Saltar evento" }).click()
    await expect(panelRecargado).toContainText("Lectura siguiente")

    const registrosTrasSalto = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registrosTrasSalto[0].estado).toBe("Finalizado")
    expect(registrosTrasSalto[0].planId).toBeTruthy()
    await page.clock.fastForward(1100)
    await panelRecargado.getByRole("button", { name: "Dejar de seguir" }).click()
    await expect(panelRecargado).toHaveCount(0)
    const registrosFinales = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registrosFinales).toHaveLength(2)
    expect(registrosFinales[1].estado).toBe("Finalizado")
})
