import { expect, test } from "@playwright/test"

const CLAVE_PLANES = "focus.planes.v1"
const CLAVE_REGISTROS = "focus.registros.v1"
const CLAVE_SEGUIMIENTO = "focus.seguimiento-planificacion.v1"
const CLAVE_RECURRENCIAS = "focus.recurrencias.v1"

function crearPlanes(fecha, idAplicacion) {
    const inicio = (hora, minuto) => new Date(`${fecha}T${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}:00`).toISOString()
    const fin = (hora, minuto) => new Date(`${fecha}T${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}:00`).toISOString()
    const plan = (id, nombre, desde, hasta) => ({
        id,
        nombre,
        eventoId: null,
        origenPuntual: true,
        categoriaIds: [],
        colorEvento: null,
        inicio: inicio(...desde),
        fin: fin(...hasta),
        idAplicacionPlantilla: idAplicacion
    })
    return [
        plan("desayuno", "Desayunar", [9, 0], [9, 2]),
        plan("youtube", "Ver YouTube", [9, 0], [9, 2]),
        plan("mesa", "Sacar la mesa", [9, 2], [9, 4]),
        plan("mesada", "Limpiar la mesada", [9, 2], [9, 4]),
        plan("platos", "Lavar los platos", [9, 4], [9, 6])
    ]
}

function fechaDeHoy() {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
}

async function prepararSeguimiento(page, { movil = false, fallarInicio = false } = {}) {
    const fecha = fechaDeHoy()
    const planes = crearPlanes(fecha, "aplicacion-desayuno")
    await page.clock.install({ time: new Date(`${fecha}T09:00:00`) })
    if (movil) await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(({ planesIniciales, fallarInicio, clavePlanes, claveRegistros }) => {
        if (localStorage.getItem(clavePlanes) === null) localStorage.setItem(clavePlanes, JSON.stringify(planesIniciales))
        window.__falloInicioRegistro = { activo: false, escriturasPermitidas: 0, fallarInicio }
        const setItemOriginal = Storage.prototype.setItem
        Storage.prototype.setItem = function (clave, valor) {
            const fallo = window.__falloInicioRegistro
            if (fallo.fallarInicio && fallo.activo && clave === claveRegistros) {
                if (fallo.escriturasPermitidas > 0) fallo.escriturasPermitidas -= 1
                else throw new DOMException("Fallo de almacenamiento simulado para el inicio siguiente", "QuotaExceededError")
            }
            return setItemOriginal.call(this, clave, valor)
        }
    }, { planesIniciales: planes, fallarInicio, clavePlanes: CLAVE_PLANES, claveRegistros: CLAVE_REGISTROS })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fecha)
    const bloque = page.getByRole("region", { name: "Calendario" })
        .getByRole("group", { name: /Registros del/ })
        .getByRole("button", { name: /Planificado: Desayunar/ })
    if (await bloque.count()) {
        await bloque.focus()
        await bloque.press("Enter")
    } else {
        await page.getByRole("button", { name: /Ver \d+ actividades cercanas/ }).first().click()
        await page.getByRole("dialog").getByRole("button").filter({ hasText: "Desayunar" }).click()
    }
    const detalle = page.getByRole("region", { name: "Plan: Desayunar" })
    await detalle.getByRole("button", { name: "Seguir planificación" }).click()
    await detalle.getByRole("button", { name: "Desde el primer evento de esta planificación" }).click()
    return { fecha, planes, panel: page.getByRole("region", { name: "Siguiendo la planificación" }) }
}

function filaActiva(panel, nombre) {
    const region = panel.getByRole("region", { name: /Eventos? registrándose/ })
    return region.locator(`li:has(> strong:text-is("${nombre}"))`)
}

test("avanza etapas con el botón combinado y deja activas las paralelas anteriores", async ({ page }) => {
    const { planes, panel } = await prepararSeguimiento(page, { movil: true })
    const recurrenciasAntes = await page.evaluate(clave => localStorage.getItem(clave), CLAVE_RECURRENCIAS)
    await expect(panel.getByLabel("Modo de avance de la planificación").getByLabel(/Manual/)).toBeChecked()
    await page.clock.fastForward(1200)

    await filaActiva(panel, "Desayunar")
        .getByRole("button", { name: "Finalizar “Desayunar” y comenzar “Sacar la mesa”" }).click()
    await expect(filaActiva(panel, "Ver YouTube")).toBeVisible()
    await expect(filaActiva(panel, "Sacar la mesa")).toBeVisible()
    await expect(filaActiva(panel, "Limpiar la mesada")).toBeVisible()

    await page.clock.fastForward(1200)
    await filaActiva(panel, "Ver YouTube").getByRole("button", { name: "Finalizar “Ver YouTube”", exact: true }).click()
    await expect(filaActiva(panel, "Lavar los platos")).toHaveCount(0)

    await filaActiva(panel, "Sacar la mesa")
        .getByRole("button", { name: "Finalizar “Sacar la mesa” y comenzar “Lavar los platos”" }).click()
    await expect(filaActiva(panel, "Lavar los platos")).toBeVisible()
    await expect(filaActiva(panel, "Limpiar la mesada")).toBeVisible()

    const planesFinales = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_PLANES)
    expect(planesFinales).toEqual(planes)
    expect(await page.evaluate(clave => localStorage.getItem(clave), CLAVE_RECURRENCIAS)).toBe(recurrenciasAntes)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("permite avanzar explícitamente también en modo automático", async ({ page }) => {
    const { panel } = await prepararSeguimiento(page)
    await panel.getByLabel(/Automático/).check()
    await page.clock.fastForward(1200)

    await filaActiva(panel, "Desayunar")
        .getByRole("button", { name: "Finalizar “Desayunar” y comenzar “Sacar la mesa”" }).click()
    await expect(filaActiva(panel, "Sacar la mesa")).toBeVisible()
    await expect(filaActiva(panel, "Ver YouTube")).toBeVisible()
})

test("conserva y reintenta la transición fallida después de recargar, sin duplicar registros", async ({ page }) => {
    const { panel } = await prepararSeguimiento(page, { fallarInicio: true })
    await page.clock.fastForward(1200)
    await page.evaluate(() => {
        window.__falloInicioRegistro.activo = true
        window.__falloInicioRegistro.escriturasPermitidas = 1
    })

    await filaActiva(panel, "Desayunar")
        .getByRole("button", { name: "Finalizar “Desayunar” y comenzar “Sacar la mesa”" }).click()
    await expect(panel.getByRole("alert")).toContainText("no se pudo iniciar “Sacar la mesa”")
    let seguimiento = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_SEGUIMIENTO)
    expect(seguimiento.transicionPendiente.planIds).toContain("mesa")

    await page.reload()
    const panelRecargado = page.getByRole("region", { name: "Siguiendo la planificación" })
    const reintentar = panelRecargado.getByRole("button", { name: "Reintentar inicio de “Sacar la mesa”" })
    await expect(reintentar).toBeVisible()
    await reintentar.click()
    await expect(filaActiva(panelRecargado, "Sacar la mesa")).toBeVisible()

    seguimiento = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_SEGUIMIENTO)
    expect(seguimiento.transicionPendiente).toBeNull()
    const registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS)
    expect(registros.filter(registro => registro.planId === "desayuno")).toHaveLength(1)
    expect(registros.filter(registro => registro.planId === "mesa")).toHaveLength(1)
    expect(registros.find(registro => registro.planId === "youtube").estado).toBe("En curso")
})
