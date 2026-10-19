import { expect, test } from "@playwright/test"

const claveRegistros = "focus.registros.v1"

function fechaRelativa(dias, hora, minuto, segundo = 12) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + dias)
    fecha.setHours(hora, minuto, segundo, 0)
    return fecha
}

function fechaISO(fecha) {
    return [
        fecha.getFullYear(),
        String(fecha.getMonth() + 1).padStart(2, "0"),
        String(fecha.getDate()).padStart(2, "0")
    ].join("-")
}

function fechaHora(fecha) {
    return `${fechaISO(fecha)}T${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}:${String(fecha.getSeconds()).padStart(2, "0")}`
}

async function crearRegistroDesdeUI(page, nombre, inicio, fin) {
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))
    await page.getByRole("button", { name: "Nuevo registro", exact: true }).click()
    await page.getByLabel("Nombre de la actividad").fill(nombre)
    await page.getByLabel("Inicio").fill(fechaHora(inicio))
    await page.getByLabel("Fin", { exact: true }).fill(fechaHora(fin))
    await page.getByRole("button", { name: "Crear registro", exact: true }).click()
}

async function arrastrar(page, caja, xFinal, yFinal) {
    const xInicio = caja.x + caja.width / 2
    const yInicio = caja.y + caja.height / 2
    await page.mouse.move(xInicio, yInicio)
    await page.mouse.down()
    await page.mouse.move(xFinal, yFinal, { steps: 5 })
    await page.mouse.up()
}

test("Flujo de usuario: la edición directa apagada bloquea cambios y se puede activar y volver a apagar", async ({ page }) => {
    const inicio = fechaRelativa(-1, 9, 0)
    const fin = fechaRelativa(-1, 10, 0)
    await crearRegistroDesdeUI(page, "QA protección de edición", inicio, fin)

    const bloqueInicial = page.getByRole("button", { name: /QA protección de edición.*09:00 a 10:00/ })
    await bloqueInicial.focus()
    await page.keyboard.press("ArrowDown")
    await arrastrar(page, await bloqueInicial.boundingBox(), (await bloqueInicial.boundingBox()).x + 40, (await bloqueInicial.boundingBox()).y + 64)
    await expect(page.getByRole("button", { name: /QA protección de edición.*09:00 a 10:00/ })).toBeVisible()
    let guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(guardados[0].segmentos[0].inicio).toBe(inicio.toISOString())

    await page.getByRole("button", { name: "Edición directa: desactivada" }).click()
    await expect(page.getByRole("button", { name: "Edición directa: activada" })).toHaveAttribute("aria-pressed", "true")
    const bloqueHabilitado = page.getByRole("button", { name: /QA protección de edición.*09:00 a 10:00/ })
    const caja = await bloqueHabilitado.boundingBox()
    await arrastrar(page, caja, caja.x + caja.width / 2, caja.y + caja.height / 2 + 32)
    await expect(page.getByRole("button", { name: /QA protección de edición.*09:30 a 10:30/ })).toBeVisible()

    await page.getByRole("button", { name: "Edición directa: activada" }).click()
    const bloqueDeshabilitado = page.getByRole("button", { name: /QA protección de edición.*09:30 a 10:30/ })
    await bloqueDeshabilitado.focus()
    await page.keyboard.press("ArrowDown")
    await expect(bloqueDeshabilitado).toBeVisible()
    guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(guardados[0].segmentos[0].inicio).toBe(new Date(inicio.getTime() + 30 * 60_000).toISOString())
})

