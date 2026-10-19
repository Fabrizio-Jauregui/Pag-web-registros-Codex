import { expect, test } from "@playwright/test"

const claveRegistros = "focus.registros.v1"

function fechaHoraLocal(fecha) {
    const dosDigitos = numero => String(numero).padStart(2, "0")
    const fechaISO = [
        fecha.getFullYear(),
        dosDigitos(fecha.getMonth() + 1),
        dosDigitos(fecha.getDate()),
    ].join("-")
    const hora = [
        dosDigitos(fecha.getHours()),
        dosDigitos(fecha.getMinutes()),
    ].join(":")
    const segundos = fecha.getSeconds() === 0 ? "" : `:${dosDigitos(fecha.getSeconds())}`

    return `${fechaISO}T${hora}${segundos}`
}

function crearRegistroPrueba(inicio, fin) {
    return {
        id: "qa-registro-interactivo",
        nombre: "Registro QA editable",
        eventoId: null,
        colorEvento: null,
        estado: "Finalizado",
        motivoCancelacion: null,
        segmentos: [{
            tipo: "En curso",
            inicio: inicio.toISOString(),
            fin: fin.toISOString(),
        }],
    }
}

async function cargarRegistrosAislados(page, registros) {
    await page.addInitScript(({ clave, datos }) => {
        if (window.localStorage.getItem(clave) === null) {
            window.localStorage.setItem(clave, JSON.stringify(datos))
        }
    }, { clave: claveRegistros, datos: registros })
    await page.goto("/")
}

test("Datos preparados + interacción UI: permite consultar, editar y conservar un registro finalizado", async ({ page }) => {
    const fin = new Date(Date.now() - 2 * 60_000)
    const inicio = new Date(fin.getTime() - 3 * 60_000)
    const registro = crearRegistroPrueba(inicio, fin)

    await cargarRegistrosAislados(page, [registro])
    await page.getByRole("button", { name: /Registro QA editable/ }).click()

    const detalle = page.getByRole("region", { name: "Registro QA editable" })
    await expect(detalle.getByText("Estado:")).toBeVisible()
    await expect(detalle.getByText("Finalizado")).toBeVisible()
    await expect(detalle.getByRole("heading", { name: "Registro QA editable" })).toBeVisible()

    await detalle.getByRole("button", { name: "Editar registro" }).click()
    await page.getByLabel("Nombre de la actividad").fill("Registro QA editado")
    await page.getByRole("button", { name: "Guardar cambios" }).click()

    await expect(page.getByRole("heading", { name: "Registro QA editado" })).toBeVisible()
    await page.reload()
    await expect(page.getByRole("button", { name: /Registro QA editado/ })).toBeVisible()

    const registrosGuardados = await page.evaluate(clave => (
        JSON.parse(window.localStorage.getItem(clave))
    ), claveRegistros)
    expect(registrosGuardados).toHaveLength(1)
    expect(registrosGuardados[0].id).toBe(registro.id)
    expect(registrosGuardados[0].nombre).toBe("Registro QA editado")
    expect(registrosGuardados[0].segmentos).toEqual(registro.segmentos)
})

test("Datos preparados + interacción UI: rechaza fechas invertidas y permite guardar un intervalo superpuesto", async ({ page }) => {
    const fin = new Date(Date.now() - 5 * 60_000)
    const inicio = new Date(fin.getTime() - 3 * 60_000)
    const registro = crearRegistroPrueba(inicio, fin)

    await cargarRegistrosAislados(page, [registro])
    await page.getByRole("button", { name: "Nuevo registro", exact: true }).click()

    const inicioInput = page.getByLabel("Inicio")
    const finInput = page.getByLabel("Fin")
    const crear = page.getByRole("button", { name: "Crear registro", exact: true })
    const alertaFormulario = page.getByRole("region", { name: "Calendario" }).getByRole("alert")

    await inicioInput.fill(fechaHoraLocal(inicio))
    const finInvertido = fechaHoraLocal(new Date(inicio.getTime() - 60_000))
    await finInput.fill(finInvertido)
    await expect(finInput).toHaveValue(finInvertido)
    await crear.click()
    await expect(alertaFormulario).toHaveText("El fin debe ser posterior al inicio.")

    await page.getByLabel("Nombre de la actividad").fill("Registro QA solapado")
    await inicioInput.fill(fechaHoraLocal(inicio))
    await finInput.fill(fechaHoraLocal(fin))
    await crear.click()
    await expect(page.getByRole("button", { name: /Registro QA solapado/ })).toBeVisible()

    const registrosGuardados = await page.evaluate(clave => (
        JSON.parse(window.localStorage.getItem(clave))
    ), claveRegistros)
    expect(registrosGuardados).toHaveLength(2)
    expect(registrosGuardados[0].id).toBe(registro.id)
    expect(registrosGuardados[0].nombre).toBe(registro.nombre)
    await expect(page.getByRole("button", { name: /Registro QA editable/ })).toBeVisible()
})

