import { expect, test } from "@playwright/test"
import { crearEventoParaPrueba, seleccionarOrigenEnActividad } from "./ayuda-origenes-planificacion.js"

const claves = {
    plantillas: "focus.plantillas-planes.v1",
    planes: "focus.planes.v1",
    recurrencias: "focus.recurrencias.v1",
    registros: "focus.registros.v1",
    tareas: "focus.tareas.v1"
}

function datosIniciales(modo) {
    const ahora = new Date()
    const fecha = (desplazamientoDias, hora) => {
        const dia = new Date(ahora)
        dia.setDate(dia.getDate() + desplazamientoDias)
        const [horas, minutos] = hora.split(":").map(Number)
        dia.setHours(horas, minutos, 0, 0)
        return dia.toISOString()
    }
    const idPlantilla = `plantilla-${modo}`
    const actividades = modo === "horarios"
        ? [0, 1].map(indice => ({ id: `actividad-${indice}`, nombre: `Actividad ${indice}`, eventoId: null, tareaId: "tarea-prueba", tareaNombre: "Tarea de prueba", inicioSegundos: 9 * 3600 + indice * 3600, finSegundos: 9 * 3600 + indice * 3600 + 1800, finDia: 0 }))
        : modo === "duraciones"
            ? [0, 1].map(indice => ({ id: `actividad-${indice}`, nombre: `Actividad ${indice}`, eventoId: null, tareaId: "tarea-prueba", tareaNombre: "Tarea de prueba", duracionSegundos: 1800 }))
            : [0, 1].map(indice => ({ id: `actividad-${indice}`, nombre: `Actividad ${indice}`, eventoId: null, tareaId: "tarea-prueba", tareaNombre: "Tarea de prueba", ordenSecuencia: indice, grupoCronometro: indice }))
    const planes = [
        { id: "plan-pasado", nombre: "Plan pasado", eventoId: null, tareaId: "tarea-prueba", tareaNombre: "Tarea de prueba", colorEvento: "#0F766E", inicio: fecha(-1, "09:00"), fin: fecha(-1, "09:30"), plantillaOrigenId: idPlantilla, plantillaOrigenNombre: `Plantilla ${modo}`, idAplicacionPlantilla: "aplicacion-pasada" },
        { id: "plan-iniciado", nombre: "Plan iniciado", eventoId: null, tareaId: "tarea-prueba", tareaNombre: "Tarea de prueba", colorEvento: "#0F766E", inicio: new Date(ahora.getTime() - 10 * 60_000).toISOString(), fin: new Date(ahora.getTime() + 10 * 60_000).toISOString(), plantillaOrigenId: idPlantilla, plantillaOrigenNombre: `Plantilla ${modo}`, idAplicacionPlantilla: "aplicacion-hoy" },
        { id: "plan-futuro", nombre: "Plan futuro", eventoId: null, tareaId: "tarea-prueba", tareaNombre: "Tarea de prueba", colorEvento: "#0F766E", inicio: new Date(ahora.getTime() + 60 * 60_000).toISOString(), fin: new Date(ahora.getTime() + 90 * 60_000).toISOString(), plantillaOrigenId: idPlantilla, plantillaOrigenNombre: `Plantilla ${modo}`, idAplicacionPlantilla: "aplicacion-futura" },
        { id: "plan-ajeno", nombre: "Plan ajeno", eventoId: null, tareaId: "tarea-prueba", tareaNombre: "Tarea de prueba", colorEvento: "#0F766E", inicio: fecha(2, "09:00"), fin: fecha(2, "09:30"), plantillaOrigenId: "otra-plantilla", plantillaOrigenNombre: "Otra", idAplicacionPlantilla: "otra-aplicacion" }
    ]
    const ahoraLocal = new Date(ahora)
    const reglaBase = {
        nombre: `Recurrente ${modo}`, eventoId: null, tareaId: "tarea-prueba", tareaNombre: "Tarea de prueba", colorEvento: "#0F766E",
        fechaInicio: `${ahoraLocal.getFullYear()}-${String(ahoraLocal.getMonth() + 1).padStart(2, "0")}-${String(ahoraLocal.getDate()).padStart(2, "0")}`,
        fechaFin: null, diasSemana: [ahoraLocal.getDay()], segundosInicio: 60,
        milisegundosInicio: 0, duracionMs: 60_000, excepciones: {}
    }
    return {
        ahora: ahora.toISOString(),
        plantillas: [{ id: idPlantilla, nombre: `Plantilla ${modo}`, modo, actividades }],
        planes,
        recurrencias: [
            { ...reglaBase, id: "serie-vinculada", idSerie: "serie-vinculada", plantillaOrigenId: idPlantilla },
            { ...reglaBase, id: "serie-legado", idSerie: "serie-legado", nombre: "Legado sin vínculo" },
            { ...reglaBase, id: "serie-ajena", idSerie: "serie-ajena", nombre: "Serie ajena", plantillaOrigenId: "otra-plantilla" }
        ],
        registros: [],
        tareas: [{ id: "tarea-prueba", tipo: "tarea", nombre: "Tarea de prueba", estado: "Pendiente", destino: "backlog", objetivoId: null, padreId: null, ordenArbol: 1, ordenBacklog: 1, ordenFocus: null, creadaEn: ahora.toISOString(), actualizadaEn: ahora.toISOString() }]
    }
}