test("Flujo de usuario: mueve con el mouse el registro completo desde el tramo ampliado", async ({ page }) => {
    const inicio = fechaRelativa(-1, 9, 0, 10)
    const fin = fechaRelativa(-1, 9, 2, 10)
    await crearRegistroDesdeUI(page, "QA mover tramo ampliado", inicio, fin)
    await page.getByRole("button", { name: "Edición directa: desactivada" }).click()

    await page.getByRole("button", { name: /QA mover tramo ampliado.*09:00 a 09:02/ }).click()
    await page.getByRole("button", { name: "Acercar calendario" }).click()
    await expect(page.getByRole("heading", { name: "Calendario" })).toBeVisible()
    await expect(page.locator(".calendario-dia-scroll")).toBeVisible()

    const fragmento = page.locator(".bloque-detalle-tramo").first()
    await fragmento.scrollIntoViewIfNeeded()
    const caja = await fragmento.boundingBox()
    const inicioVisible = new Date(inicio.getTime())
    inicioVisible.setSeconds(inicioVisible.getSeconds() + 2)
    const finVisible = new Date(fin.getTime())
    finVisible.setSeconds(finVisible.getSeconds() + 2)
    await arrastrar(page, caja, caja.x + caja.width / 2, caja.y + caja.height / 2 + 20)

    const guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(guardados[0].segmentos[0].inicio).toBe(inicioVisible.toISOString())
    expect(guardados[0].segmentos[0].fin).toBe(finVisible.toISOString())
    await expect(page.locator('.mensaje-ajuste-calendario[role="status"]')).toContainText("Registro movido")
})

test("Flujo de usuario: ajusta inicio y fin de un registro desde el tramo ampliado", async ({ page }) => {
    const inicio = fechaRelativa(-1, 9, 0, 10)
    const fin = new Date(inicio.getTime() + 5000)
    await crearRegistroDesdeUI(page, "QA extremos detalle", inicio, fin)
    await page.getByRole("button", { name: "Edición directa: desactivada" }).click()
    await page.getByRole("button", { name: /QA extremos detalle/ }).click()
    await page.getByRole("button", { name: "Acercar calendario" }).click()
    await page.getByRole("button", { name: "Acercar calendario" }).click()
    await page.getByRole("button", { name: "Acercar calendario" }).click()

    async function arrastrarExtremo(extremo, deltaY) {
        const control = page.locator(`.bloque-detalle-tramo [data-extremo="${extremo}"]`)
        await control.scrollIntoViewIfNeeded()
        const caja = await control.boundingBox()
        const x = caja.x + caja.width / 2
        const y = caja.y + caja.height / 2
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x, y + deltaY, { steps: 5 })
        await page.mouse.up()
    }

    await arrastrarExtremo("inicio", -10)
    let guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(guardados[0].segmentos[0].inicio).toBe(new Date(inicio.getTime() - 1000).toISOString())
    expect(guardados[0].segmentos[0].fin).toBe(fin.toISOString())

    await arrastrarExtremo("fin", 20)
    guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(guardados[0].segmentos[0].inicio).toBe(new Date(inicio.getTime() - 1000).toISOString())
    expect(guardados[0].segmentos[0].fin).toBe(new Date(fin.getTime() + 2000).toISOString())
    await expect(page.locator('.mensaje-ajuste-calendario[role="status"]')).toContainText("ajustado")
})

