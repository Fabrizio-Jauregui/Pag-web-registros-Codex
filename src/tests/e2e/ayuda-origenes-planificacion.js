export async function crearEventoParaPrueba(page, nombre, color = "#3A7BCD") {
    if (page.url() === "about:blank") await page.goto("/")
    await page.getByRole("button", { name: "Eventos", exact: true }).click()
    await page.getByRole("button", { name: "Crear evento", exact: true }).click()
    const formulario = page.locator(".formulario-evento")
    await formulario.getByLabel("Nombre", { exact: true }).fill(nombre)
    await formulario.getByLabel("Color").fill(color)
    await page.getByRole("button", { name: "Guardar evento", exact: true }).click()
}

export async function crearObjetivoParaPrueba(page, nombre) {
    if (page.url() === "about:blank") await page.goto("/")
    await page.getByRole("button", { name: "Tareas", exact: true }).click()
    await page.getByRole("button", { name: "Crear objetivo", exact: true }).click()
    const formulario = page.locator(".formulario-objetivo")
    await formulario.getByLabel("Nombre del objetivo").fill(nombre)
    await page.getByRole("button", { name: "Guardar objetivo", exact: true }).click()
    return page.evaluate(nombreObjetivo => JSON.parse(localStorage.getItem("focus.tareas.v1") ?? "[]").findLast(nodo => nodo.tipo === "objetivo" && nodo.nombre === nombreObjetivo), nombre)
}

export async function crearTareaParaPrueba(page, nombre, padreId = "") {
    if (page.url() === "about:blank") await page.goto("/")
    await page.getByRole("button", { name: "Tareas", exact: true }).click()
    const padre = padreId
        ? await page.evaluate(id => JSON.parse(localStorage.getItem("focus.tareas.v1") ?? "[]").find(tarea => tarea.id === id), padreId)
        : null
    if (padre) {
        if (padre.tipo === "objetivo") {
            const filaObjetivo = page.locator(".objetivo-grupo").filter({ hasText: padre.nombre }).first()
            await filaObjetivo.getByRole("button", { name: "Agregar tarea", exact: true }).click()
        } else {
            const filaPadre = page.locator(".tarea-nodo").filter({ hasText: padre.nombre }).first()
            await filaPadre.getByRole("button", { name: "Agregar subtarea", exact: true }).click()
        }
    } else {
        await page.getByRole("button", { name: "Crear tarea", exact: true }).click()
    }
    const formulario = page.getByRole("form", { name: "Nueva tarea" })
    await formulario.getByLabel("Nombre", { exact: true }).fill(nombre)
    await page.getByRole("button", { name: "Guardar tarea", exact: true }).click()
    return page.evaluate(nombreTarea => JSON.parse(localStorage.getItem("focus.tareas.v1") ?? "[]").findLast(tarea => tarea.nombre === nombreTarea), nombre)
}

export async function seleccionarOrigenEnActividad(page, actividad, tipo, nombre) {
    let cantidadSelectores = await actividad.locator(".selector-origen-trigger").count()
    if (cantidadSelectores === 0) {
        await actividad.getByRole("radio", { name: tipo === "evento" ? "Plantilla de evento" : "Tarea" }).check()
        cantidadSelectores = await actividad.locator(".selector-origen-trigger").count()
    }
    const indiceSelector = cantidadSelectores === 1 ? 0 : tipo === "evento" ? 0 : 1
    await actividad.locator(".selector-origen-trigger").nth(indiceSelector).click()
    const dialogo = page.getByRole("dialog", { name: tipo === "evento" ? "Elegí una plantilla de evento" : "Elegí una tarea" })
    await dialogo.getByLabel(tipo === "evento" ? "Buscar plantilla" : "Buscar tarea").fill(nombre)
    const opcion = dialogo.locator(".selector-origen-opcion").filter({ hasText: nombre })
    await opcion.click()
}
