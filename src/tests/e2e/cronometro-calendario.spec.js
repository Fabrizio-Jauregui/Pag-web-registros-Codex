import { expect, test } from "@playwright/test"
import { crearEventoParaPrueba, seleccionarOrigenEnActividad } from "./ayuda-origenes-planificacion.js"

function fechaISO(fecha) {
    const dos = valor => String(valor).padStart(2, "0")
    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`
}

function valorFechaHoraLocal(fecha) {
    const dos = valor => String(valor).padStart(2, "0")
    return `${fechaISO(fecha)}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    test(`cronómetro se acomoda junto a otros bloques en Día y semana (${viewport.width}px)`, async ({ page }) => {
        await page.setViewportSize(viewport)
        const ahora = new Date()
        await page.clock.install({ time: ahora })
        const fecha = fechaISO(ahora)
        const inicioCronometro = new Date(ahora.getTime() + 5 * 60_000)
        const finPlan = new Date(inicioCronometro.getTime() + 60 * 60_000)
        const horaInicioCronometro = `${String(inicioCronometro.getHours()).padStart(2, "0")}:${String(inicioCronometro.getMinutes()).padStart(2, "0")}:00`
        const etiquetaInicioCronometro = `${String(inicioCronometro.getHours()).padStart(2, "0")}:${String(inicioCronometro.getMinutes()).padStart(2, "0")}`

        await crearEventoParaPrueba(page, "Actividad cercana")
        await crearEventoParaPrueba(page, "Etapa uno")
        await crearEventoParaPrueba(page, "Etapa dos")

        await page.getByRole("button", { name: "Calendario", exact: true }).click()
        await page.getByLabel("Ir a fecha").fill(fecha)
        await seleccionarOrigenEnActividad(page, page, "evento", "Actividad cercana")
        await page.getByRole("button", { name: "Iniciar", exact: true }).click()
        await page.getByRole("button", { name: "Planificar actividad", exact: true }).click()
        const formularioPlan = page.getByRole("form", { name: "Planificar actividad" })
        await seleccionarOrigenEnActividad(page, formularioPlan, "evento", "Actividad cercana")
        await formularioPlan.getByRole("textbox", { name: "Inicio", exact: true }).fill(valorFechaHoraLocal(inicioCronometro))
        await formularioPlan.getByLabel("Fin", { exact: true }).fill(valorFechaHoraLocal(finPlan))
        await formularioPlan.getByRole("button", { name: "Guardar plan" }).click()

        await page.getByRole("button", { name: "Planificaciones", exact: true }).click()
        await page.getByRole("button", { name: /Secuencia con cronómetro/ }).click()
        const editor = page.locator(".editor-plantilla-cronometro")
        await editor.getByLabel("Nombre de la plantilla").fill("Rutina visual")
        const actividades = editor.locator(".editor-plantilla-actividad")
        await seleccionarOrigenEnActividad(page, actividades.nth(0), "evento", "Etapa uno")
        await seleccionarOrigenEnActividad(page, actividades.nth(1), "evento", "Etapa dos")
        await editor.getByRole("button", { name: "Guardar plantilla" }).click()
        await page.getByLabel("Aplicar a la fecha").fill(fecha)
        await page.getByLabel("Hora real de inicio Rutina visual").fill(horaInicioCronometro)
        await page.getByRole("button", { name: "Aplicar a fecha" }).click()

        const planesAntes = await page.evaluate(() => JSON.parse(localStorage.getItem("focus.planes.v1")))
        const planesCronometro = planesAntes.filter(plan => plan.plantillaOrigenNombre === "Rutina visual")
        expect(planesCronometro).toHaveLength(2)
        expect(planesCronometro.every(plan => plan.fin === null)).toBe(true)
        const fechasGuardadasAntes = planesCronometro.map(plan => [plan.inicio, plan.fin])

        await page.getByRole("button", { name: "Calendario", exact: true }).click()
        await page.getByLabel("Ir a fecha").fill(fecha)
        const marcador = page.getByRole("button", { name: new RegExp(`Abrir secuencia con cronómetro Rutina visual, 2 actividades, inicio previsto ${etiquetaInicioCronometro}`) })
        await expect(marcador).toBeVisible()
        await expect(marcador).toHaveClass(/marcador-secuencia-cronometro/)
        const botonPlan = page.getByRole("button", { name: /Planificado: Actividad cercana/ })
        const botonRegistro = page.locator(".grupo-marcas-boton").first()
        await expect(botonPlan).toBeVisible()
        await expect(botonRegistro).toBeVisible()
        const [cajaMarcador, cajaPlan, cajaRegistro, cajaLienzo] = await Promise.all([
            marcador.boundingBox(), botonPlan.boundingBox(), botonRegistro.boundingBox(), page.locator(".capa-registros-dia").boundingBox()
        ])
        expect(cajaMarcador.height).toBe(34)
        const segundosInicio = inicioCronometro.getHours() * 3600 + inicioCronometro.getMinutes() * 60 + inicioCronometro.getSeconds()
        const yInicioEsperado = cajaLienzo.y + segundosInicio / 86400 * cajaLienzo.height
        expect(Math.abs(cajaMarcador.y + cajaMarcador.height / 2 - yInicioEsperado)).toBeLessThanOrEqual(2)
        for (const contenido of [cajaPlan, cajaRegistro]) {
            expect(cajaMarcador.x + cajaMarcador.width <= contenido.x + 1
                || contenido.x + contenido.width <= cajaMarcador.x + 1).toBe(true)
        }

        await page.getByRole("button", { name: "Acercar calendario" }).click()
        await expect(marcador).toBeVisible()
        await marcador.click()
        await expect(page.getByRole("region", { name: "Planificación Rutina visual" })).toBeVisible()
        const planesDespues = await page.evaluate(() => JSON.parse(localStorage.getItem("focus.planes.v1")))
        expect(planesDespues.filter(plan => plan.plantillaOrigenNombre === "Rutina visual").map(plan => [plan.inicio, plan.fin])).toEqual(fechasGuardadasAntes)
        await page.getByRole("region", { name: "Planificación Rutina visual" }).getByRole("button", { name: "Cerrar detalle de Rutina visual" }).click()

        await page.getByRole("button", { name: "Semana", exact: true }).click()
        if (viewport.width <= 700) await page.getByRole("button", { name: "Grilla por horas" }).click()
        await page.getByLabel("Ir a fecha").fill(fecha)
        const marcadorSemanal = page.getByRole("button", { name: new RegExp(`Abrir secuencia con cronómetro Rutina visual, 2 actividades, inicio previsto ${etiquetaInicioCronometro}`) })
        await expect(marcadorSemanal).toBeVisible()
        await marcadorSemanal.click()
        await expect(page.getByRole("region", { name: "Planificación Rutina visual" })).toBeVisible()
    })
}