test("Flujo de usuario: mueve y redimensiona un registro desde la vista diaria conservando segundos", async ({ page }) => {
    const inicio = fechaRelativa(-1, 9, 0)
    const fin = fechaRelativa(-1, 10, 0)
    const inicioEsperado = new Date(inicio)
    inicioEsperado.setMinutes(inicioEsperado.getMinutes() + 75)
    const finEsperado = new Date(fin)
    finEsperado.setMinutes(finEsperado.getMinutes() + 75)
    await crearRegistroDesdeUI(page, "QA ajuste visual", inicio, fin)
    await page.getByRole("button", { name: "Edición directa: desactivada" }).click()

    const bloque = page.getByRole("button", { name: /QA ajuste visual/ })
    await expect(bloque).toBeVisible()
    await bloque.scrollIntoViewIfNeeded()
    const cajaInicial = await bloque.boundingBox()
    await arrastrar(page, cajaInicial, cajaInicial.x + cajaInicial.width / 2, cajaInicial.y + cajaInicial.height / 2 + 64)

    const bloqueMovido = page.getByRole("button", { name: /QA ajuste visual.*10:00 a 11:00/ })
    await expect(bloqueMovido).toBeVisible()
    await expect(page.locator('.mensaje-ajuste-calendario[role="status"]')).toContainText("Registro movido")

    await bloqueMovido.scrollIntoViewIfNeeded()
    const cajaMovida = await bloqueMovido.boundingBox()
    await page.mouse.move(cajaMovida.x + cajaMovida.width / 2, cajaMovida.y + 4)
    await page.mouse.down()
    await page.mouse.move(cajaMovida.x + cajaMovida.width / 2, cajaMovida.y + 20, { steps: 3 })
    await page.mouse.up()

    const bloqueConInicioAjustado = page.getByRole("button", { name: /QA ajuste visual.*10:15 a 11:00/ })
    await expect(bloqueConInicioAjustado).toBeVisible()
    await expect(page.locator('.mensaje-ajuste-calendario[role="status"]')).toContainText("Inicio del registro ajustado")

    await bloqueConInicioAjustado.scrollIntoViewIfNeeded()
    const cajaRedimensionada = await bloqueConInicioAjustado.boundingBox()
    await page.mouse.move(
        cajaRedimensionada.x + cajaRedimensionada.width / 2,
        cajaRedimensionada.y + cajaRedimensionada.height - 4
    )
    await page.mouse.down()
    await page.mouse.move(
        cajaRedimensionada.x + cajaRedimensionada.width / 2,
        cajaRedimensionada.y + cajaRedimensionada.height + 12,
        { steps: 3 }
    )
    await page.mouse.up()

    const bloqueConFinAjustado = page.getByRole("button", { name: /QA ajuste visual.*10:15 a 11:15/ })
    await expect(bloqueConFinAjustado).toBeVisible()
    await expect(page.locator('.mensaje-ajuste-calendario[role="status"]')).toContainText("Fin del registro ajustado")

    const guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(guardados).toHaveLength(1)
    expect(guardados[0].segmentos[0].inicio).toBe(inicioEsperado.toISOString())
    expect(guardados[0].segmentos[0].fin).toBe(finEsperado.toISOString())
})

test("Flujo de usuario: permite mover registros al teclado por minutos y cambiar de día en la semana", async ({ page }) => {
    const inicio = fechaRelativa(-1, 9, 0)
    const fin = fechaRelativa(-1, 9, 30)
    await crearRegistroDesdeUI(page, "QA teclado semanal", inicio, fin)
    await page.getByRole("button", { name: "Edición directa: desactivada" }).click()

    const bloque = page.getByRole("button", { name: /QA teclado semanal/ })
    await bloque.focus()
    await page.keyboard.press("ArrowDown")
    await expect(page.getByRole("button", { name: /QA teclado semanal.*09:01 a 09:31/ })).toBeVisible()
    await page.keyboard.press("Shift+ArrowDown")
    await expect(page.getByRole("button", { name: /QA teclado semanal.*09:01 a 09:32/ })).toBeVisible()
    await page.keyboard.press("Alt+ArrowUp")
    await expect(page.getByRole("button", { name: /QA teclado semanal.*09:00 a 09:32/ })).toBeVisible()

    await page.getByRole("button", { name: "Semana", exact: true }).click()
    const fechaInicio = fechaISO(inicio)
    const desplazamientoSemana = page.locator(".calendario-semana-scroll")
    await desplazamientoSemana.evaluate(elemento => { elemento.scrollLeft = elemento.scrollWidth })
    const columna = page.locator(`.columna-registros-semana[data-fecha="${fechaInicio}"]`)
    const anchoColumna = (await columna.boundingBox()).width
    const bloqueSemanal = page.getByRole("button", { name: /QA teclado semanal.*09:00 a 09:32/ })
    await expect(bloqueSemanal).toBeVisible()
    await bloqueSemanal.scrollIntoViewIfNeeded()
    const caja = await bloqueSemanal.boundingBox()
    await arrastrar(
        page,
        caja,
        caja.x + caja.width / 2 + anchoColumna,
        caja.y + caja.height / 2
    )

    const diaSiguiente = new Date(inicio)
    diaSiguiente.setDate(diaSiguiente.getDate() + 1)
    await page.getByRole("button", { name: "Día", exact: true }).click()
    await page.getByLabel("Ir a fecha").fill(fechaISO(diaSiguiente))
    await expect(page.getByRole("button", { name: /QA teclado semanal.*09:00 a 09:32/ })).toBeVisible()

    const guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(guardados).toHaveLength(1)
    expect(guardados[0].segmentos[0].inicio).toBe(new Date(
        diaSiguiente.getFullYear(), diaSiguiente.getMonth(), diaSiguiente.getDate(), 9, 0, 12
    ).toISOString())
    expect(guardados[0].segmentos[0].fin).toBe(new Date(
        diaSiguiente.getFullYear(), diaSiguiente.getMonth(), diaSiguiente.getDate(), 9, 32, 12
    ).toISOString())
})