test("Flujo de usuario: anuncia una sola alerta accesible cuando el formulario rechaza fechas inválidas", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Nuevo registro", exact: true }).click()
    await page.getByLabel("Nombre de la actividad").fill("Registro QA inválido")

    const inicio = new Date(Date.now() - 60_000)
    await page.getByLabel("Inicio").fill(fechaHoraLocal(inicio))
    await page.getByLabel("Fin").fill(fechaHoraLocal(new Date(inicio.getTime() - 60_000)))
    await page.getByRole("button", { name: "Crear registro", exact: true }).click()

    await expect(page.getByRole("region", { name: "Calendario" }).getByRole("alert"))
        .toHaveText("El fin debe ser posterior al inicio.")
    await expect(page.getByRole("alert")).toHaveCount(1)
})

test("Flujo de usuario: crea un registro de hoy cuando los segundos son cero", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 13, 16, 8, 0) })
    await page.goto("/")
    await page.getByRole("button", { name: "Nuevo registro", exact: true }).click()
    await page.getByLabel("Nombre de la actividad").fill("Registro QA 07h")
    await page.getByLabel("Inicio").fill("2026-10-13T07:00")
    await page.getByLabel("Fin", { exact: true }).fill("2026-10-13T07:30")
    await page.getByRole("button", { name: "Crear registro", exact: true }).click()

    await expect(page.getByRole("button", { name: /Registro QA 07h/ })).toBeVisible()
    await expect(page.getByRole("region", { name: "Calendario" }).getByRole("alert"))
        .toHaveCount(0)

    const registros = await page.evaluate(clave => (
        JSON.parse(window.localStorage.getItem(clave))
    ), claveRegistros)
    expect(registros).toHaveLength(1)
    expect(registros[0].segmentos[0].inicio).toBe(new Date(2026, 9, 13, 7, 0, 0).toISOString())
    expect(registros[0].segmentos[0].fin).toBe(new Date(2026, 9, 13, 7, 30, 0).toISOString())
})

test("Flujo de usuario: crea y edita un registro que termina después de medianoche", async ({ page }) => {
    const ahora = new Date(2026, 9, 14, 0, 3, 0)
    const inicioCruce = new Date(2026, 9, 13, 23, 58, 0)
    const finCruce = new Date(2026, 9, 14, 0, 2, 0)

    await page.clock.install({ time: ahora })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill("2026-10-13")
    await page.getByRole("button", { name: "Nuevo registro", exact: true }).click()
    await page.getByLabel("Nombre de la actividad").fill("Registro nocturno")
    await page.getByLabel("Inicio").fill(fechaHoraLocal(inicioCruce))
    await page.getByLabel("Fin", { exact: true }).fill("2026-10-13T00:02")
    await expect(page.getByLabel("Fin")).toHaveValue("2026-10-13T00:02")
    await page.getByRole("button", { name: "Crear registro", exact: true }).click()
    await expect(page.getByRole("alert")).toHaveText("El fin debe ser posterior al inicio.")
    await page.getByLabel("Fin", { exact: true }).fill(fechaHoraLocal(finCruce))
    await page.getByRole("button", { name: "Crear registro", exact: true }).click()

    let guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(guardados).toHaveLength(1)
    expect(guardados[0].segmentos[0].inicio).toBe(inicioCruce.toISOString())
    expect(guardados[0].segmentos[0].fin).toBe(finCruce.toISOString())

    await page.getByRole("button", { name: /Registro nocturno/ }).click()
    await page.getByRole("region", { name: "Registro nocturno" })
        .getByRole("button", { name: "Editar registro" }).click()
    await page.getByLabel("Fin", { exact: true }).fill("2026-10-13T00:02")
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.getByRole("alert")).toHaveText("El fin de cada segmento debe ser posterior a su inicio.")
    await page.getByLabel("Fin", { exact: true }).fill(fechaHoraLocal(finCruce))
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()

    guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(guardados).toHaveLength(1)
    expect(guardados[0].segmentos[0].inicio).toBe(inicioCruce.toISOString())
    expect(guardados[0].segmentos[0].fin).toBe(finCruce.toISOString())
})

