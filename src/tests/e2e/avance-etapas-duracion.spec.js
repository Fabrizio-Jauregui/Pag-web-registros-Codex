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

function crearPlanesConEspera(fecha, { paralela = false } = {}) {
    const instante = (hora, minuto) => new Date(`${fecha}T${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}:00`).toISOString()
    const plan = (id, nombre, desde, hasta) => ({
        id,
        nombre,
        eventoId: null,
        origenPuntual: true,
        categoriaIds: [],
        colorEvento: null,
        inicio: instante(...desde),
        fin: instante(...hasta),
        idAplicacionPlantilla: "aplicacion-con-espera"
    })
    return [
        plan("desayuno", "Desayunar", [9, 0], [9, 10]),
        plan("sacar-mesa", "Sacar la mesa", [9, 10], [9, 12]),
        ...(paralela ? [plan("limpiar-mesada", "Limpiar la mesada", [9, 10], [9, 12])] : []),
        plan("lavar-platos", "Lavar los platos", [9, 12], [9, 14])
    ]
}

function fechaDeHoy() {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
}

async function prepararSeguimiento(page, { movil = false, fallarInicio = false, planesIniciales = null } = {}) {
    const fecha = fechaDeHoy()
    const planes = planesIniciales ?? crearPlanes(fecha, "aplicacion-desayuno")
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

test("inicia la siguiente etapa al instante y deshacer revierte solo la transición", async ({ page }) => {
    const { planes, panel } = await prepararSeguimiento(page, { movil: true })
    const recurrenciasAntes = await page.evaluate(clave => localStorage.getItem(clave), CLAVE_RECURRENCIAS)
    await expect(panel.getByLabel("Modo de avance de la planificación").getByLabel(/Manual/)).toBeChecked()
    await page.clock.fastForward(1200)

    await filaActiva(panel, "Desayunar")
        .getByRole("button", { name: "Finalizar “Desayunar” y comenzar “Sacar la mesa”" }).click()
    await expect(panel.getByRole("region", { name: "Finalizaciones que podés deshacer" })).toBeVisible()
    await expect(filaActiva(panel, "Sacar la mesa")).toBeVisible()
    await panel.getByRole("region", { name: "Finalizaciones que podés deshacer" })
        .getByRole("button", { name: "Deshacer finalización de Desayunar" }).click()
    await expect(filaActiva(panel, "Desayunar")).toBeVisible()
    await expect(filaActiva(panel, "Sacar la mesa")).toHaveCount(0)
    await filaActiva(panel, "Desayunar")
        .getByRole("button", { name: "Finalizar “Desayunar” y comenzar “Sacar la mesa”" }).click()
    await expect(filaActiva(panel, "Sacar la mesa")).toBeVisible()
    await page.clock.fastForward(120_000)
    await expect(filaActiva(panel, "Ver YouTube")).toBeVisible()
    await expect(filaActiva(panel, "Sacar la mesa")).toBeVisible()
    await expect(filaActiva(panel, "Limpiar la mesada")).toBeVisible()

    await page.clock.fastForward(1200)
    await filaActiva(panel, "Ver YouTube").getByRole("button", { name: "Finalizar “Ver YouTube”", exact: true }).click()
    await page.clock.fastForward(120_000)
    await expect(filaActiva(panel, "Lavar los platos")).toHaveCount(0)

    await filaActiva(panel, "Sacar la mesa")
        .getByRole("button", { name: "Finalizar “Sacar la mesa” y comenzar “Lavar los platos”" }).click()
    await page.clock.fastForward(120_000)
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
    await page.clock.fastForward(120_000)
    await expect(filaActiva(panel, "Sacar la mesa")).toBeVisible()
    await expect(filaActiva(panel, "Ver YouTube")).toHaveCount(0)
    const registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS)
    expect(registros.find(item => item.planId === "youtube").estado).toBe("Finalizado")
})

