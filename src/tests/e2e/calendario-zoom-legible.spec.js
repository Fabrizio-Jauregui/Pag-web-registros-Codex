import { expect, test } from "@playwright/test"

const CLAVE_REGISTROS = "focus.registros.v1"
const CLAVE_PLANES = "focus.planes.v1"

function fechaISO(fecha) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`
}

function registro(id, nombre, inicio, fin) {
    return {
        id,
        nombre,
        origenPuntual: true,
        categoriaIds: [],
        eventoId: null,
        colorEvento: null,
        estado: "Finalizado",
        motivoCancelacion: null,
        segmentos: [{ tipo: "En curso", inicio: inicio.toISOString(), fin: fin.toISOString() }]
    }
}

test("agrupa marcas breves cercanas y permite elegir cada registro", async ({ page }) => {
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - 1)
    inicio.setHours(10, 0, 0, 0)
    const datos = [
        registro("breve-a", "Lectura breve", inicio, new Date(inicio.getTime() + 5000)),
        registro("breve-b", "Nota breve", new Date(inicio.getTime() + 8000), new Date(inicio.getTime() + 12_000)),
        registro("largo", "Bloque de media hora", new Date(inicio.getTime() + 60_000), new Date(inicio.getTime() + 31 * 60_000))
    ]
    const planes = [{
        id: "plan-breve",
        nombre: "Plan breve",
        eventoId: null,
        origenPuntual: true,
        categoriaIds: [],
        colorEvento: null,
        inicio: new Date(inicio.getTime() + 13_000).toISOString(),
        fin: new Date(inicio.getTime() + 45_000).toISOString()
    }]
    await page.addInitScript(({ clave, registros, clavePlanes, planesIniciales }) => {
        localStorage.setItem(clave, JSON.stringify(registros))
        localStorage.setItem(clavePlanes, JSON.stringify(planesIniciales))
    }, {
        clave: CLAVE_REGISTROS,
        registros: datos,
        clavePlanes: CLAVE_PLANES,
        planesIniciales: planes
    })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))

    const grupo = page.getByRole("button", { name: "Ver 3 actividades cercanas" })
    await expect(grupo).toBeVisible()
    const cajaGrupo = await grupo.boundingBox()
    expect(cajaGrupo.width).toBeGreaterThanOrEqual(28)
    expect(cajaGrupo.height).toBeGreaterThanOrEqual(28)
    await grupo.click()
    const lista = page.getByRole("dialog", { name: "3 actividades cercanas" })
    await expect(lista.getByRole("button", { name: /Lectura breve/ })).toBeVisible()
    await expect(lista.getByRole("button", { name: /Nota breve/ })).toBeVisible()
    await expect(lista.getByRole("button", { name: /Plan breve/ })).toContainText("Plan")
    await lista.getByRole("button", { name: /Nota breve/ }).click()
    await expect(page.getByRole("region", { name: "Nota breve" })).toBeVisible()
    await expect(page.getByRole("region", { name: "Bloque de media hora" })).toHaveCount(0)
    await page.getByRole("region", { name: "Nota breve" }).getByRole("button", { name: "Cerrar detalle" }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await grupo.click()
    await expect(lista).toBeVisible()
    expect(await lista.evaluate(elemento => getComputedStyle(elemento).bottom)).toBe("0px")
})

test("el zoom mantiene el calendario, cruza medianoche y conserva el calendario semanal móvil", async ({ page }) => {
    const dia = new Date()
    dia.setDate(dia.getDate() - 1)
    dia.setHours(23, 59, 50, 0)
    const siguienteDia = new Date(dia.getTime() + 20_000)
    const datos = [
        registro("cruce", "Actividad al cambio de día", dia, siguienteDia),
        registro("seleccion", "Actividad seleccionada", new Date(dia.getTime() - 30 * 60_000), new Date(dia.getTime() - 5 * 60_000))
    ]
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(({ clave, registros }) => localStorage.setItem(clave, JSON.stringify(registros)), {
        clave: CLAVE_REGISTROS,
        registros: datos
    })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fechaISO(dia))
    await page.getByRole("button", { name: "Semana", exact: true }).click()
    await page.getByRole("button", { name: "Grilla por horas" }).click()
    await page.getByRole("button", { name: /Actividad al cambio de día, sábado/ }).click()
    await page.getByRole("button", { name: "Acercar calendario" }).click()

    const zoom = page.locator(".calendario-semana-scroll")
    await expect(zoom).toBeVisible()
    await expect(page.locator(".calendario-separador-dia-semana")).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(zoom).toHaveCSS("overflow-x", "hidden")
    const seleccion = page.locator('.bloque-registro[aria-label*="Actividad al cambio de día"]').first()
    await expect(seleccion).toBeVisible()
    const cajaZoom = await zoom.boundingBox()
    const cajaSeleccion = await seleccion.boundingBox()
    const centroRelativo = (cajaSeleccion.y + cajaSeleccion.height / 2 - cajaZoom.y) / cajaZoom.height
    expect(centroRelativo).toBeGreaterThan(0.1)
    expect(centroRelativo).toBeLessThan(0.9)

    const salida = page.locator(".controles-zoom output")
    await expect(salida).toContainText("20 segundos")
    const rangoInicial = await salida.textContent()
    await zoom.evaluate(elemento => { elemento.scrollTop += 100 })
    await expect(salida).not.toHaveText(rangoInicial)
    const alturaZoom = await zoom.evaluate(elemento => ({ alto: elemento.clientHeight, contenido: elemento.scrollHeight }))
    expect(alturaZoom.contenido).toBeLessThan(alturaZoom.alto * 5)
    await page.getByRole("button", { name: "Restablecer", exact: true }).click()
    await expect(page.getByRole("table", { name: /^Semana del/ })).toBeVisible()
    await expect(page.getByRole("button", { name: "Grilla por horas" })).toHaveAttribute("aria-pressed", "true")
})