async function abrirConDatos(page, modo) {
    const iniciales = datosIniciales(modo)
    await page.addInitScript(datos => {
        localStorage.setItem("focus.plantillas-planes.v1", JSON.stringify(datos.plantillas))
        localStorage.setItem("focus.planes.v1", JSON.stringify(datos.planes))
        localStorage.setItem("focus.recurrencias.v1", JSON.stringify(datos.recurrencias))
        localStorage.setItem("focus.registros.v1", JSON.stringify(datos.registros))
        localStorage.setItem("focus.tareas.v1", JSON.stringify(datos.tareas))
    }, iniciales)
    await page.goto("/")
    await page.getByRole("button", { name: "Planificaciones", exact: true }).click()
    await page.getByRole("button", { name: "Eliminar", exact: true }).click()
    await expect(page.getByRole("dialog", { name: `Eliminar “Plantilla ${modo}”` })).toBeVisible()
    return iniciales
}

for (const modo of ["horarios", "duraciones", "cronometro"]) {
    for (const alcance of ["conservar", "todas", "futuras"]) {
        test(`Borrado de plantilla ${modo}: opción ${alcance} conserva registros reales`, async ({ page }) => {
            const iniciales = await abrirConDatos(page, modo)
            const dialogo = page.getByRole("dialog")
            await dialogo.locator(`input[name="alcance-borrado-plantilla"][value="${alcance}"]`).check()
            if (alcance !== "conservar") {
                await expect(dialogo).toContainText("Legado sin vínculo")
                await dialogo.locator(".borrado-plantilla-recurrencias input[type=checkbox]").check()
            }
            await dialogo.getByRole("button", { name: "Eliminar plantilla" }).click()

            const datosTrasBorrado = await page.evaluate(claves => Object.fromEntries(Object.entries(claves).map(([nombre, clave]) => [nombre, localStorage.getItem(clave)])), claves)
            expect(JSON.parse(datosTrasBorrado.plantillas)).toEqual([])
            const planes = JSON.parse(datosTrasBorrado.planes)
            if (alcance === "conservar") expect(planes.filter(plan => plan.plantillaOrigenId === `plantilla-${modo}`)).toHaveLength(3)
            if (alcance === "todas") expect(planes.filter(plan => plan.plantillaOrigenId === `plantilla-${modo}`)).toHaveLength(0)
            if (alcance === "futuras") {
                expect(planes.map(plan => plan.id)).toEqual(["plan-pasado", "plan-iniciado", "plan-ajeno"])
            }
            expect(planes.some(plan => plan.plantillaOrigenNombre === `Plantilla ${modo}`)).toBe(alcance !== "todas")
            const recurrencias = JSON.parse(datosTrasBorrado.recurrencias)
            if (alcance === "conservar") expect(recurrencias).toHaveLength(3)
            if (alcance === "todas") expect(recurrencias.map(regla => regla.id)).toEqual(["serie-ajena"])
            if (alcance === "futuras") {
                expect(recurrencias.some(regla => regla.id === "serie-vinculada")).toBe(true)
                expect(recurrencias.some(regla => regla.id === "serie-legado")).toBe(true)
                expect(recurrencias.some(regla => regla.id === "serie-ajena")).toBe(true)
            }
            expect(datosTrasBorrado.registros).toBe(JSON.stringify(iniciales.registros))
        })
    }
}