test("permite adelantar una etapa pendiente sin actividad activa en modo manual y conserva paralelos y horarios del calendario", async ({ page }) => {
    const fecha = fechaDeHoy()
    const planes = crearPlanesConEspera(fecha, { paralela: true })
    const { panel } = await prepararSeguimiento(page, { planesIniciales: planes })
    await page.clock.fastForward(1200)

    await filaActiva(panel, "Desayunar").getByRole("button", { name: "Finalizar “Desayunar”", exact: true }).click()
    await page.clock.fastForward(120_000)
    const continuar = panel.getByRole("region", { name: "Continuar planificación" })
    await expect(continuar).toContainText("Limpiar la mesada")
    await expect(continuar.getByRole("button", { name: "Iniciar “Limpiar la mesada” ahora" })).toBeVisible()

    const planesAntes = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_PLANES)
    const registroYoutube = page.getByRole("group", { name: "Origen de la actividad" }).last()
    await registroYoutube.getByLabel("Actividad puntual").check()
    await page.getByLabel("Nombre de la actividad").fill("Ver YouTube")
    await page.getByRole("button", { name: "Iniciar", exact: true }).click()
    await expect(page.getByRole("article", { name: "Actividad activa: Ver YouTube" })).toBeVisible()

    await continuar.getByRole("button", { name: "Iniciar “Limpiar la mesada” ahora" }).click()
    await expect(filaActiva(panel, "Sacar la mesa")).toBeVisible()
    await expect(filaActiva(panel, "Limpiar la mesada")).toBeVisible()
    await expect(page.getByRole("article", { name: "Actividad activa: Ver YouTube" })).toBeVisible()

    const planesDespues = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_PLANES)
    expect(planesDespues).toEqual(planesAntes)
    const seguimiento = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_SEGUIMIENTO)
    const desplazamientoParalelo = seguimiento.secuencia.find(item => item.planId === "limpiar-mesada").inicioOffsetMs
        - seguimiento.secuencia.find(item => item.planId === "sacar-mesa").inicioOffsetMs
    expect(desplazamientoParalelo).toBe(0)
    const registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS)
    expect(registros.filter(registro => registro.planId === "sacar-mesa")).toHaveLength(1)
    expect(registros.find(registro => registro.nombre === "Ver YouTube").estado).toBe("En curso")
})

test("permite adelantar manualmente la etapa pendiente en modo automático durante un hueco horario", async ({ page }) => {
    const fecha = fechaDeHoy()
    const planes = crearPlanesConEspera(fecha)
    const { panel } = await prepararSeguimiento(page, { planesIniciales: planes })
    await panel.getByLabel(/Automático/).check()

    await page.clock.fastForward(1200)
    await filaActiva(panel, "Desayunar").getByRole("button", { name: "Finalizar “Desayunar”", exact: true }).click()
    await page.clock.fastForward(120_000)
    await expect(filaActiva(panel, "Desayunar")).toHaveCount(0)
    const continuar = panel.getByRole("region", { name: "Continuar planificación" })
    await expect(continuar).toContainText("Sacar la mesa")
    await continuar.getByRole("button", { name: "Iniciar “Sacar la mesa” ahora" }).click()
    await expect(filaActiva(panel, "Sacar la mesa")).toBeVisible()
    const seguimiento = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_SEGUIMIENTO)
    expect(seguimiento.modoAvance).toBe("automatico")
    expect(seguimiento.transicionPendiente).toBeNull()
})

test("conserva el siguiente paso si Focus bloquea su inicio y permite reintentarlo al pausar Focus", async ({ page }) => {
    const fecha = fechaDeHoy()
    const planes = crearPlanesConEspera(fecha)
    const { panel } = await prepararSeguimiento(page, { planesIniciales: planes })
    await page.clock.fastForward(1200)
    await filaActiva(panel, "Desayunar").getByRole("button", { name: "Finalizar “Desayunar”", exact: true }).click()
    await page.clock.fastForward(120_000)

    await page.getByRole("button", { name: "Focus", exact: true }).click()
    const vistaFocus = page.getByRole("region", { name: "Focus" })
    const prepararFocus = vistaFocus.getByRole("region", { name: "Preparar sesión" })
    await prepararFocus.getByLabel("Actividad puntual").check()
    await vistaFocus.getByLabel("Nombre de la actividad").fill("Estudiar")
    await vistaFocus.getByLabel("Pares de bloques").selectOption("1")
    await vistaFocus.getByLabel("Concentración inicial (min)").fill("1")
    await vistaFocus.getByLabel("Descanso inicial (min)").fill("1")
    await vistaFocus.getByRole("button", { name: "Generar bloques" }).click()
    await vistaFocus.getByRole("button", { name: "Confirmar bloques" }).click()
    await vistaFocus.getByRole("button", { name: "Iniciar sesión Focus" }).click()
    await expect(vistaFocus.getByRole("button", { name: "Pausar sesión" })).toBeVisible()

    await page.getByRole("button", { name: "Calendario", exact: true }).click()
    const continuar = panel.getByRole("region", { name: "Continuar planificación" })
    const iniciarSiguiente = continuar.getByRole("button", { name: "Iniciar “Sacar la mesa” ahora" })
    await iniciarSiguiente.click()
    await expect(panel.getByRole("alert")).toContainText("No se puede iniciar otra actividad mientras Focus está en concentración")
    await expect(iniciarSiguiente).toBeVisible()
    await expect(panel).toContainText("Esperando para iniciar: Sacar la mesa")

    await page.getByRole("button", { name: "Focus", exact: true }).click()
    await vistaFocus.getByRole("button", { name: "Pausar sesión" }).click()
    await page.getByRole("button", { name: "Calendario", exact: true }).click()
    await iniciarSiguiente.click()
    await expect(filaActiva(panel, "Sacar la mesa")).toBeVisible()
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
    await expect(panel.getByRole("alert")).toContainText("no se pudo iniciar el siguiente")
    await expect(panel.getByRole("region", { name: "Finalizaciones que podés deshacer" })
        .getByRole("button", { name: "Deshacer finalización de Desayunar" })).toBeVisible()
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

    await panelRecargado.getByRole("region", { name: "Finalizaciones que podés deshacer" })
        .getByRole("button", { name: "Deshacer finalización de Desayunar" }).click()
    const despuesDeDeshacer = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS)
    expect(despuesDeDeshacer.filter(registro => registro.planId === "desayuno")).toHaveLength(1)
    expect(despuesDeDeshacer.filter(registro => registro.planId === "mesa")).toHaveLength(0)
    await expect(filaActiva(panelRecargado, "Desayunar")).toBeVisible()
})

