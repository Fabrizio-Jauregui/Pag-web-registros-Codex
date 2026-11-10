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

test("agrupa marcas breves cercanas y permite elegir cada registro", async ({ page }) => {
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

    const grupo = page.getByRole("button", { name: /Ver 3 actividades cercanas/ })
    await expect(grupo).toBeVisible()
    const cajaGrupo = await grupo.boundingBox()
    expect(cajaGrupo.width).toBeGreaterThanOrEqual(28)
    expect(cajaGrupo.height).toBeGreaterThanOrEqual(28)
    const cajaCapa = await page.locator(".capa-registros-dia").boundingBox()
    expect(Math.abs((cajaCapa.x + cajaCapa.width) - (cajaGrupo.x + cajaGrupo.width))).toBeLessThanOrEqual(1)
    await expect(page.locator(".indicador-borde-conector-horizontal")).toHaveCount(1)
    await grupo.click()
    const lista = page.getByRole("dialog", { name: "3 actividades cercanas" })
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
    const registrosAntes = await page.evaluate(clave => localStorage.getItem(clave), CLAVE_REGISTROS)
    await lista.getByRole("button", { name: "Acercar al tramo" }).click()
    await expect(page.locator(".controles-zoom output")).toContainText("45 segundos")
    expect(await page.evaluate(clave => localStorage.getItem(clave), CLAVE_REGISTROS)).toBe(registrosAntes)
})

test("muestra un indicador para una actividad aislada y deduplica los segmentos al abrir la lista", async ({ page }) => {
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - 1)
    inicio.setHours(10, 0, 0, 0)
    const registros = [
        {
            ...registro("con-pausa", "Actividad con pausa", inicio, new Date(inicio.getTime() + 20_000)),
            segmentos: [
                { tipo: "En curso", inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + 5000).toISOString() },
                { tipo: "Pausado", inicio: new Date(inicio.getTime() + 5000).toISOString(), fin: new Date(inicio.getTime() + 10_000).toISOString() },
                { tipo: "En curso", inicio: new Date(inicio.getTime() + 10_000).toISOString(), fin: new Date(inicio.getTime() + 15_000).toISOString() }
            ]
        },
        registro("breve-vecino", "Actividad vecina", new Date(inicio.getTime() + 20_000), new Date(inicio.getTime() + 25_000)),
        registro("aislado", "Actividad aislada", new Date(inicio.getTime() + 2 * 3600_000), new Date(inicio.getTime() + 2 * 3600_000 + 5000))
    ]
    await page.addInitScript(({ clave, datos }) => localStorage.setItem(clave, JSON.stringify(datos)), {
        clave: CLAVE_REGISTROS,
        datos: registros
    })
    await page.goto("/")
    await page.getByLabel("Ir a fecha").fill(fechaISO(inicio))

    const indicadores = page.locator(".indicador-borde-boton")
    await expect(indicadores).toHaveCount(2)
    await expect(page.getByRole("button", { name: /Ver 1 actividad cercana/ })).toBeVisible()
    await page.getByRole("button", { name: /Ver 2 actividades cercanas/ }).click()
    const lista = page.getByRole("dialog", { name: "2 actividades cercanas" })
    await expect(lista.getByRole("button", { name: /Actividad con pausa/ })).toBeVisible()
    await expect(lista.getByRole("button", { name: /Actividad vecina/ })).toBeVisible()
    await expect(lista.getByRole("button", { name: /Actividad con pausa/ })).toHaveCount(1)
    await expect(lista.getByRole("button", { name: /00:00:05 en pausa/ })).toBeVisible()
})

test("el zoom mantiene el calendario, cruza medianoche y conserva el calendario semanal móvil", async ({ page }) => {
    const dia = new Date()
    dia.setDate(dia.getDate() - 1)
    dia.setHours(23, 59, 50, 0)
    const siguienteDia = new Date(dia.getTime() + 20_000)
    const datos = [
        registro("cruce", "Actividad al cambio de día", dia, siguienteDia),
        registro("seleccion", "Actividad seleccionada", new Date(dia.getTime() - 15_000), new Date(dia.getTime() - 5_000))
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
    const indicadorCruce = page.getByRole("button", { name: /Ver 2 actividades cercanas/ })
    await expect(indicadorCruce).toBeVisible()
    const nombreDia = new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(dia)
    expect(await indicadorCruce.getAttribute("aria-label")).toContain(nombreDia)
    await indicadorCruce.click()
    const grupoMedianoche = page.getByRole("dialog", { name: "2 actividades cercanas" })
    await grupoMedianoche.getByRole("button", { name: /Actividad al cambio de día/ }).click()
    await page.getByRole("button", { name: "Acercar calendario" }).click()

    const zoom = page.locator(".calendario-semana-scroll")
    await expect(zoom).toBeVisible()
    await expect(page.locator(".calendario-separador-dia-semana")).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(zoom).toHaveCSS("overflow-x", "hidden")
    const seleccion = page.locator('.bloque-registro[aria-label*="Actividad al cambio de día"]').first()
    await expect(seleccion).toBeVisible()
    const cajaZoom = await zoom.boundingBox()
    const cajaSeleccion = await seleccion.boundingBox()
    const centroRelativo = (cajaSeleccion.y + cajaSeleccion.height / 2 - cajaZoom.y) / cajaZoom.height
    expect(centroRelativo).toBeGreaterThan(0.1)
    expect(centroRelativo).toBeLessThan(0.9)

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
        const indicadorAislado = root.querySelector('.indicador-borde-boton[aria-label^="Ver 1 actividad cercana"]')
        const cajaIndicador = indicadorAislado.getBoundingClientRect()
        const cajaCapa = capa.getBoundingClientRect()
        return {
            altoPanel: root.clientHeight,
            altoLienzo: capa.clientHeight,
            altoDesplazable: root.scrollHeight,
            grupos,
            indicador: {
                top: cajaIndicador.top - cajaCapa.top,
                alto: cajaIndicador.height,
                right: cajaIndicador.right - cajaCapa.left,
                anchoLienzo: cajaCapa.width
            }
        }
    })
    expect(medicionesDia.altoDesplazable).toBeLessThanOrEqual(medicionesDia.altoPanel + 1)
    expect(medicionesDia.altoLienzo).toBe(medicionesDia.altoPanel)
    expect(medicionesDia.grupos).toHaveLength(3)
    for (const grupo of medicionesDia.grupos) {
        expect(grupo.top).toBeGreaterThanOrEqual(0)
        expect(grupo.bottom).toBeLessThanOrEqual(medicionesDia.altoLienzo + 1)
    }
    expect(medicionesDia.indicador.alto).toBeGreaterThanOrEqual(28)
    expect(medicionesDia.indicador.right).toBeCloseTo(medicionesDia.indicador.anchoLienzo, 0)
    expect(Math.abs(medicionesDia.indicador.top + medicionesDia.indicador.alto / 2 - medicionesDia.altoLienzo / 2)).toBeLessThanOrEqual(15)

    await page.getByRole("button", { name: "Ver 3 actividades cercanas" }).nth(1).click()
    const dialogo = page.getByRole("dialog", { name: "3 actividades cercanas" })
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
    expect(medicionesSemana.grupos).toHaveLength(3)
    for (const grupo of medicionesSemana.grupos) {
        expect(grupo.top).toBeGreaterThanOrEqual(0)
        expect(grupo.bottom).toBeLessThanOrEqual(grupo.alto + 1)
    }
})