test("un fallo al guardar recurrencias restaura plantilla y planes sin borrado parcial", async ({ page }) => {
    await abrirConDatos(page, "horarios")
    await page.evaluate(clave => {
        const original = Storage.prototype.setItem
        let fallarUnaVez = true
        Storage.prototype.setItem = function (key, value) {
            if (key === clave && fallarUnaVez) { fallarUnaVez = false; throw new Error("Cuota excedida") }
            return original.call(this, key, value)
        }
    }, claves.recurrencias)
    const dialogo = page.getByRole("dialog")
    await dialogo.locator('input[name="alcance-borrado-plantilla"][value="todas"]').check()
    await dialogo.locator(".borrado-plantilla-recurrencias input[type=checkbox]").check()
    await dialogo.getByRole("button", { name: "Eliminar plantilla" }).click()
    await expect(dialogo.getByRole("alert")).toContainText("No se pudieron guardar")
    expect(await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)).length, claves.plantillas)).toBe(1)
    expect(await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)).length, claves.planes)).toBe(4)
    expect(await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)).length, claves.recurrencias)).toBe(3)
})

test("el seguimiento activo bloquea borrar planes pero deja borrar solo la plantilla", async ({ page }) => {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + 2)
    const fechaISO = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fechaISO)
    await crearEventoParaPrueba(page, "Preparar")
    await crearEventoParaPrueba(page, "Continuar")
    await page.getByRole("button", { name: "Planificaciones", exact: true }).click()
    await page.getByRole("button", { name: /Horarios definidos/ }).click()
    const form = page.getByRole("form", { name: "Nueva plantilla de planificación" })
    await form.getByLabel("Nombre de la plantilla").fill("Plan activo")
    await seleccionarOrigenEnActividad(page, form.getByRole("group", { name: "Actividad 1" }), "evento", "Preparar")
    await seleccionarOrigenEnActividad(page, form.getByRole("group", { name: "Actividad 2" }), "evento", "Continuar")
    await form.getByRole("button", { name: "Guardar plantilla" }).click()
    await page.getByLabel("Ir a fecha").fill(fechaISO)
    await page.getByLabel("Aplicar a la fecha").fill(fechaISO)
    await page.getByRole("button", { name: "Aplicar a fecha" }).click()

    await page.getByRole("button", { name: "Calendario", exact: true }).click()
    const calendario = page.getByRole("region", { name: "Calendario" })
    await calendario.getByRole("button", { name: /Planificado: Preparar/ }).click()
    const detalle = calendario.getByRole("region", { name: "Plan: Preparar" })
    await detalle.getByRole("button", { name: "Seguir planificación" }).click()
    await detalle.getByRole("button", { name: "Desde el primer evento de esta planificación" }).click()

    await page.getByRole("button", { name: "Planificaciones", exact: true }).click()
    await page.getByRole("button", { name: "Eliminar", exact: true }).click()
    const dialogo = page.getByRole("dialog")
    await expect(dialogo.locator('input[value="todas"]')).toBeDisabled()
    await expect(dialogo.locator('input[value="futuras"]')).toBeDisabled()
    await expect(dialogo.locator('input[value="conservar"]')).toBeEnabled()
    await dialogo.getByRole("button", { name: "Eliminar plantilla" }).click()
    expect(await page.evaluate(clave => JSON.parse(localStorage.getItem(clave)).length, claves.planes)).toBe(2)
})