test("deshace una finalización simple tras recargar y conserva el mismo registro", async ({ page }) => {
    const { panel } = await prepararSeguimiento(page, { planesIniciales: crearPlanesConEspera(fechaDeHoy()) })
    await page.clock.fastForward(2200)
    await filaActiva(panel, "Desayunar").getByRole("button", { name: "Finalizar “Desayunar”", exact: true }).click()

    const pendienteAntes = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_SEGUIMIENTO)
    const registroId = pendienteAntes.finalizacionesPendientes[0].registroId
    expect(pendienteAntes.finalizacionesPendientes).toHaveLength(1)
    const registroAntes = (await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS))
        .find(item => item.id === registroId)
    expect(registroAntes.estado).toBe("Finalizado")
    expect(pendienteAntes.registrosActivos.some(item => item.planId === "desayuno")).toBe(false)

    await page.clock.fastForward(4000)
    await page.reload()
    const panelRecargado = page.getByRole("region", { name: "Siguiendo la planificación" })
    const aviso = panelRecargado.getByRole("region", { name: "Finalizaciones que podés deshacer" })
    await expect(aviso.getByRole("button", { name: "Deshacer finalización de Desayunar" })).toBeVisible()
    await aviso.getByRole("button", { name: "Deshacer finalización de Desayunar" }).click()

    const seguimiento = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_SEGUIMIENTO)
    const registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS)
    expect(seguimiento.finalizacionesPendientes).toEqual([])
    expect(seguimiento.finalizados).not.toContain("desayuno")
    expect(seguimiento.registrosActivos.find(item => item.planId === "desayuno").registroId).toBe(registroId)
    expect(registros.find(item => item.id === registroId).estado).toBe("En curso")
    expect(registros.find(item => item.id === registroId).segmentos.at(-1).fin).toBeNull()
    expect(registros.filter(item => item.planId === "desayuno")).toHaveLength(1)
    await expect(filaActiva(panelRecargado, "Desayunar")).toBeVisible()
    await expect(filaActiva(panelRecargado, "Sacar la mesa")).toHaveCount(0)
})

test("el botón combinado avanza al instante y deshacer retira sus registros sin mover horarios", async ({ page }) => {
    const { panel, planes } = await prepararSeguimiento(page, { planesIniciales: crearPlanesConEspera(fechaDeHoy()) })
    const seguimientoAntes = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_SEGUIMIENTO)
    await page.clock.fastForward(1200)
    await filaActiva(panel, "Desayunar")
        .getByRole("button", { name: "Finalizar “Desayunar” y comenzar “Sacar la mesa”" }).click()
    await expect(filaActiva(panel, "Desayunar")).toHaveCount(0)
    await expect(filaActiva(panel, "Sacar la mesa")).toBeVisible()
    await page.clock.fastForward(5000)
    await panel.getByRole("region", { name: "Finalizaciones que podés deshacer" })
        .getByRole("button", { name: "Deshacer finalización de Desayunar" }).click()

    const seguimientoDespues = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_SEGUIMIENTO)
    expect(seguimientoDespues.secuencia.map(item => item.inicioOffsetMs ?? 0))
        .toEqual(seguimientoAntes.secuencia.map(item => item.inicioOffsetMs ?? 0))
    expect(await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_PLANES)).toEqual(planes)
    const registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS)
    expect(registros.some(item => item.planId === "sacar-mesa")).toBe(false)
    await expect(filaActiva(panel, "Desayunar")).toBeVisible()
    await expect(filaActiva(panel, "Sacar la mesa")).toHaveCount(0)
})

