import { expect, test } from "@playwright/test"

const clavePlanes = "focus.planes.v1"
const claveRegistros = "focus.registros.v1"
const claveSeguimiento = "focus.seguimiento-planificacion.v1"
const claveEventos = "focus.plantillas-eventos.v1"

function datosHoy() {
    const hoy = new Date()
    const pad = numero => String(numero).padStart(2, "0")
    const fecha = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`
    return {
        fecha,
        hora: (hora, minuto) => `${fecha}T${pad(hora)}:${pad(minuto)}`,
        instante: (hora, minuto, segundo) => new Date(`${fecha}T${pad(hora)}:${pad(minuto)}:${pad(segundo)}`).toISOString()
    }
}

async function crearPlan(page, nombre, inicio, fin) {
    await page.getByRole("button", { name: "Planificar actividad", exact: true }).click()
    const formulario = page.getByRole("form", { name: "Planificar actividad" })
    await formulario.getByLabel("Nombre de la actividad").fill(nombre)
    await formulario.getByLabel("Inicio").fill(inicio)
    await formulario.getByLabel("Fin", { exact: true }).fill(fin)
    await formulario.getByRole("button", { name: "Guardar plan", exact: true }).click()
}

async function crearEvento(page, nombre) {
    await page.getByRole("button", { name: "Eventos", exact: true }).click()
    await page.getByRole("button", { name: "Crear evento", exact: true }).click()
    await page.getByLabel("Nombre", { exact: true }).fill(nombre)
    await page.getByRole("button", { name: "Guardar evento", exact: true }).click()
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
    await panelRecargado.getByRole("button", { name: "Continuar", exact: true }).click()
    await page.clock.fastForward(1100)
    await panelRecargado.getByRole("button", { name: "Finalizar y continuar con el próximo" }).click()
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

test("Flujo de usuario: edita próximos eventos sin mover los bloques y conserva paralelos", async ({ page }) => {
    const { fecha, hora } = datosHoy()
    await page.clock.install({ time: new Date() })
    await page.goto("/")
    await crearEvento(page, "Evento A")
    await crearEvento(page, "Evento B")
    await page.getByRole("button", { name: "Calendario", exact: true }).click()
    await page.getByLabel("Ir a fecha").fill(fecha)
    await crearPlan(page, "Evento actual", hora(9, 0), hora(9, 5))
    await crearPlan(page, "Evento A", hora(9, 5), hora(9, 20))
    await crearPlan(page, "Evento paralelo", hora(9, 10), hora(9, 25))
    await page.getByRole("button", { name: /Edición directa: desactivada/ }).click()

    await bloqueDelPlan(page, "Evento actual").click()
    const detalle = page.getByRole("region", { name: "Plan: Evento actual" })
    await detalle.getByRole("button", { name: "Seguir planificación" }).click()
    await detalle.getByRole("button", { name: "Desde este evento" }).click()

    const panel = page.getByRole("region", { name: "Siguiendo la planificación" })
    const gestion = panel.locator("details.seguimiento-plan-gestion")
    await gestion.locator("summary").click()
    const filaA = gestion.getByRole("listitem").filter({ hasText: "Evento A" })
    await filaA.getByRole("button", { name: "Mover Evento A después" }).click()

    let planes = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), clavePlanes)
    const antes = new Map(planes.map(plan => [plan.nombre, [plan.inicio, plan.fin]]))
    expect(planes.find(plan => plan.nombre === "Evento paralelo").ordenSeguimiento)
        .toBeLessThan(planes.find(plan => plan.nombre === "Evento A").ordenSeguimiento)
    expect(planes.map(plan => [plan.nombre, plan.inicio, plan.fin]))
        .toEqual(Array.from(antes, ([nombre, [inicio, fin]]) => [nombre, inicio, fin]))
    await expect(gestion.getByRole("listitem").nth(0)).toContainText("Evento paralelo")

    const plantillasOriginales = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveEventos)
    const filaAInicial = gestion.getByRole("listitem").nth(1)
    await expect(filaAInicial).toContainText("Evento A")
    await filaAInicial.getByRole("button", { name: "Editar" }).click()
    const editarA = page.getByRole("form", { name: "Editar actividad planificada" })
    await editarA.getByLabel("Plantilla de evento (opcional)").selectOption({ label: "Evento A" })
    await editarA.getByRole("button", { name: "Guardar cambios" }).click()
    planes = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), clavePlanes)
    const planA = planes.find(plan => plan.nombre === "Evento A")
    expect(planA.eventoId).toBe(plantillasOriginales.find(evento => evento.nombre === "Evento A").id)
    expect(await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveEventos))
        .toEqual(plantillasOriginales)

    await gestion.getByRole("button", { name: "Agregar como próximo evento" }).click()
    const formularioNuevo = page.getByRole("form", { name: "Planificar actividad" })
    await formularioNuevo.getByLabel("Nombre de la actividad").fill("Evento agregado")
    await formularioNuevo.getByLabel("Inicio").fill(hora(9, 12))
    await formularioNuevo.getByLabel("Fin", { exact: true }).fill(hora(9, 18))
    await formularioNuevo.getByRole("button", { name: "Guardar plan" }).click()
    await expect(gestion.getByRole("listitem").nth(0)).toContainText("Evento agregado")

    const formularioEditar = page.getByRole("listitem").filter({ hasText: "Evento agregado" })
    await formularioEditar.getByRole("button", { name: "Editar" }).click()
    const editar = page.getByRole("form", { name: "Editar actividad planificada" })
    await editar.getByLabel("Inicio").fill(hora(9, 13))
    await editar.getByLabel("Fin", { exact: true }).fill(hora(9, 19))
    await editar.getByRole("button", { name: "Guardar cambios" }).click()
    planes = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), clavePlanes)
    const agregado = planes.find(plan => plan.nombre === "Evento agregado")
    const horariosAgregado = await page.evaluate(fechaLocal => ({
        inicio: new Date(`${fechaLocal}T09:13`).toISOString(),
        fin: new Date(`${fechaLocal}T09:19`).toISOString()
    }), fecha)
    expect(agregado.inicio).toBe(horariosAgregado.inicio)
    expect(agregado.fin).toBe(horariosAgregado.fin)
    expect(planes.find(plan => plan.nombre === "Evento paralelo").inicio).toBe(antes.get("Evento paralelo")[0])
    const intervaloParalelo = planes.find(plan => plan.nombre === "Evento paralelo")
    expect(new Date(agregado.inicio) < new Date(intervaloParalelo.fin)
        && new Date(agregado.fin) > new Date(intervaloParalelo.inicio)).toBe(true)

    await gestion.getByRole("button", { name: "Agregar al final" }).click()
    const formularioFinal = page.getByRole("form", { name: "Planificar actividad" })
    await formularioFinal.getByLabel("Nombre de la actividad").fill("Evento final")
    await formularioFinal.getByLabel("Inicio").fill(hora(9, 30))
    await formularioFinal.getByLabel("Fin", { exact: true }).fill(hora(9, 35))
    await formularioFinal.getByRole("button", { name: "Guardar plan" }).click()
    await expect(gestion.getByRole("listitem").last()).toContainText("Evento final")

    const filaAActualizada = gestion.getByRole("listitem").nth(2)
    await expect(filaAActualizada).toContainText("Evento A")
    await filaAActualizada.getByRole("button", { name: "Mover Evento A antes" }).click()
    await gestion.getByRole("listitem").nth(1).getByRole("button", { name: "Mover Evento A después" }).click()
    await expect(gestion.getByRole("listitem").nth(0)).toContainText("Evento agregado")
    await expect(gestion.getByRole("listitem").nth(1)).toContainText("Evento paralelo")
    await expect(gestion.getByRole("listitem").nth(2)).toContainText("Evento A")
    await expect(gestion.getByRole("listitem").nth(3)).toContainText("Evento final")

    await gestion.getByRole("button", { name: "Agregar como próximo evento" }).click()
    const formularioEliminar = page.getByRole("form", { name: "Planificar actividad" })
    await formularioEliminar.getByLabel("Nombre de la actividad").fill("Evento temporal")
    await formularioEliminar.getByLabel("Inicio").fill(hora(9, 6))
    await formularioEliminar.getByLabel("Fin", { exact: true }).fill(hora(9, 8))
    await formularioEliminar.getByRole("button", { name: "Guardar plan" }).click()
    await expect(gestion.getByRole("listitem").first()).toContainText("Evento temporal")

    page.once("dialog", dialog => dialog.accept())
    const filaAEliminar = gestion.getByRole("listitem").first()
    await expect(filaAEliminar).toContainText("Evento temporal")
    await filaAEliminar.getByRole("button", { name: "Eliminar" }).click()
    planes = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), clavePlanes)
    expect(planes.some(plan => plan.nombre === "Evento temporal")).toBe(false)
    expect(planes.some(plan => plan.nombre === "Evento actual")).toBe(true)
    const ordenes = planes.filter(plan => ["Evento agregado", "Evento paralelo", "Evento A", "Evento final"].includes(plan.nombre))
        .sort((a, b) => a.ordenSeguimiento - b.ordenSeguimiento)
    expect(ordenes.map(plan => plan.nombre)).toEqual(["Evento agregado", "Evento paralelo", "Evento A", "Evento final"])

    const bloqueActivo = bloqueDelPlan(page, "Evento actual")
    await expect(bloqueActivo).not.toHaveClass(/bloque-plan-editable/)
    await bloqueActivo.click()
    await expect(page.getByRole("region", { name: "Plan: Evento actual" }))
        .toContainText("permanece bloqueado hasta que termine")

    const estadoAntesDeRecargar = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveSeguimiento)
    const idActivoAntesDeRecargar = estadoAntesDeRecargar.secuencia[estadoAntesDeRecargar.indiceActual].planId
    await page.reload()
    const panelRecargado = page.getByRole("region", { name: "Siguiendo la planificación" })
    await expect(panelRecargado).toContainText("Evento actual")
    const estadoRecargado = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveSeguimiento)
    expect(estadoRecargado.secuencia[estadoRecargado.indiceActual].planId).toBe(idActivoAntesDeRecargar)
    expect(estadoRecargado.secuencia[estadoRecargado.indiceActual + 1].planId).toBe(agregado.id)
    await expect(bloqueDelPlan(page, "Evento actual")).not.toHaveClass(/bloque-plan-editable/)

    await page.clock.fastForward(5 * 60_000)
    await expect(panelRecargado).toContainText("Evento agregado", { timeout: 5000 })
    const sesion = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveSeguimiento)
    expect(sesion.secuencia[sesion.indiceActual].planId).toBe(agregado.id)
})

test("Flujo de usuario: ante un fallo de guardado conserva planes y cola anteriores", async ({ page }) => {
    const { fecha, hora } = datosHoy()
    await page.clock.install({ time: new Date() })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fecha)
    await crearPlan(page, "Plan actual", hora(9, 0), hora(9, 5))
    await crearPlan(page, "Plan siguiente", hora(9, 5), hora(9, 10))
    await crearPlan(page, "Otro plan", hora(9, 10), hora(9, 15))
    await page.getByRole("button", { name: /Edición directa: desactivada/ }).click()

    await bloqueDelPlan(page, "Plan actual").click()
    const detalle = page.getByRole("region", { name: "Plan: Plan actual" })
    await detalle.getByRole("button", { name: "Seguir planificación" }).click()
    await detalle.getByRole("button", { name: "Desde este evento" }).click()

    const antes = await page.evaluate(claves => ({
        planes: localStorage.getItem(claves.planes),
        seguimiento: localStorage.getItem(claves.seguimiento)
    }), { planes: clavePlanes, seguimiento: claveSeguimiento })
    await page.evaluate(clave => {
        const guardarOriginal = Storage.prototype.setItem
        Storage.prototype.setItem = function (llave, valor) {
            if (llave === clave) throw new Error("Escritura bloqueada por prueba")
            return guardarOriginal.call(this, llave, valor)
        }
    }, clavePlanes)

    const panel = page.getByRole("region", { name: "Siguiendo la planificación" })
    const gestion = panel.locator("details.seguimiento-plan-gestion")
    await gestion.locator("summary").click()
    await gestion.getByRole("listitem").getByRole("button", { name: "Mover Plan siguiente después" }).click()
    await expect(gestion.getByRole("alert")).toContainText("No se pudieron guardar")
    expect(await page.evaluate(claves => ({
        planes: localStorage.getItem(claves.planes),
        seguimiento: localStorage.getItem(claves.seguimiento)
    }), { planes: clavePlanes, seguimiento: claveSeguimiento })).toEqual(antes)
    await expect(panel).toContainText("Plan actual")
    await expect(gestion.getByRole("listitem").first()).toContainText("Plan siguiente")
})

test("Flujo de usuario: registra en paralelo los eventos de una aplicación y conserva el excedente manual", async ({ page }) => {
    const { fecha, instante } = datosHoy()
    const idAplicacion = "aplicacion-seguimiento-paralelo"
    const planes = [
        { id: "plan-cocinar", nombre: "Cocinar", eventoId: null, colorEvento: "#0F766E", inicio: instante(9, 0, 0), fin: instante(9, 0, 2), idAplicacionPlantilla: idAplicacion },
        { id: "plan-comer", nombre: "Comer", eventoId: null, colorEvento: "#0F766E", inicio: instante(9, 0, 1), fin: instante(9, 0, 3), idAplicacionPlantilla: idAplicacion },
        { id: "plan-otra-aplicacion", nombre: "Plan ajeno", eventoId: null, colorEvento: "#0F766E", inicio: instante(9, 0, 0), fin: instante(9, 0, 5), idAplicacionPlantilla: "otra-aplicacion" }
    ]
    await page.clock.install({ time: new Date() })
    await page.addInitScript(({ planesIniciales, clavePlanes }) => {
        localStorage.setItem(clavePlanes, JSON.stringify(planesIniciales))
    }, { planesIniciales: planes, clavePlanes })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fecha)
    await bloqueDelPlan(page, "Cocinar").click()
    const detalle = page.getByRole("region", { name: "Plan: Cocinar" })
    await detalle.getByRole("button", { name: "Seguir planificación" }).click()
    await detalle.getByRole("button", { name: "Desde el primer evento de esta planificación" }).click()

    const panel = page.getByRole("region", { name: "Siguiendo la planificación" })
    await expect(panel.getByLabel("Modo de avance de la planificación").getByLabel(/Manual/)).toBeChecked()
    await page.clock.fastForward(1100)
    let registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros.filter(registro => registro.estado === "En curso").map(registro => registro.planId).sort())
        .toEqual(["plan-cocinar", "plan-comer"])
    await expect(panel).toContainText("En curso en paralelo")

    await page.reload()
    const panelRecargado = page.getByRole("region", { name: "Siguiendo la planificación" })
    await expect(panelRecargado.getByLabel("Modo de avance de la planificación").getByLabel(/Manual/)).toBeChecked()
    registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros.filter(registro => registro.estado === "En curso")).toHaveLength(2)

    await page.clock.fastForward(1500)
    await expect(panelRecargado).toContainText("Tiempo excedido")
    registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros.find(registro => registro.planId === "plan-cocinar").estado).toBe("En curso")
    expect(registros.find(registro => registro.planId === "plan-comer").estado).toBe("En curso")
    expect(registros.some(registro => registro.planId === "plan-otra-aplicacion")).toBe(false)

    await panelRecargado.getByRole("button", { name: "Finalizar “Cocinar”" }).click()
    registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros.find(registro => registro.planId === "plan-cocinar").estado).toBe("Finalizado")
    expect(registros.find(registro => registro.planId === "plan-comer").estado).toBe("En curso")
    await panelRecargado.getByRole("button", { name: "Finalizar “Comer”" }).click()
    await expect(panelRecargado).toHaveCount(0)
})

test("Flujo de usuario: el modo automático termina cada evento al cumplirse su duración", async ({ page }) => {
    const { fecha, instante } = datosHoy()
    const idAplicacion = "aplicacion-seguimiento-automatico"
    const planes = [
        { id: "plan-uno", nombre: "Evento uno", eventoId: null, colorEvento: "#0F766E", inicio: instante(9, 0, 0), fin: instante(9, 0, 2), idAplicacionPlantilla: idAplicacion },
        { id: "plan-dos", nombre: "Evento dos", eventoId: null, colorEvento: "#0F766E", inicio: instante(9, 0, 1), fin: instante(9, 0, 3), idAplicacionPlantilla: idAplicacion },
        { id: "plan-tres", nombre: "Evento tres", eventoId: null, colorEvento: "#0F766E", inicio: instante(9, 0, 3), fin: instante(9, 0, 4), idAplicacionPlantilla: idAplicacion }
    ]
    await page.clock.install({ time: new Date() })
    await page.addInitScript(({ planesIniciales, clavePlanes }) => {
        localStorage.setItem(clavePlanes, JSON.stringify(planesIniciales))
    }, { planesIniciales: planes, clavePlanes })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fecha)
    await bloqueDelPlan(page, "Evento uno").focus()
    await bloqueDelPlan(page, "Evento uno").press("Enter")
    const detalle = page.getByRole("region", { name: "Plan: Evento uno" })
    await detalle.getByRole("button", { name: "Seguir planificación" }).click()
    await detalle.getByRole("button", { name: "Desde el primer evento de esta planificación" }).click()
    const panel = page.getByRole("region", { name: "Siguiendo la planificación" })
    await panel.getByLabel(/Automático/).check()

    await page.clock.fastForward(1100)
    let registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros.find(registro => registro.planId === "plan-dos").estado).toBe("En curso")
    await page.clock.fastForward(1100)
    registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros.find(registro => registro.planId === "plan-uno").estado).toBe("Finalizado")
    expect(registros.find(registro => registro.planId === "plan-dos")?.estado,
        JSON.stringify({ registros, seguimiento: await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveSeguimiento) }))
        .toBe("En curso")
    expect(registros.some(registro => registro.planId === "plan-tres")).toBe(false)
    await page.clock.fastForward(1200)
    const registrosSiguientes = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registrosSiguientes.find(registro => registro.planId === "plan-dos").estado).toBe("Finalizado")
    expect(registrosSiguientes.find(registro => registro.planId === "plan-tres").estado).toBe("En curso")
    await expect(panel).toContainText("Evento tres")
})

test("Flujo de usuario: omite un evento futuro sin quitarlo del calendario y continúa tras el paralelo", async ({ page }) => {
    const { fecha, instante } = datosHoy()
    const idAplicacion = "aplicacion-seguimiento-omision"
    const planes = [
        { id: "plan-actual-omision", nombre: "Preparar", eventoId: null, colorEvento: "#0F766E", inicio: instante(9, 0, 0), fin: instante(9, 0, 2), idAplicacionPlantilla: idAplicacion },
        { id: "plan-omitido", nombre: "Paso opcional", eventoId: null, colorEvento: "#0F766E", inicio: instante(9, 0, 1), fin: instante(9, 0, 3), idAplicacionPlantilla: idAplicacion },
        { id: "plan-despues-omision", nombre: "Continuar", eventoId: null, colorEvento: "#0F766E", inicio: instante(9, 0, 3), fin: instante(9, 0, 4), idAplicacionPlantilla: idAplicacion }
    ]
    await page.clock.install({ time: new Date() })
    await page.addInitScript(({ planesIniciales, clavePlanes }) => {
        localStorage.setItem(clavePlanes, JSON.stringify(planesIniciales))
    }, { planesIniciales: planes, clavePlanes })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fecha)
    await bloqueDelPlan(page, "Preparar").focus()
    await bloqueDelPlan(page, "Preparar").press("Enter")
    const detalle = page.getByRole("region", { name: "Plan: Preparar" })
    await detalle.getByRole("button", { name: "Seguir planificación" }).click()
    await detalle.getByRole("button", { name: "Desde el primer evento de esta planificación" }).click()
    const panel = page.getByRole("region", { name: "Siguiendo la planificación" })
    const gestion = panel.locator("details.seguimiento-plan-gestion")
    await gestion.locator("summary").click()
    const pasoOpcional = gestion.getByRole("listitem").filter({ hasText: "Paso opcional" })
    await pasoOpcional.getByRole("button", { name: "Omitir Paso opcional en este seguimiento" }).click()

    const seguimiento = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveSeguimiento)
    expect(seguimiento.eventosOmitidos).toContain("plan-omitido")
    expect((await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), clavePlanes))
        .some(plan => plan.id === "plan-omitido")).toBe(true)

    await page.clock.fastForward(2200)
    await panel.getByRole("button", { name: "Finalizar “Preparar”" }).click()
    const registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros.some(registro => registro.planId === "plan-omitido")).toBe(false)
    expect(registros.find(registro => registro.planId === "plan-despues-omision").estado).toBe("En curso")
})

test("Flujo de usuario: editar un evento futuro de la aplicación actualiza calendario y seguimiento sin alterar el activo", async ({ page }) => {
    const { fecha, hora } = datosHoy()
    const idAplicacion = "aplicacion-edicion-seguimiento"
    const planes = [
        { id: "plan-activo-edicion", nombre: "Preparar", eventoId: null, colorEvento: "#0F766E", inicio: new Date(hora(9, 0)).toISOString(), fin: new Date(hora(9, 30)).toISOString(), idAplicacionPlantilla: idAplicacion },
        { id: "plan-futuro-edicion", nombre: "Almorzar", eventoId: null, colorEvento: "#0F766E", inicio: new Date(hora(9, 5)).toISOString(), fin: new Date(hora(9, 20)).toISOString(), idAplicacionPlantilla: idAplicacion }
    ]
    await page.clock.install({ time: new Date() })
    await page.addInitScript(({ planesIniciales, clavePlanes }) => {
        localStorage.setItem(clavePlanes, JSON.stringify(planesIniciales))
    }, { planesIniciales: planes, clavePlanes })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fecha)
    await bloqueDelPlan(page, "Preparar").click()
    const detalle = page.getByRole("region", { name: "Plan: Preparar" })
    await detalle.getByRole("button", { name: "Seguir planificación" }).click()
    await detalle.getByRole("button", { name: "Desde el primer evento de esta planificación" }).click()
    const panel = page.getByRole("region", { name: "Siguiendo la planificación" })
    const gestion = panel.locator("details.seguimiento-plan-gestion")
    await gestion.locator("summary").click()
    await gestion.getByRole("listitem").filter({ hasText: "Almorzar" }).getByRole("button", { name: "Editar" }).click()
    const formulario = page.getByRole("form", { name: "Editar actividad planificada" })
    await formulario.getByLabel("Fin", { exact: true }).fill(hora(9, 25))
    await formulario.getByRole("button", { name: "Guardar cambios" }).click()

    const planesActualizados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), clavePlanes)
    const seguimiento = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveSeguimiento)
    expect(planesActualizados.find(plan => plan.id === "plan-futuro-edicion").fin)
        .toBe(new Date(hora(9, 25)).toISOString())
    expect(seguimiento.secuencia.find(item => item.planId === "plan-futuro-edicion").duracionMs).toBe(20 * 60_000)
    expect(seguimiento.secuencia[seguimiento.indiceActual].planId).toBe("plan-activo-edicion")
    const registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros).toHaveLength(1)
    expect(registros[0].planId).toBe("plan-activo-edicion")
    await expect(gestion.getByRole("listitem").filter({ hasText: "Almorzar" })).toContainText("09:25")
})
