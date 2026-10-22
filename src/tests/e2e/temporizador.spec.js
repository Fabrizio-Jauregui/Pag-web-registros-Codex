import { expect, test } from "@playwright/test"

const claveRegistros = "focus.registros.v1"
const claveEventos = "focus.plantillas-eventos.v1"

test("Datos preparados + interacción UI: completa un ciclo de temporizador con pausa, evento y persistencia", async ({ page }) => {
    const inicioReloj = new Date(2026, 9, 13, 15, 0, 0, 0)
    const evento = { id: "qa-evento-guitarra", nombre: "Guitarra QA", color: "#AABBCC" }

    await page.clock.install({ time: inicioReloj })
    await page.addInitScript(({ clave, datos }) => {
        window.localStorage.setItem(clave, JSON.stringify(datos))
    }, { clave: claveEventos, datos: [evento] })
    await page.goto("/")
    await page.clock.pauseAt(new Date(inicioReloj.getTime() + 60_000))

    const selectorEvento = page.getByLabel("Plantilla de evento")
    const nombre = page.getByLabel("Nombre del temporizador")
    const play = page.getByRole("button", { name: "Iniciar", exact: true })
    const tarjetaActiva = page.getByRole("article", { name: `Actividad activa: ${evento.nombre}` })
    const pause = tarjetaActiva.getByRole("button", { name: "Pausar", exact: true })
    const continuar = tarjetaActiva.getByRole("button", { name: "Continuar", exact: true })
    const stop = tarjetaActiva.getByRole("button", { name: "Finalizar", exact: true })

    await selectorEvento.selectOption(evento.id)
    await expect(nombre).toHaveValue(evento.nombre)
    await expect(nombre).toBeDisabled()
    await play.click()
    await expect(page.getByText("Estado actual: En curso")).toBeVisible()
    await expect(play).toBeEnabled()
    await expect(stop).toBeDisabled()

    await page.clock.runFor(999)
    await expect(stop).toBeDisabled()
    await page.clock.runFor(1)
    await expect(stop).toBeEnabled()

    await pause.click()
    await expect(page.getByText("Estado actual: Pausado")).toBeVisible()
    await page.clock.runFor(5000)
    await expect(tarjetaActiva.getByText("Tiempo efectivo: 00:00:01")).toBeVisible()
    await expect(tarjetaActiva.getByText("Tiempo en pausa: 00:00:05")).toBeVisible()

    await continuar.click()
    await page.clock.runFor(2000)
    await stop.click()

    const registrosGuardados = await page.evaluate(clave => (
        JSON.parse(window.localStorage.getItem(clave))
    ), claveRegistros)
    expect(registrosGuardados).toHaveLength(1)
    expect(registrosGuardados[0]).toMatchObject({
        nombre: evento.nombre,
        eventoId: evento.id,
        colorEvento: evento.color,
        estado: "Finalizado",
    })
    expect(registrosGuardados[0].segmentos.map(segmento => segmento.tipo))
        .toEqual(["En curso", "Pausado", "En curso"])
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("focus.registros.v1") ?? "[]").length)).toBe(1)

    await page.reload()
    await expect(page.getByText("Estado actual: Inactivo")).toBeVisible()
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("focus.registros.v1") ?? "[]").length)).toBe(1)
})

test("Flujo de usuario: no inicia el temporizador sin nombre ni plantilla seleccionada", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Iniciar", exact: true }).click()

    await expect(page.getByRole("region", { name: "Registro de tiempo" }).getByRole("alert"))
        .toContainText("Escribí un nombre para iniciar el registro")
    await expect(page.getByText("Estado actual: Inactivo")).toBeVisible()
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("focus.registros.v1") ?? "[]").length)).toBe(0)
})
