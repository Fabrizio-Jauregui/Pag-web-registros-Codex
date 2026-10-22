import { expect, test } from "@playwright/test"

function fechaRelativa(dias, hora, minuto, segundo = 0) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + dias)
    fecha.setHours(hora, minuto, segundo, 0)
    return fecha
}

function fechaISO(fecha) {
    const dosDigitos = numero => String(numero).padStart(2, "0")
    return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`
}

function fechaHoraDeFormulario(fecha) {
    const dosDigitos = numero => String(numero).padStart(2, "0")
    const hora = `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`
    const segundos = fecha.getSeconds() === 0 ? "" : `:${dosDigitos(fecha.getSeconds())}`
    return `${fechaISO(fecha)}T${hora}${segundos}`
}

async function abrirFecha(page, fecha) {
    await page.getByLabel("Ir a fecha").fill(fechaISO(fecha))
}

async function crearRegistroDesdeFormulario(page, {
    nombre,
    inicio,
    fin,
    evento
}) {
    await abrirFecha(page, inicio)
    await page.getByRole("button", { name: "Nuevo registro", exact: true }).click()

    if (evento) {
        await page.getByLabel("Plantilla de evento (opcional)").selectOption({ label: evento })
    } else {
        await page.getByLabel("Nombre de la actividad").fill(nombre)
    }

    await page.getByLabel("Inicio").fill(fechaHoraDeFormulario(inicio))
    await page.getByLabel("Fin", { exact: true }).fill(fechaHoraDeFormulario(fin))
    await page.getByRole("button", { name: "Crear registro", exact: true }).click()
}

async function crearEventoDesdeInterfaz(page, nombre) {
    await page.getByRole("button", { name: "Eventos", exact: true }).click()
    await page.getByRole("button", { name: "Crear evento", exact: true }).click()
    await page.getByLabel("Nombre", { exact: true }).fill(nombre)
    await page.getByRole("button", { name: "Guardar evento", exact: true }).click()
    await expect(page.getByRole("region", { name: "Eventos" })
        .getByRole("listitem").filter({ hasText: nombre })).toBeVisible()
}

async function resolverConfirmacion(page, boton, aceptar) {
    const respuestaDialogo = new Promise(resolve => {
        page.once("dialog", async dialogo => {
            const mensaje = dialogo.message()
            if (aceptar) {
                await dialogo.accept()
            } else {
                await dialogo.dismiss()
            }
            resolve(mensaje)
        })
    })

    await boton.click()
    return respuestaDialogo
}

async function esperarCantidadRegistros(page, cantidad) {
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("focus.registros.v1") ?? "[]").length))
        .toBe(cantidad)
}

test.afterEach(async ({ page }, testInfo) => {
    if (!page.isClosed()) {
        await testInfo.attach("pantalla-final", {
            body: await page.screenshot({ fullPage: true }),
            contentType: "image/png"
        })
    }
})

test("Flujo de usuario: crea una actividad manual, la abre en el calendario y la consulta en el historial", async ({ page }) => {
    const nombre = "QA caminata de ayer"
    const inicio = fechaRelativa(-1, 9, 0)
    const fin = fechaRelativa(-1, 9, 30)

    await page.goto("/")
    await crearRegistroDesdeFormulario(page, { nombre, inicio, fin })

    const bloque = page.getByRole("button", { name: new RegExp(nombre) })
    await expect(bloque).toBeVisible()
    await bloque.click()

    const detalle = page.getByRole("region", { name: nombre })
    await expect(detalle.getByText("Finalizado")).toBeVisible()
    await expect(detalle.getByText("Tiempo efectivo")).toBeVisible()
    await detalle.getByRole("button", { name: "Cerrar detalle" }).click()
    await expect(detalle).toHaveCount(0)

    await page.getByRole("button", { name: "Historial", exact: true }).click()
    const historial = page.getByRole("region", { name: "Historial" })
    await expect(historial.getByText(nombre)).toBeVisible()
    await expect(historial.getByText("Registros: 1 de 1")).toBeVisible()

    await page.reload()
    await abrirFecha(page, inicio)
    await expect(page.getByRole("button", { name: new RegExp(nombre) })).toBeVisible()
    await page.getByRole("button", { name: "Historial", exact: true }).click()
    await expect(page.getByRole("region", { name: "Historial" }).getByText(nombre)).toBeVisible()
})

test("Flujo de usuario: cancela o confirma la eliminación de un registro finalizado", async ({ page }) => {
    const nombre = "QA registro para eliminar"
    const inicio = fechaRelativa(-1, 9, 0)
    const fin = fechaRelativa(-1, 9, 30)

    await page.goto("/")
    await crearRegistroDesdeFormulario(page, { nombre, inicio, fin })
    await page.getByRole("button", { name: new RegExp(nombre) }).click()

    const detalle = page.getByRole("region", { name: nombre })
    const eliminar = detalle.getByRole("button", { name: "Eliminar registro", exact: true })
    const mensajeCancelar = await resolverConfirmacion(page, eliminar, false)
    expect(mensajeCancelar).toContain(nombre)
    expect(mensajeCancelar).toContain("no se puede deshacer")
    await expect(detalle).toBeVisible()
    await expect(page.getByRole("button", { name: new RegExp(nombre) })).toBeVisible()
    await esperarCantidadRegistros(page, 1)

    const mensajeEliminar = await resolverConfirmacion(page, eliminar, true)
    expect(mensajeEliminar).toContain(nombre)
    await expect(detalle).toHaveCount(0)
    await expect(page.getByRole("button", { name: new RegExp(nombre) })).toHaveCount(0)
    await expect(page.locator('.mensaje-ajuste-calendario[role="status"]'))
        .toContainText("Registro eliminado")
    await esperarCantidadRegistros(page, 0)
    await page.getByRole("button", { name: "Historial", exact: true }).click()
    await expect(page.getByRole("region", { name: "Historial" }).getByText(nombre)).toHaveCount(0)

    await page.reload()
    await abrirFecha(page, inicio)
    await expect(page.getByRole("button", { name: new RegExp(nombre) })).toHaveCount(0)
    await page.getByRole("button", { name: "Historial", exact: true }).click()
    await expect(page.getByRole("region", { name: "Historial" }).getByText(nombre)).toHaveCount(0)
    await expect(page.getByText("Registros: 0 de 0")).toBeVisible()
})

test("Flujo de usuario: rechaza horas iguales sin convertirlas en un registro de 24 horas", async ({ page }) => {
    const inicio = fechaRelativa(-1, 9, 0)
    const valor = fechaHoraDeFormulario(inicio)

    await page.goto("/")
    await abrirFecha(page, inicio)
    await page.getByRole("button", { name: "Nuevo registro", exact: true }).click()
    await page.getByLabel("Nombre de la actividad").fill("QA hora igual")
    await page.getByLabel("Inicio").fill(valor)
    const campoFin = page.getByLabel("Fin", { exact: true })
    await campoFin.fill(valor)
    await expect(campoFin).toHaveValue(valor)
    await page.getByRole("button", { name: "Crear registro", exact: true }).click()

    await expect(page.getByRole("alert")).toHaveText("El fin debe ser posterior al inicio.")
    await esperarCantidadRegistros(page, 0)
})

test("Flujo de usuario: avisa si falta el nombre y permite cancelar un borrador sin guardarlo", async ({ page }) => {
    const inicio = fechaRelativa(-1, 10, 0)

    await page.goto("/")
    await abrirFecha(page, inicio)
    await page.getByRole("button", { name: "Nuevo registro", exact: true }).click()
    await page.getByRole("button", { name: "Crear registro", exact: true }).click()
    await expect(page.getByRole("region", { name: "Calendario" }).getByRole("alert"))
        .toContainText("Escribí un nombre")

    await page.getByLabel("Nombre de la actividad").fill("QA borrador cancelado")
    await page.getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Nuevo registro manual" })).toHaveCount(0)
    await esperarCantidadRegistros(page, 0)
})

test("Flujo de usuario: crea, edita, cancela y elimina un evento usando sus confirmaciones", async ({ page }) => {
    const nombre = "QA idioma"
    const editado = "QA idioma editado"

    await page.goto("/")
    await page.getByRole("button", { name: "Eventos", exact: true }).click()
    await page.getByRole("button", { name: "Crear evento", exact: true }).click()
    await page.getByRole("button", { name: "Guardar evento", exact: true }).click()
    await expect(page.getByRole("alert")).toContainText("nombre del evento es obligatorio")

    await page.getByLabel("Nombre", { exact: true }).fill(nombre)
    await page.getByRole("button", { name: "Guardar evento", exact: true }).click()
    const eventos = page.getByRole("region", { name: "Eventos" })
    const filaOriginal = eventos.getByRole("listitem").filter({ hasText: nombre })
    await expect(filaOriginal).toBeVisible()

    await filaOriginal.getByRole("button", { name: "Editar" }).click()
    await page.getByLabel("Nombre", { exact: true }).fill(editado)
    await page.getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(filaOriginal).toBeVisible()

    await filaOriginal.getByRole("button", { name: "Editar" }).click()
    await page.getByLabel("Nombre", { exact: true }).fill(editado)
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    const filaEditada = eventos.getByRole("listitem").filter({ hasText: editado })
    await expect(filaEditada).toBeVisible()

    const botonEliminar = filaEditada.getByRole("button", { name: "Eliminar" })
    const primerMensaje = await resolverConfirmacion(page, botonEliminar, false)
    expect(primerMensaje).toContain(editado)
    await expect(filaEditada).toBeVisible()

    const segundoMensaje = await resolverConfirmacion(page, botonEliminar, true)
    expect(segundoMensaje).toContain(editado)
    await expect(filaEditada).toHaveCount(0)
    await expect(page.getByText("Todavía no hay eventos.")).toBeVisible()
})

test("Flujo de usuario: no permite borrar un evento que se usó en un registro creado desde la página", async ({ page }) => {
    const evento = "QA guitarra"
    const inicio = fechaRelativa(-1, 11, 0)
    const fin = fechaRelativa(-1, 11, 30)

    await page.goto("/")
    await crearEventoDesdeInterfaz(page, evento)
    await page.getByRole("button", { name: "Calendario", exact: true }).click()
    await crearRegistroDesdeFormulario(page, { inicio, fin, evento })
    await expect(page.getByRole("button", { name: new RegExp(evento) })).toBeVisible()

    await page.getByRole("button", { name: "Eventos", exact: true }).click()
    const fila = page.getByRole("region", { name: "Eventos" })
        .getByRole("listitem").filter({ hasText: evento })
    const mensaje = await resolverConfirmacion(
        page,
        fila.getByRole("button", { name: "Eliminar" }),
        true
    )
    expect(mensaje).toContain(evento)

    await expect(page.getByRole("alert")).toContainText("está vinculada a uno o más registros")
    await expect(fila).toBeVisible()
})

test("Flujo de usuario: permite crear un segundo registro superpuesto y muestra ambos", async ({ page }) => {
    const fecha = -1
    const nombre = "QA bloque de mañana"

    await page.goto("/")
    await crearRegistroDesdeFormulario(page, {
        nombre,
        inicio: fechaRelativa(fecha, 9, 0),
        fin: fechaRelativa(fecha, 10, 0)
    })
    await expect(page.getByRole("button", { name: new RegExp(nombre) })).toBeVisible()

    await crearRegistroDesdeFormulario(page, {
        nombre: "QA bloque superpuesto",
        inicio: fechaRelativa(fecha, 9, 30),
        fin: fechaRelativa(fecha, 10, 30)
    })
    await expect(page.getByRole("button", { name: /QA bloque superpuesto/ })).toBeVisible()
    await expect(page.getByRole("button", { name: new RegExp(nombre) })).toBeVisible()
    await esperarCantidadRegistros(page, 2)
})

test("Flujo de usuario: mantiene timers simultáneos independientes al pausar, detener y recargar", async ({ page }) => {
    await page.goto("/")
    const nombre = page.getByLabel("Nombre del temporizador")
    const play = page.getByRole("button", { name: "Iniciar", exact: true })

    await nombre.fill("Desayunar")
    await play.click()
    const desayuno = page.getByRole("article", { name: "Actividad activa: Desayunar" })
    await expect(desayuno).toBeVisible()
    await expect(desayuno.getByText(/Tiempo efectivo: 00:00:0[1-9]/)).toBeVisible()

    await nombre.fill("Ver YouTube")
    await play.click()
    const youtube = page.getByRole("article", { name: "Actividad activa: Ver YouTube" })
    await expect(youtube).toBeVisible()
    await expect(page.getByRole("article", { name: /Actividad activa:/ })).toHaveCount(2)

    await desayuno.getByRole("button", { name: "Pausar", exact: true }).click()
    await expect(desayuno).toContainText("Estado actual: Pausado")
    await expect(youtube).toContainText("Estado actual: En curso")
    await youtube.getByRole("button", { name: "Finalizar", exact: true }).click()
    await expect(youtube).toHaveCount(0)
    await expect(desayuno).toBeVisible()

    await page.reload()
    const desayunoRecargado = page.getByRole("article", { name: "Actividad activa: Desayunar" })
    await expect(desayunoRecargado).toContainText("Estado actual: Pausado")
    await desayunoRecargado.getByRole("button", { name: "Continuar", exact: true }).click()
    await expect(desayunoRecargado).toContainText("Estado actual: En curso")
    await desayunoRecargado.getByRole("button", { name: "Finalizar", exact: true }).click()
    await expect(desayunoRecargado).toHaveCount(0)
})

test("Flujo de usuario: muestra los bloques superpuestos en carriles y calcula el tiempo total sin duplicar", async ({ page }) => {
    const fecha = -1
    await page.goto("/")
    await crearRegistroDesdeFormulario(page, {
        nombre: "Desayuno",
        inicio: fechaRelativa(fecha, 9, 0),
        fin: fechaRelativa(fecha, 10, 0)
    })
    await crearRegistroDesdeFormulario(page, {
        nombre: "Videos",
        inicio: fechaRelativa(fecha, 9, 30),
        fin: fechaRelativa(fecha, 10, 30)
    })

    const desayuno = page.getByRole("button", { name: /Desayuno/ })
    const videos = page.getByRole("button", { name: /Videos/ })
    await expect(desayuno).toBeVisible()
    await expect(videos).toBeVisible()
    const cajaDesayuno = await desayuno.boundingBox()
    const cajaVideos = await videos.boundingBox()
    expect(cajaDesayuno.width).toBeGreaterThan(0)
    expect(cajaVideos.width).toBeGreaterThan(0)
    expect(cajaDesayuno.x).not.toBe(cajaVideos.x)
    await expect(page.getByText("Tiempo total del día: 01:30:00")).toBeVisible()
})

test("Flujo de usuario: acepta registros consecutivos que empiezan cuando termina el anterior", async ({ page }) => {
    await page.goto("/")
    await crearRegistroDesdeFormulario(page, {
        nombre: "QA primer bloque",
        inicio: fechaRelativa(-1, 9, 0),
        fin: fechaRelativa(-1, 10, 0)
    })
    await crearRegistroDesdeFormulario(page, {
        nombre: "QA segundo bloque",
        inicio: fechaRelativa(-1, 10, 0),
        fin: fechaRelativa(-1, 10, 30)
    })

    await expect(page.getByRole("button", { name: /QA primer bloque/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /QA segundo bloque/ })).toBeVisible()
    await esperarCantidadRegistros(page, 2)
})

test("Flujo de usuario: muestra un registro que cruza medianoche en sus dos días de la semana", async ({ page }) => {
    const nombre = "QA turno nocturno"
    const inicio = fechaRelativa(-1, 23, 30)
    const fin = fechaRelativa(0, 0, 30)

    await page.goto("/")
    await crearRegistroDesdeFormulario(page, { nombre, inicio, fin })
    await page.getByRole("button", { name: "Semana", exact: true }).click()
    await expect(page.getByRole("table", { name: /^Semana del/ })).toBeVisible()
    await expect(page.getByRole("button", { name: new RegExp(nombre) })).toHaveCount(2)

    await page.getByRole("button", { name: "Día", exact: true }).click()
    await abrirFecha(page, inicio)
    await expect(page.getByRole("button", { name: new RegExp(nombre) })).toHaveCount(1)
    await abrirFecha(page, fin)
    await expect(page.getByRole("button", { name: new RegExp(nombre) })).toHaveCount(1)
})

test("Flujo de usuario: permite registrar exactamente 24 horas y explica cuando se excede el límite", async ({ page }) => {
    const finExacto = new Date()
    finExacto.setMinutes(finExacto.getMinutes() - 2)
    finExacto.setSeconds(0, 0)
    const inicioExacto = new Date(finExacto.getTime() - 24 * 60 * 60 * 1000)

    await page.goto("/")
    await crearRegistroDesdeFormulario(page, {
        nombre: "QA máximo permitido",
        inicio: inicioExacto,
        fin: finExacto
    })
    await expect(page.getByRole("button", { name: /QA máximo permitido/ })).toBeVisible()

    const finExcedido = new Date(finExacto.getTime() - 60 * 60 * 1000)
    const inicioExcedido = new Date(finExcedido.getTime() - 24 * 60 * 60 * 1000 - 1000)
    await crearRegistroDesdeFormulario(page, {
        nombre: "QA máximo excedido",
        inicio: inicioExcedido,
        fin: finExcedido
    })
    await expect(page.getByRole("region", { name: "Calendario" }).getByRole("alert"))
        .toContainText("24 horas")
    await esperarCantidadRegistros(page, 1)
})

test("Flujo de usuario: explica que no se puede guardar un intervalo que todavía no ocurrió", async ({ page }) => {
    const inicio = new Date()
    inicio.setMinutes(inicio.getMinutes() + 10)
    inicio.setSeconds(0, 0)
    const fin = new Date(inicio.getTime() + 30 * 60 * 1000)

    await page.goto("/")
    await crearRegistroDesdeFormulario(page, {
        nombre: "QA horario futuro",
        inicio,
        fin
    })
    await expect(page.getByRole("region", { name: "Calendario" }).getByRole("alert"))
        .toContainText("El fin no puede ser posterior a la hora actual")
    await esperarCantidadRegistros(page, 0)
})

test("Flujo de usuario: edita un registro finalizado y permite que la edición se superponga con otro", async ({ page }) => {
    const nombre = "QA bloque editable"
    const fecha = -1

    await page.goto("/")
    await crearRegistroDesdeFormulario(page, {
        nombre,
        inicio: fechaRelativa(fecha, 9, 0),
        fin: fechaRelativa(fecha, 10, 0)
    })
    await crearRegistroDesdeFormulario(page, {
        nombre: "QA bloque fijo",
        inicio: fechaRelativa(fecha, 11, 0),
        fin: fechaRelativa(fecha, 12, 0)
    })

    await page.getByRole("button", { name: new RegExp(nombre) }).click()
    const detalle = page.getByRole("region", { name: nombre })
    await detalle.getByRole("button", { name: "Editar registro" }).click()
    await page.getByLabel("Nombre de la actividad").fill("QA bloque editado")
    await page.getByLabel("Fin", { exact: true }).fill(fechaHoraDeFormulario(fechaRelativa(fecha, 11, 30)))
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()

    await expect(page.getByRole("button", { name: /QA bloque editado/ })).toBeVisible()
    await expect(page.getByRole("button", { name: /QA bloque fijo/ })).toBeVisible()
    await esperarCantidadRegistros(page, 2)
})

test("Flujo de usuario: completa el temporizador por interfaz y recupera el resultado al recargar", async ({ page }) => {
    const evento = "QA sesión de lectura"

    await page.goto("/")
    await page.getByRole("button", { name: "Iniciar", exact: true }).click()
    await expect(page.getByRole("region", { name: "Registro de tiempo" }).getByRole("alert"))
        .toContainText("nombre")

    await crearEventoDesdeInterfaz(page, evento)
    await page.getByRole("button", { name: "Calendario", exact: true }).click()
    await page.locator("#evento-registro").selectOption({ label: evento })
    await expect(page.getByLabel("Nombre del temporizador")).toHaveValue(evento)
    await expect(page.getByLabel("Nombre del temporizador")).toBeDisabled()

    const controles = page.getByRole("region", { name: "Registro de tiempo" })
    const play = controles.getByRole("button", { name: "Iniciar", exact: true })
    const pausaYCierre = page.getByRole("article", { name: `Actividad activa: ${evento}` })
    const pause = pausaYCierre.getByRole("button", { name: "Pausar", exact: true })
    const continuar = pausaYCierre.getByRole("button", { name: "Continuar", exact: true })
    const stop = pausaYCierre.getByRole("button", { name: "Finalizar", exact: true })

    await play.click()
    await expect(page.getByText("Estado actual: En curso")).toBeVisible()
    await expect(pausaYCierre).toBeVisible()
    await expect(pause).toBeEnabled()
    await expect(stop).toBeEnabled({ timeout: 4000 })
    await pause.click()
    await expect(page.getByText("Estado actual: Pausado")).toBeVisible()
    await expect(continuar).toBeEnabled()
    await continuar.click()
    await expect(page.getByText("Estado actual: En curso")).toBeVisible()
    await expect(stop).toBeEnabled({ timeout: 4000 })
    await stop.click()
    await expect(page.getByText("Estado actual: Inactivo")).toBeVisible()
    await esperarCantidadRegistros(page, 1)

    await page.reload()
    await page.getByRole("button", { name: "Historial", exact: true }).click()
    await expect(page.getByText("Registros: 1 de 1")).toBeVisible()
    await expect(page.getByRole("region", { name: "Historial" }).getByText(evento)).toBeVisible()
})

test("Flujo de usuario: usa la navegación y crea un evento solo con teclado en una pantalla estrecha", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    await page.getByRole("button", { name: "Semana", exact: true }).press("Enter")
    await expect(page.getByRole("button", { name: "Semana", exact: true }))
        .toHaveAttribute("aria-pressed", "true")

    await page.getByRole("button", { name: "Eventos", exact: true }).press("Enter")
    await page.getByRole("button", { name: "Crear evento", exact: true }).press("Enter")
    await page.getByLabel("Nombre", { exact: true }).pressSequentially("QA evento teclado")
    await page.getByLabel("Nombre", { exact: true }).press("Enter")

    await expect(page.getByRole("region", { name: "Eventos" })
        .getByRole("listitem").filter({ hasText: "QA evento teclado" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Eventos", exact: true })).toBeVisible()
})

test("Flujo de usuario: amplía localmente registros consecutivos de pocos segundos y conserva sus horas exactas", async ({ page }) => {
    const registros = [
        { nombre: "QA tramo corto A", inicio: fechaRelativa(-1, 9, 0, 2), fin: fechaRelativa(-1, 9, 0, 7) },
        { nombre: "QA tramo corto B", inicio: fechaRelativa(-1, 9, 0, 8), fin: fechaRelativa(-1, 9, 0, 13) },
        { nombre: "QA tramo corto C", inicio: fechaRelativa(-1, 9, 0, 14), fin: fechaRelativa(-1, 9, 0, 19) }
    ]

    await page.goto("/")
    for (const registro of registros) {
        await crearRegistroDesdeFormulario(page, registro)
    }

    const bloque = page.getByRole("button", { name: /QA tramo corto C/ }).first()
    await expect(bloque).toBeVisible()
    await bloque.click()
    await page.getByRole("button", { name: "Acercar calendario" }).click()

    await expect(page.getByRole("heading", { name: "Calendario" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Calendario ampliado" })).toHaveCount(0)
    await expect(page.getByRole("group", { name: "Zoom del calendario" }).getByText("5 min")).toBeVisible()
    for (const registro of registros) {
        await expect(page.locator(".bloque-detalle-tramo").filter({ hasText: registro.nombre })).toBeVisible()
    }
    const zoom = page.getByRole("group", { name: "Zoom del calendario" })
    await expect(page.locator(".bloque-detalle-tramo").filter({ hasText: "QA tramo corto A" }))
        .toHaveAttribute("aria-label", /9:00:02.*9:00:07/)
    await expect(page.locator(".bloque-detalle-tramo").filter({ hasText: "QA tramo corto C" }))
        .toHaveAttribute("aria-label", /9:00:14.*9:00:19/)

    await zoom.getByRole("button", { name: "Acercar calendario" }).click()
    await expect(zoom.locator("output")).toHaveText("2 min")
    await zoom.getByRole("button", { name: "Alejar calendario" }).click()
    await expect(zoom.locator("output")).toHaveText("5 min")
    const alejar = zoom.getByRole("button", { name: "Alejar calendario" })
    while (await alejar.isEnabled()) await alejar.click()
    await expect(page.getByRole("heading", { name: "Calendario" })).toBeVisible()
})