test("el avance combinado ocurre antes de que venza la ventana y conserva ambos registros", async ({ page }) => {
    const { panel } = await prepararSeguimiento(page, { planesIniciales: crearPlanesConEspera(fechaDeHoy()) })
    await page.clock.fastForward(1200)
    await filaActiva(panel, "Desayunar")
        .getByRole("button", { name: "Finalizar “Desayunar” y comenzar “Sacar la mesa”" }).click()
    await expect(filaActiva(panel, "Sacar la mesa")).toBeVisible()
    await page.clock.fastForward(4000)
    await page.reload()
    const panelRecargado = page.getByRole("region", { name: "Siguiendo la planificación" })
    await expect(panelRecargado.getByRole("region", { name: "Finalizaciones que podés deshacer" })).toBeVisible()
    await page.clock.fastForward(116_000)

    await expect(filaActiva(panelRecargado, "Desayunar")).toHaveCount(0)
    await expect(filaActiva(panelRecargado, "Sacar la mesa")).toBeVisible()
    const registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS)
    expect(registros.filter(item => item.planId === "desayuno")).toHaveLength(1)
    expect(registros.find(item => item.planId === "desayuno").estado).toBe("Finalizado")
    expect(registros.find(item => item.planId === "sacar-mesa").estado).toBe("En curso")
})

test("cada actividad paralela tiene su propio deshacer", async ({ page }) => {
    const { panel } = await prepararSeguimiento(page, { planesIniciales: crearPlanes(fechaDeHoy(), "aplicacion-paralela") })
    await page.clock.fastForward(1200)
    await filaActiva(panel, "Desayunar").getByRole("button", { name: "Finalizar “Desayunar”", exact: true }).click()
    await filaActiva(panel, "Ver YouTube").getByRole("button", { name: "Finalizar “Ver YouTube”", exact: true }).click()
    const aviso = panel.getByRole("region", { name: "Finalizaciones que podés deshacer" })
    await expect(aviso.getByRole("button", { name: "Deshacer finalización de Desayunar" })).toBeVisible()
    await expect(aviso.getByRole("button", { name: "Deshacer finalización de Ver YouTube" })).toBeVisible()
    await aviso.getByRole("button", { name: "Deshacer finalización de Desayunar" }).click()
    await expect(aviso.getByRole("button", { name: "Deshacer finalización de Desayunar" })).toHaveCount(0)
    await expect(aviso.getByRole("button", { name: "Deshacer finalización de Ver YouTube" })).toBeVisible()
    await expect(filaActiva(panel, "Desayunar")).toBeVisible()
})

test("el deshacer no retrasa el avance automático de la planificación", async ({ page }) => {
    const { panel } = await prepararSeguimiento(page, { planesIniciales: crearPlanesConEspera(fechaDeHoy()) })
    await panel.getByLabel(/Automático/).check()
    await page.clock.fastForward(1200)
    await filaActiva(panel, "Desayunar").getByRole("button", { name: "Finalizar “Desayunar”", exact: true }).click()
    const aviso = panel.getByRole("region", { name: "Finalizaciones que podés deshacer" })
    await expect(aviso).toContainText("120 s")
    await page.clock.fastForward(120_000)
    await expect(panel.getByRole("region", { name: "Finalizaciones que podés deshacer" })).toHaveCount(0)
    await expect(filaActiva(panel, "Sacar la mesa")).toHaveCount(0)
    await page.clock.fastForward(8 * 60_000)
    await expect(filaActiva(panel, "Sacar la mesa")).toBeVisible()
    const registrosDuranteLaEspera = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS)
    expect(registrosDuranteLaEspera.find(item => item.planId === "desayuno").estado).toBe("Finalizado")

    const registrosAlConfirmar = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), CLAVE_REGISTROS)
    expect(registrosAlConfirmar.find(item => item.planId === "desayuno").estado).toBe("Finalizado")
})