test("Flujo de usuario: rechaza con mensaje un redimensionamiento que produciría una duración inválida", async ({ page }) => {
    const inicio = fechaRelativa(-1, 9, 0)
    const fin = fechaRelativa(-1, 9, 1)
    await crearRegistroDesdeUI(page, "QA intervalo mínimo", inicio, fin)
    await page.getByRole("button", { name: "Edición directa: desactivada" }).click()

    const bloque = page.getByRole("button", { name: /QA intervalo mínimo/ })
    await bloque.focus()
    await page.keyboard.press("Shift+ArrowUp")

    await expect(page.getByRole("alert")).toHaveText("El fin de cada segmento debe ser posterior a su inicio.")
    const guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(guardados).toHaveLength(1)
    expect(guardados[0].segmentos[0].inicio).toBe(inicio.toISOString())
    expect(guardados[0].segmentos[0].fin).toBe(fin.toISOString())
})

test("Flujo de usuario: explica que no se puede estirar un registro más allá de la hora actual", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 14, 11, 40, 0) })
    const inicio = new Date(2026, 9, 14, 11, 0, 12)
    const fin = new Date(2026, 9, 14, 11, 30, 12)
    await crearRegistroDesdeUI(page, "QA fin futuro", inicio, fin)
    await page.getByRole("button", { name: "Edición directa: desactivada" }).click()

    const bloque = page.getByRole("button", { name: /QA fin futuro/ })
    await bloque.scrollIntoViewIfNeeded()
    const caja = await bloque.boundingBox()
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height - 4)
    await page.mouse.down()
    await page.mouse.move(
        caja.x + caja.width / 2,
        caja.y + caja.height + 12,
        { steps: 4 }
    )
    await page.mouse.up()

    await expect(page.getByRole("region", { name: "Calendario" }).getByRole("alert"))
        .toHaveText("El registro no puede terminar después de la hora actual.")
    await expect(page.getByRole("button", { name: /QA fin futuro.*11:00 a 11:30/ })).toBeVisible()
    const guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(guardados[0].segmentos[0].fin).toBe(fin.toISOString())
})

test("Flujo de usuario: mueve un registro a través de medianoche conservando la duración", async ({ page }) => {
    const inicio = fechaRelativa(-2, 23, 59)
    const fin = new Date(inicio)
    fin.setDate(fin.getDate() + 1)
    fin.setHours(0, 1, 12, 0)
    await crearRegistroDesdeUI(page, "QA cruce por ajuste", inicio, fin)
    await page.getByRole("button", { name: "Edición directa: desactivada" }).click()

    const bloque = page.getByRole("button", { name: /QA cruce por ajuste/ })
    await bloque.focus()
    await page.keyboard.press("ArrowDown")

    const diaSiguiente = new Date(inicio)
    diaSiguiente.setDate(diaSiguiente.getDate() + 1)
    await page.getByLabel("Ir a fecha").fill(fechaISO(diaSiguiente))
    await expect(page.getByRole("button", { name: /QA cruce por ajuste.*00:00 a 00:02/ })).toBeVisible()

    const guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    const inicioEsperado = new Date(inicio)
    inicioEsperado.setMinutes(inicioEsperado.getMinutes() + 1)
    const finEsperado = new Date(fin)
    finEsperado.setMinutes(finEsperado.getMinutes() + 1)
    expect(guardados).toHaveLength(1)
    expect(guardados[0].segmentos[0].inicio).toBe(inicioEsperado.toISOString())
    expect(guardados[0].segmentos[0].fin).toBe(finEsperado.toISOString())
})
