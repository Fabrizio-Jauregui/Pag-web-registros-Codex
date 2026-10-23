import { expect, test } from "@playwright/test"

const claveTareas = "focus.tareas.v1"
const claveRegistros = "focus.registros.v1"

const tarea = {
    id: "tarea-v15-lectura",
    nombre: "Leer documentación",
    estado: "Pendiente",
    destino: "focus",
    ordenFocus: 1,
    creadaEn: "2026-10-18T12:00:00.000Z",
    actualizadaEn: "2026-10-18T12:00:00.000Z"
}
const tareaAlternativa = {
    ...tarea,
    id: "tarea-v15-lectura-alternativa",
    nombre: "Revisar apuntes",
    ordenFocus: 2
}

async function cargarTarea(page) {
    await page.addInitScript(({ clave, valores }) => localStorage.setItem(clave, JSON.stringify(valores)), { clave: claveTareas, valores: [tarea, tareaAlternativa] })
}

async function cargarCola(page, cantidad = 3) {
    const cola = Array.from({ length: cantidad }, (_, indice) => ({
        ...tarea,
        id: `tarea-cola-${indice + 1}`,
        nombre: `Tarea cola ${indice + 1}`,
        destino: "focus",
        ordenFocus: indice + 1
    }))
    const backlog = { ...tarea, id: "tarea-backlog", nombre: "Tarea de backlog", destino: "backlog", ordenFocus: null }
    await page.addInitScript(({ clave, valores }) => localStorage.setItem(clave, JSON.stringify(valores)), {
        clave: claveTareas,
        valores: [...cola, backlog]
    })
    return { cola, backlog }
}

async function iniciarFocusConCola(page, pares = 1) {
    await page.goto("/")
    await page.getByRole("button", { name: "Focus", exact: true }).click()
    const vista = page.getByRole("region", { name: "Focus" })
    const configuracion = vista.locator(".focus-configuracion")
    await configuracion.getByLabel("Usar Cola Focus para asignar las tareas de cada concentración").check()
    await configuracion.getByLabel("Pares de bloques").selectOption(String(pares))
    await configuracion.getByLabel("Concentración inicial (min)").fill("2")
    await configuracion.getByLabel("Descanso inicial (min)").fill("1")
    await vista.getByRole("button", { name: "Generar bloques" }).click()
    await vista.getByRole("button", { name: "Confirmar bloques" }).click()
    await vista.getByRole("button", { name: "Iniciar sesión Focus" }).click()
    return vista
}

