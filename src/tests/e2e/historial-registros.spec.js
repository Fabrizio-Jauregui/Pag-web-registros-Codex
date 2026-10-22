import { expect, test } from "@playwright/test"

function fechaRelativa(dias, hora, minuto) {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + dias)
    fecha.setHours(hora, minuto, 0, 0)
    return fecha
}

function fechaISO(fecha) {
    const dosDigitos = numero => String(numero).padStart(2, "0")
    return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`
}

function fechaHora(fecha) {
    return `${fechaISO(fecha)}T${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`
}

async function crearRegistro(page, nombre, inicio, fin) {
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))
    await page.getByRole("button", { name: "Nuevo registro", exact: true }).click()
    await page.getByLabel("Nombre de la actividad").fill(nombre)
    await page.getByLabel("Inicio").fill(fechaHora(inicio))
    await page.getByLabel("Fin", { exact: true }).fill(fechaHora(fin))
    await page.getByRole("button", { name: "Crear registro", exact: true }).click()
}

test("Flujo de usuario: filtra, edita y elimina registros desde Historial y conserva los cambios en calendario", async ({ page }) => {
    const inicioA = fechaRelativa(-1, 9, 0)
    const finA = fechaRelativa(-1, 9, 30)
    const inicioB = fechaRelativa(-1, 10, 0)
    const finB = fechaRelativa(-1, 10, 15)
    const original = "QA historial editar"
    const editado = "QA historial actualizado"
    const eliminado = "QA historial borrar"

    await page.goto("/")
    await crearRegistro(page, original, inicioA, finA)
    await crearRegistro(page, eliminado, inicioB, finB)
    await page.getByRole("button", { name: "Historial", exact: true }).click()

    const historial = page.getByRole("region", { name: "Historial" })
    const busqueda = historial.getByLabel("Buscar por nombre")
    await busqueda.fill("QA historial")
    await expect(historial.locator(".historial-fila")).toHaveCount(2)
    await historial.getByLabel("Día").fill(fechaISO(inicioA))
    await historial.getByLabel("Duración mínima (min)").fill("20")
    await expect(historial.locator(".historial-fila")).toHaveCount(1)
    await expect(historial.getByText(original)).toBeVisible()

    await historial.getByLabel("Día").fill("")
    await historial.getByLabel("Duración mínima (min)").fill("")
    const filaEdicion = historial.locator(".historial-fila").filter({ hasText: original })
    await filaEdicion.locator("summary").click()
    await filaEdicion.getByRole("button", { name: "Editar registro" }).click()
    const dialogo = page.getByRole("dialog")
    await dialogo.getByLabel("Nombre de la actividad").fill(editado)
    await dialogo.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(dialogo).toHaveCount(0)
    await expect(historial.getByText(editado)).toBeVisible()
    await expect(historial.getByText(original)).toHaveCount(0)

    await page.getByRole("button", { name: "Analítica", exact: true }).click()
    await page.getByLabel("Elegir fecha").fill(fechaISO(inicioA))
    await expect(page.getByRole("region", { name: "Tiempo registrado del período" })).toContainText("00:45:00")
    await page.getByRole("button", { name: "Historial", exact: true }).click()

    const filaEliminar = historial.locator(".historial-fila").filter({ hasText: eliminado })
    await filaEliminar.locator("summary").click()
    const botonEliminar = filaEliminar.getByRole("button", { name: "Eliminar registro" })
    const confirmacion = new Promise(resolve => page.once("dialog", async dialogoNativo => {
        const mensaje = dialogoNativo.message()
        await dialogoNativo.accept()
        resolve(mensaje)
    }))
    await botonEliminar.click()
    expect(await confirmacion).toContain(eliminado)
    await expect(historial.getByText(eliminado)).toHaveCount(0)
    await expect(historial.getByText("Registros: 1 de 1")).toBeVisible()

    await page.getByRole("button", { name: "Analítica", exact: true }).click()
    await page.getByLabel("Elegir fecha").fill(fechaISO(inicioA))
    await expect(page.getByRole("region", { name: "Tiempo registrado del período" })).toContainText("00:30:00")

    await page.getByRole("button", { name: "Calendario", exact: true }).click()
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicioA))
    await expect(page.getByRole("button", { name: new RegExp(editado) })).toBeVisible()
    await expect(page.getByRole("button", { name: new RegExp(eliminado) })).toHaveCount(0)

    await page.reload()
    await page.getByRole("button", { name: "Historial", exact: true }).click()
    await expect(page.getByRole("region", { name: "Historial" }).getByText(editado)).toBeVisible()
    await expect(page.getByRole("region", { name: "Historial" }).getByText(eliminado)).toHaveCount(0)
})