test("Flujo de usuario: crea un registro manual con una pausa y calcula cada duración", async ({ page }) => {
    const ahora = new Date(2026, 9, 15, 16, 0, 0)
    const inicio = new Date(ahora.getTime() - 10 * 60_000)
    const fin = new Date(ahora.getTime() - 60_000)
    await page.clock.install({ time: ahora })
    await page.goto("/")
    await page.getByRole("button", { name: "Nuevo registro", exact: true }).click()
    await page.getByLabel("Nombre de la actividad").fill("Registro con descanso")
    await page.getByLabel("Inicio").fill(fechaHoraLocal(inicio))
    await page.getByLabel("Fin", { exact: true }).fill(fechaHoraLocal(fin))
    await page.getByRole("button", { name: "Agregar pausa después de este tramo" }).click()

    await page.getByLabel("Fin · Segmento 1").fill(fechaHoraLocal(new Date(inicio.getTime() + 3 * 60_000)))
    await page.getByLabel("Fin · Segmento 2").fill(fechaHoraLocal(new Date(inicio.getTime() + 5 * 60_000)))
    await page.getByRole("button", { name: "Crear registro", exact: true }).click()

    const detalle = page.getByRole("region", { name: "Registro con descanso" })
    await expect(detalle.locator(".detalle-registro-metricas")).toContainText("00:07:00")
    await expect(detalle.locator(".detalle-registro-metricas")).toContainText("00:02:00")
    await expect(detalle.locator(".detalle-registro-metricas")).toContainText("00:09:00")
    await expect(detalle.locator(".detalle-registro-segmentos")).toContainText("Pausado")

    const guardados = await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)), claveRegistros)
    expect(guardados).toHaveLength(1)
    expect(guardados[0].segmentos.map(segmento => segmento.tipo)).toEqual(["En curso", "Pausado", "En curso"])
    expect(guardados[0].segmentos[1].inicio).toBe(new Date(inicio.getTime() + 3 * 60_000).toISOString())
    expect(guardados[0].segmentos[1].fin).toBe(new Date(inicio.getTime() + 5 * 60_000).toISOString())
})

test("Flujo de usuario: identifica en cada bloque del calendario si el tramo está en curso o en pausa", async ({ page }) => {
    const ahora = new Date(2026, 9, 15, 16, 0, 0)
    const inicio = new Date(2026, 9, 15, 13, 0, 0)
    const fin = new Date(2026, 9, 15, 15, 59, 0)
    const fechaHora = fechaHoraLocal
    await page.clock.install({ time: ahora })
    await page.goto("/")
    await page.getByRole("button", { name: "Nuevo registro", exact: true }).click()
    await page.getByLabel("Nombre de la actividad").fill("Lectura con descanso")
    await page.getByLabel("Inicio").fill(fechaHora(inicio))
    await page.getByLabel("Fin", { exact: true }).fill(fechaHora(fin))
    await page.getByRole("button", { name: "Agregar pausa después de este tramo" }).click()
    await page.getByLabel("Fin · Segmento 1").fill(fechaHora(new Date(2026, 9, 15, 13, 50, 0)))
    await page.getByLabel("Fin · Segmento 2").fill(fechaHora(new Date(2026, 9, 15, 14, 40, 0)))
    await page.getByLabel("Fin · Segmento 3").fill(fechaHora(fin))
    await page.getByRole("button", { name: "Crear registro", exact: true }).click()

    const calendario = page.getByRole("region", { name: "Calendario" })
    const bloqueEnCurso = calendario.getByRole("button", { name: /Lectura con descanso, En curso/ }).first()
    const bloqueEnPausa = calendario.getByRole("button", { name: /Lectura con descanso, Pausado/ })
    await expect(bloqueEnCurso).toContainText("En curso")
    await expect(bloqueEnPausa)
        .toContainText("En pausa")
    await expect(bloqueEnCurso.locator("small")).toHaveCSS("font-size", "12px")
    await expect(bloqueEnPausa.locator("small")).toHaveCSS("font-size", "12px")
})