function fechaLocal(fecha) {
    const dosDigitos = valor => String(valor).padStart(2, "0")
    const hora = `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`
    return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}T${hora}${fecha.getSeconds() === 0 ? "" : `:${dosDigitos(fecha.getSeconds())}`}`
}

test("Flujo de usuario: vincula una tarea a un registro manual, lo conserva y protege la tarea de borrado", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 18, 15, 0, 0) })
    await cargarTarea(page)
    await page.goto("/")
    await page.getByRole("button", { name: "Nuevo registro", exact: true }).click()
    const formulario = page.getByRole("form", { name: "Nuevo registro manual" })
    await formulario.getByLabel("Tarea (opcional)").selectOption(tarea.id)
    await formulario.getByLabel("Nombre de la actividad").fill("Leer capítulo")
    await formulario.getByLabel("Inicio").fill(fechaLocal(new Date(2026, 9, 18, 14, 55, 0)))
    await formulario.getByLabel("Fin").fill(fechaLocal(new Date(2026, 9, 18, 14, 56, 0)))
    await formulario.getByRole("button", { name: "Crear registro", exact: true }).click()
    await expect(page.getByRole("region", { name: "Leer capítulo" })).toContainText(`Tarea: ${tarea.nombre}`)

    let registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros).toHaveLength(1)
    expect(registros[0]).toMatchObject({ tareaId: tarea.id, tareaNombre: tarea.nombre })
    expect(registros[0].segmentos[0].fin).toBe("2026-10-18T17:56:00.000Z")

    await page.getByRole("button", { name: "Tareas", exact: true }).click()
    const filaTarea = page.getByRole("listitem").filter({ hasText: tarea.nombre })
    page.once("dialog", dialog => dialog.accept())
    await filaTarea.getByRole("button", { name: "Eliminar" }).click()
    await expect(page.getByRole("alert")).toContainText("vinculada a uno o más registros")
    await expect(filaTarea).toBeVisible()

    await page.reload()
    registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros[0].tareaId).toBe(tarea.id)

    await page.getByRole("button", { name: /Leer capítulo/ }).click()
    const detalle = page.getByRole("region", { name: "Leer capítulo" })
    await detalle.getByRole("button", { name: "Editar registro" }).click()
    const edicion = page.getByRole("form", { name: "Editar registro finalizado" })
    await edicion.getByLabel("Tarea (opcional)").selectOption(tareaAlternativa.id)
    await edicion.getByRole("button", { name: "Guardar cambios" }).click()

    registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros[0]).toMatchObject({ tareaId: tareaAlternativa.id, tareaNombre: tareaAlternativa.nombre })
    await expect(page.getByRole("region", { name: "Leer capítulo" })).toContainText(`Tarea: ${tareaAlternativa.nombre}`)
})

test("Flujo de usuario: la sesión Focus inicia y registra la primera tarea de Cola Focus", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 18, 15, 0, 0) })
    await cargarTarea(page)
    await page.goto("/")
    await page.getByRole("button", { name: "Focus", exact: true }).click()
    const vista = page.getByRole("region", { name: "Focus" })
    const configuracion = vista.locator(".focus-configuracion")
    await configuracion.getByLabel("Usar Cola Focus para asignar las tareas de cada concentración").check()
    await configuracion.getByLabel("Pares de bloques").selectOption("1")
    await configuracion.getByLabel("Concentración inicial (min)").fill("1")
    await configuracion.getByLabel("Descanso inicial (min)").fill("1")
    await vista.getByRole("button", { name: "Generar bloques" }).click()
    await vista.getByRole("button", { name: "Confirmar bloques" }).click()
    await vista.getByRole("button", { name: "Iniciar sesión Focus" }).click()

    await expect(vista.locator(".focus-sesion-activa").getByText(`Tarea activa: ${tarea.nombre}`)).toBeVisible()
    await page.clock.runFor(2_100)
    const registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros).toHaveLength(1)
    expect(registros[0]).toMatchObject({ tareaId: tarea.id, tareaNombre: tarea.nombre, estado: "En curso" })
    expect(registros[0].segmentos).toHaveLength(1)
    const tareas = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveTareas)
    expect(tareas.find(item => item.id === tarea.id).estado).toBe("En curso")
    expect(tareas.find(item => item.id === tareaAlternativa.id).estado).toBe("Pendiente")
})

test("Flujo de usuario: posponer y completar tareas cambia el registro activo sin duplicar tiempo", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 18, 15, 0, 0) })
    const { cola } = await cargarCola(page, 3)
    const vista = await iniciarFocusConCola(page)
    const sesion = vista.locator(".focus-sesion-activa")
    const lista = sesion.locator(".focus-cola-lista")
    await expect(lista.locator("li").first()).toContainText(cola[0].nombre)

    await page.clock.runFor(2_100)
    await sesion.getByRole("button", { name: "Posponer después de la siguiente" }).click()
    await expect(lista.locator("li").first()).toContainText(cola[1].nombre)
    await expect(lista.locator("li").nth(1)).toContainText(cola[0].nombre)

    await page.clock.runFor(2_100)
    await sesion.getByRole("button", { name: "Finalicé esta tarea" }).click()
    await expect(lista.locator("li").first()).toContainText(cola[0].nombre)
    await expect(lista.locator("li")).toHaveCount(2)
    await page.clock.runFor(2_100)

    const tareas = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveTareas)
    expect(tareas.find(item => item.id === cola[0].id).estado).toBe("En curso")
    expect(tareas.find(item => item.id === cola[1].id).estado).toBe("Completada")

    const registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros).toHaveLength(3)
    expect(registros.map(registro => registro.tareaId)).toEqual([cola[0].id, cola[1].id, cola[0].id])
    expect(registros.every(registro => registro.estado === "Finalizado" || registro.estado === "En curso")).toBe(true)
    for (const registro of registros) {
        expect(registro.segmentos).toHaveLength(1)
        expect(registro.segmentos[0].tipo).toBe("En curso")
    }
})

test("Flujo de usuario: cola agotada registra trabajo general y permite activar una tarea nueva", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 18, 15, 0, 0) })
    const { cola } = await cargarCola(page, 1)
    const vista = await iniciarFocusConCola(page)
    const sesion = vista.locator(".focus-sesion-activa")

    await page.clock.runFor(2_100)
    await sesion.getByRole("button", { name: "Finalicé esta tarea" }).click()
    await expect(sesion.getByText("Sin tarea activa · se registra como Concentración")).toBeVisible()
    await expect(sesion.getByText("Tarea cola 1")).toHaveCount(0)
    await page.clock.runFor(2_100)
    await sesion.getByLabel("Nueva tarea").fill("Tarea surgida durante Focus")
    await sesion.getByLabel("Destino").selectOption("focus")
    await sesion.getByRole("button", { name: "Agregar tarea" }).click()
    await expect(sesion.getByText("Tarea activa: Tarea surgida durante Focus")).toBeVisible()
    await page.clock.runFor(2_100)

    const registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros).toHaveLength(3)
    expect(registros[0]).toMatchObject({ nombre: "Tarea cola 1", tareaId: cola[0].id, estado: "Finalizado" })
    expect(registros[1]).toMatchObject({ nombre: "Concentración", estado: "Finalizado" })
    expect(registros[1].tareaId).toBeUndefined()
    expect(registros[2]).toMatchObject({ nombre: "Tarea surgida durante Focus", tareaNombre: "Tarea surgida durante Focus", estado: "En curso" })
})

test("Flujo de usuario: completar en descanso no suma tiempo y una tarea nueva espera al próximo bloque", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 18, 15, 0, 0) })
    const { cola } = await cargarCola(page, 1)
    const vista = await iniciarFocusConCola(page, 2)
    const sesion = vista.locator(".focus-sesion-activa")

    await page.clock.runFor(120_100)
    await expect(sesion.getByText("Descanso", { exact: true }).first()).toBeVisible()
    await sesion.getByRole("button", { name: "Finalicé esta tarea" }).click()
    await sesion.getByLabel("Nueva tarea").fill("Tarea para después del descanso")
    await sesion.getByLabel("Destino").selectOption("focus")
    await sesion.getByRole("button", { name: "Agregar tarea" }).click()
    await expect(sesion.getByText("Tarea activa: Tarea para después del descanso")).toBeVisible()
    let registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros).toHaveLength(1)
    expect(registros[0]).toMatchObject({ tareaId: cola[0].id, estado: "Finalizado" })
    const duracionTareaMs = Date.parse(registros[0].segmentos[0].fin) - Date.parse(registros[0].segmentos[0].inicio)
    expect(duracionTareaMs).toBeGreaterThan(115_000)
    expect(duracionTareaMs).toBeLessThanOrEqual(120_000)

    await page.clock.runFor(61_000)
    await expect(sesion.getByRole("button", { name: "Continuar con concentración" })).toBeVisible()
    await sesion.getByRole("button", { name: "Continuar con concentración" }).click()
    await page.clock.runFor(2_100)
    registros = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(registros).toHaveLength(2)
    expect(registros[1]).toMatchObject({ nombre: "Tarea para después del descanso", tareaNombre: "Tarea para después del descanso", estado: "En curso" })
    expect(Date.parse(registros[1].segmentos[0].inicio)).toBeGreaterThanOrEqual(Date.parse(registros[0].segmentos[0].fin))
})
