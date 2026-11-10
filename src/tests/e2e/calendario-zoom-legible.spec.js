import { expect, test } from "@playwright/test"

const CLAVE_REGISTROS = "focus.registros.v1"
const CLAVE_PLANES = "focus.planes.v1"

function fechaISO(fecha) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`
}

function registro(id, nombre, inicio, fin) {
    return {
        id,
        nombre,
        origenPuntual: true,
        categoriaIds: [],
        eventoId: null,
        colorEvento: null,
        estado: "Finalizado",
        motivoCancelacion: null,
        segmentos: [{ tipo: "En curso", inicio: inicio.toISOString(), fin: fin.toISOString() }]
    }
}

test("agrupa bloques breves y legibles cercanos y permite elegir cada actividad", async ({ page }) => {
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - 1)
    inicio.setHours(10, 0, 0, 0)
    const datos = [
        registro("breve-a", "Lectura breve", inicio, new Date(inicio.getTime() + 5000)),
        registro("breve-b", "Nota breve", new Date(inicio.getTime() + 8000), new Date(inicio.getTime() + 12_000)),
        registro("largo", "Bloque de dos horas", new Date(inicio.getTime() + 60_000), new Date(inicio.getTime() + 121 * 60_000))
    ]
    const planes = [{
        id: "plan-breve",
        nombre: "Plan breve",
        eventoId: null,
        origenPuntual: true,
        categoriaIds: [],
        colorEvento: null,
        inicio: new Date(inicio.getTime() + 13_000).toISOString(),
        fin: new Date(inicio.getTime() + 45_000).toISOString()
    }]
    await page.addInitScript(({ clave, registros, clavePlanes, planesIniciales }) => {
        localStorage.setItem(clave, JSON.stringify(registros))
        localStorage.setItem(clavePlanes, JSON.stringify(planesIniciales))
    }, {
        clave: CLAVE_REGISTROS,
        registros: datos,
        clavePlanes: CLAVE_PLANES,
        planesIniciales: planes
    })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))

    const grupo = page.getByRole("button", { name: "Abrir agrupación de 4 actividades" })
    await expect(grupo).toBeVisible()
    const cajaGrupo = await grupo.boundingBox()
    expect(cajaGrupo.width).toBeGreaterThanOrEqual(28)
    expect(cajaGrupo.height).toBeGreaterThanOrEqual(28)
    await grupo.click()
    const lista = page.getByRole("dialog", { name: "4 actividades agrupadas" })
    await expect(lista.getByRole("button", { name: /Lectura breve/ })).toBeVisible()
    await expect(lista.getByRole("button", { name: /Nota breve/ })).toBeVisible()
    await expect(lista.getByRole("button", { name: /Plan breve/ })).toContainText("Plan")
    await lista.getByRole("button", { name: /Nota breve/ }).click()
    await expect(page.getByRole("region", { name: "Nota breve" })).toBeVisible()
    await expect(page.getByRole("region", { name: "Bloque de dos horas" })).toHaveCount(0)
    await page.getByRole("region", { name: "Nota breve" }).getByRole("button", { name: "Cerrar detalle" }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await grupo.click()
    await expect(lista).toBeVisible()
    expect(await lista.evaluate(elemento => getComputedStyle(elemento).bottom)).toBe("0px")
})

test("resume una actividad pausada una sola vez y acerca el intervalo rayado completo", async ({ page }) => {
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - 1)
    inicio.setHours(10, 0, 0, 0)
    const finPrimerTramo = new Date(inicio.getTime() + 10_000)
    const inicioSegundoTramo = new Date(inicio.getTime() + 10 * 60_000)
    const finSegundoTramo = new Date(inicioSegundoTramo.getTime() + 5_000)
    const registros = [{
        ...registro("actividad-pausada", "Actividad con pausa", inicio, finSegundoTramo),
        segmentos: [
            { tipo: "En curso", inicio: inicio.toISOString(), fin: finPrimerTramo.toISOString() },
            { tipo: "En curso", inicio: inicioSegundoTramo.toISOString(), fin: finSegundoTramo.toISOString() }
        ]
    }]
    const planes = [{
        id: "plan-en-el-hueco",
        nombre: "Plan en el hueco",
        eventoId: null,
        origenPuntual: true,
        categoriaIds: [],
        colorEvento: null,
        inicio: new Date(inicio.getTime() + 5 * 60_000).toISOString(),
        fin: new Date(inicio.getTime() + 6 * 60_000).toISOString()
    }]
    await page.addInitScript(({ registrosClave, registrosIniciales, planesClave, planesIniciales }) => {
        localStorage.setItem(registrosClave, JSON.stringify(registrosIniciales))
        localStorage.setItem(planesClave, JSON.stringify(planesIniciales))
    }, {
        registrosClave: CLAVE_REGISTROS,
        registrosIniciales: registros,
        planesClave: CLAVE_PLANES,
        planesIniciales: planes
    })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))

    const grupo = page.getByRole("button", { name: "Abrir agrupación de 2 actividades" })
    await expect(grupo).toBeVisible()
    const cajaBoton = await grupo.boundingBox()
    expect(cajaBoton.width).toBeGreaterThanOrEqual(28)
    expect(cajaBoton.height).toBeGreaterThanOrEqual(28)
    const cajaBanda = await grupo.locator(".grupo-marcas-franja").boundingBox()
    expect(cajaBanda.height).toBeGreaterThan(2)
    await grupo.focus()
    await page.keyboard.press("Enter")
    const lista = page.getByRole("dialog", { name: "2 actividades agrupadas" })
    await expect(lista.getByRole("button", { name: /Actividad con pausa/ })).toHaveCount(1)
    await expect(lista.getByRole("button", { name: /Actividad con pausa/ })).toContainText("00:00:15")
    await expect(lista.getByRole("button", { name: /Plan en el hueco/ })).toBeVisible()
    await lista.getByRole("button", { name: "Acercar a la agrupación" }).click()
    await expect(page.locator(".controles-zoom output")).toContainText("10:00:00–")
    await expect(page.locator(".controles-zoom output")).toContainText("10:10:05")
    await expect(page.locator(".grupo-marcas-boton")).toHaveCount(0)
})

test("agrupa registros Focus y planes Focus en la grilla semanal móvil", async ({ page }) => {
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - 1)
    inicio.setHours(11, 0, 0, 0)
    const registros = [
        registro("focus-real", "Concentración hecha", inicio, new Date(inicio.getTime() + 10_000)),
        registro("focus-real-2", "Otra concentración", new Date(inicio.getTime() + 10_000), new Date(inicio.getTime() + 20_000))
    ].map(item => ({ ...item, origenFocus: true }))
    const planes = [{
        id: "plan-focus",
        nombre: "Bloque Focus planificado",
        eventoId: null,
        colorEvento: null,
        origenPuntual: true,
        categoriaIds: [],
        tipoPlanificacion: "focus",
        configuracionFocus: { nombre: "Bloque Focus planificado", bloques: [{ nombre: "Concentración", tipo: "concentracion", minutos: 1 }] },
        inicio: new Date(inicio.getTime() + 20_000).toISOString(),
        fin: new Date(inicio.getTime() + 80_000).toISOString()
    }]
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(({ registrosClave, registrosIniciales, planesClave, planesIniciales }) => {
        localStorage.setItem(registrosClave, JSON.stringify(registrosIniciales))
        localStorage.setItem(planesClave, JSON.stringify(planesIniciales))
    }, {
        registrosClave: CLAVE_REGISTROS,
        registrosIniciales: registros,
        planesClave: CLAVE_PLANES,
        planesIniciales: planes
    })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))
    await page.getByRole("button", { name: "Semana", exact: true }).click()
    await page.getByRole("button", { name: "Grilla por horas" }).click()

    const grupo = page.getByRole("button", { name: "Abrir agrupación de 3 actividades" })
    await expect(grupo).toBeVisible()
    await grupo.click()
    const lista = page.getByRole("dialog", { name: "3 actividades agrupadas" })
    await expect(lista.getByRole("button", { name: /Concentración hecha/ })).toContainText("Registro de sesión Focus")
    await expect(lista.getByRole("button", { name: /Otra concentración/ })).toContainText("Registro de sesión Focus")
    await expect(lista.getByRole("button", { name: /Bloque Focus planificado/ })).toContainText("Sesión Focus planificada")
    expect(await lista.evaluate(elemento => getComputedStyle(elemento).bottom)).toBe("0px")
})

test("el zoom mantiene el calendario, cruza medianoche y conserva el calendario semanal móvil", async ({ page }) => {
    const dia = new Date()
    dia.setDate(dia.getDate() - 1)
    dia.setHours(23, 59, 50, 0)
    const siguienteDia = new Date(dia.getTime() + 20_000)
    const datos = [
        registro("cruce", "Actividad al cambio de día", dia, siguienteDia),
        registro("seleccion", "Actividad seleccionada", new Date(dia.getTime() - 30 * 60_000), new Date(dia.getTime() - 5 * 60_000))
    ]
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(({ clave, registros }) => localStorage.setItem(clave, JSON.stringify(registros)), {
        clave: CLAVE_REGISTROS,
        registros: datos
    })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fechaISO(dia))
    await page.getByRole("button", { name: "Semana", exact: true }).click()
    await page.getByRole("button", { name: "Grilla por horas" }).click()
    await page.getByRole("button", { name: /Abrir agrupación de 2 actividades/ }).click()
    const grupoMedianoche = page.getByRole("dialog", { name: "2 actividades agrupadas" })
    await grupoMedianoche.getByRole("button", { name: /Actividad al cambio de día/ }).click()
    await page.getByRole("button", { name: "Acercar calendario" }).click()

    const zoom = page.locator(".calendario-semana-scroll")
    await expect(zoom).toBeVisible()
    await expect(page.locator(".calendario-separador-dia-semana")).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(zoom).toHaveCSS("overflow-x", "hidden")
    await expect(page.getByRole("region", { name: "Actividad al cambio de día" })).toBeVisible()

    const salida = page.locator(".controles-zoom output")
    await expect(salida).toContainText("20 segundos")
    const rangoInicial = await salida.textContent()
    await zoom.evaluate(elemento => { elemento.scrollTop += 100 })
    await expect(salida).not.toHaveText(rangoInicial)
    const alturaZoom = await zoom.evaluate(elemento => ({ alto: elemento.clientHeight, contenido: elemento.scrollHeight }))
    expect(alturaZoom.contenido).toBeLessThan(alturaZoom.alto * 5)
    await page.getByRole("button", { name: "Restablecer", exact: true }).click()
    await expect(page.getByRole("table", { name: /^Semana del/ })).toBeVisible()
    await expect(page.getByRole("button", { name: "Grilla por horas" })).toHaveAttribute("aria-pressed", "true")
})

test("la escala móvil mantiene bloques y grupos dentro de las 24 horas en Día y Grilla semanal", async ({ page }) => {
    const dia = new Date(2026, 10, 8)
    const registros = []
    function agregarGrupo(prefijo, hora, minuto) {
        for (let indice = 0; indice < 3; indice += 1) {
            const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora, minuto + indice, 0)
            registros.push(registro(`${prefijo}-${indice}`, `${prefijo} ${indice + 1}`, inicio, new Date(inicio.getTime() + 5_000)))
        }
    }
    agregarGrupo("Grupo nocturno", 22, 0)
    agregarGrupo("Grupo medianoche", 23, 57)
    const inicioBloque = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 12)
    registros.push(registro("bloque-medio-hora", "Bloque treinta minutos", inicioBloque, new Date(inicioBloque.getTime() + 30 * 60_000)))

    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(({ clave, datos }) => localStorage.setItem(clave, JSON.stringify(datos)), {
        clave: CLAVE_REGISTROS,
        datos: registros
    })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fechaISO(dia))

    const calendarioDia = page.locator(".calendario-dia-scroll")
    const medicionesDia = await calendarioDia.evaluate(root => {
        const capa = root.querySelector(".capa-registros-dia")
        const grupos = [...root.querySelectorAll(".grupo-marcas-boton")].map(boton => {
            const caja = boton.getBoundingClientRect()
            const capaCaja = capa.getBoundingClientRect()
            return { top: caja.top - capaCaja.top, bottom: caja.bottom - capaCaja.top }
        })
        const bloque = root.querySelector('[aria-label*="Bloque treinta minutos"]')
        const cajaBloque = bloque.getBoundingClientRect()
        return {
            altoPanel: root.clientHeight,
            altoLienzo: capa.clientHeight,
            altoDesplazable: root.scrollHeight,
            grupos,
            bloque: {
                top: cajaBloque.top - capa.getBoundingClientRect().top,
                alto: cajaBloque.height,
                compacto: bloque.classList.contains("bloque-registro-compacto"),
                marca: (() => {
                    const cajaMarca = bloque.querySelector(".marca-bloque-compacto").getBoundingClientRect()
                    return (cajaMarca.top + cajaMarca.height / 2) - capa.getBoundingClientRect().top
                })()
            }
        }
    })
    expect(medicionesDia.altoDesplazable).toBeLessThanOrEqual(medicionesDia.altoPanel + 1)
    expect(medicionesDia.altoLienzo).toBe(medicionesDia.altoPanel)
    expect(medicionesDia.grupos.length).toBeGreaterThanOrEqual(1)
    for (const grupo of medicionesDia.grupos) {
        expect(grupo.top).toBeGreaterThanOrEqual(0)
        expect(grupo.bottom).toBeLessThanOrEqual(medicionesDia.altoLienzo + 1)
    }
    expect(medicionesDia.bloque.compacto).toBe(true)
    expect(medicionesDia.bloque.marca).toBeCloseTo(medicionesDia.altoLienzo / 2, 0)
    expect(medicionesDia.bloque.alto).toBe(28)

    await page.getByRole("button", { name: /Abrir agrupación de \d+ actividades/ }).first().click()
    const dialogo = page.getByRole("dialog", { name: /\d+ actividades agrupadas/ })
    await expect(dialogo.getByRole("button", { name: /Grupo nocturno 1/ })).toBeVisible()
    await expect(dialogo.getByRole("button", { name: /Grupo medianoche 1/ })).toBeVisible()
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Semana", exact: true }).click()
    await page.getByRole("button", { name: "Grilla por horas" }).click()

    const calendarioSemana = page.locator(".calendario-semana-scroll")
    const medicionesSemana = await calendarioSemana.evaluate(root => {
        const columnas = [...root.querySelectorAll(".columna-registros-semana")]
        const alturaCapa = root.querySelector(".capa-registros-semana").clientHeight
        const grupos = [...root.querySelectorAll(".grupo-marcas-boton")].map(boton => {
            const caja = boton.getBoundingClientRect()
            const columna = boton.closest(".columna-registros-semana")
            return { top: caja.top - columna.getBoundingClientRect().top, bottom: caja.bottom - columna.getBoundingClientRect().top, alto: columna.clientHeight }
        })
        return { altoDesplazable: root.scrollHeight, altoPanel: root.clientHeight, alturaCapa, columnas: columnas.length, grupos }
    })
    expect(medicionesSemana.columnas).toBe(7)
    expect(medicionesSemana.altoDesplazable).toBeLessThanOrEqual(medicionesSemana.altoPanel + 1)
    expect(medicionesSemana.grupos.length).toBeGreaterThanOrEqual(1)
    for (const grupo of medicionesSemana.grupos) {
        expect(grupo.top).toBeGreaterThanOrEqual(0)
        expect(grupo.bottom).toBeLessThanOrEqual(grupo.alto + 1)
    }
})
