import { useState } from "react"

import { formatearFechaISO, leerFechaISO, desplazarDia, obtenerFechaLocalHoy } from "../../domain/tiempo/FechaCalendario.js"
import { calcularAnaliticaRegistros, obtenerRangoAnalitico } from "../../domain/tiempo/analiticaRegistros.js"
import { useReloj } from "../../app/useReloj.js"
import "./AnaliticaRegistros.css"

const formatoFecha = new Intl.DateTimeFormat("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
})
const formatoFechaCorta = new Intl.DateTimeFormat("es-AR", {
    day: "numeric", month: "short", year: "numeric"
})

function formatearDuracionAnalitica(segundos) {
    const horas = Math.floor(segundos / 3600)
    const minutos = Math.floor((segundos % 3600) / 60)
    const segundosRestantes = segundos % 60
    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(segundosRestantes).padStart(2, "0")}`
}

export function AnaliticaRegistros({ registros = [], eventos = [], categorias = [], categoriasDisponibles = true, errorCategorias = "", ahora: ahoraInicial = new Date(), datosDisponibles = true, errorCarga = "" }) {
    const [periodo, cambiarPeriodo] = useState("dia")
    const [agruparPor, cambiarAgrupamiento] = useState("evento")
    const [categoriaId, cambiarFiltroCategoria] = useState("")
    const [fecha, cambiarFecha] = useState(() => obtenerFechaLocalHoy(ahoraInicial))
    const reloj = useReloj()
    const ahora = reloj ?? ahoraInicial
    const categoriaFiltro = categoriaId === "__sin_categoria__" || categorias.some(categoria => categoria.id === categoriaId)
        ? categoriaId
        : ""
    const rango = obtenerRangoAnalitico(fecha, periodo)
    const analitica = rango
        ? calcularAnaliticaRegistros(registros, eventos, rango.inicio, rango.fin, ahora, { categorias, agruparPor, categoriaId: categoriaFiltro })
        : { totalSegundos: 0, porEvento: [], porCategoria: [] }
    const grupos = agruparPor === "categoria" ? analitica.porCategoria : analitica.porEvento
    const mayorDuracion = Math.max(0, ...grupos.map(grupo => grupo.segundos))
    const fechaVisible = !rango
        ? ""
        : periodo === "dia"
            ? formatoFecha.format(rango.inicio)
            : `${formatoFechaCorta.format(rango.inicio)} – ${formatoFechaCorta.format(new Date(rango.fin.getTime() - 1))}`

    function moverPeriodo(cantidad) {
        const nuevaFecha = desplazarDia(fecha, cantidad * (periodo === "semana" ? 7 : 1))
        if (nuevaFecha) cambiarFecha(nuevaFecha)
    }

    function elegirFecha(evento) {
        const nuevaFecha = leerFechaISO(evento.target.value)
        if (nuevaFecha) cambiarFecha(nuevaFecha)
    }

    return (
        <section className="analitica-registros" aria-labelledby="titulo-analitica">
            <header className="analitica-cabecera">
                <div>
                    <h2 id="titulo-analitica">Analítica</h2>
                    <p>Consultá el tiempo registrado y su distribución por actividad. Estos datos describen registros; no evalúan productividad.</p>
                </div>
            </header>

            <div className="analitica-controles" role="group" aria-label="Período de analítica">
                <div className="analitica-tipo-periodo" role="group" aria-label="Agrupar por">
                    <button type="button" aria-pressed={periodo === "dia"} onClick={() => cambiarPeriodo("dia")}>Día</button>
                    <button type="button" aria-pressed={periodo === "semana"} onClick={() => cambiarPeriodo("semana")}>Semana</button>
                </div>
                <button type="button" aria-label={periodo === "dia" ? "Día anterior" : "Semana anterior"} onClick={() => moverPeriodo(-1)}>←</button>
                <button type="button" onClick={() => cambiarFecha(obtenerFechaLocalHoy(ahora))}>Hoy</button>
                <button type="button" aria-label={periodo === "dia" ? "Día siguiente" : "Semana siguiente"} onClick={() => moverPeriodo(1)}>→</button>
                <label className="analitica-selector-fecha">
                    <span>Elegir fecha</span>
                    <input type="date" value={formatearFechaISO(fecha)} onChange={elegirFecha} />
                </label>
                <label className="analitica-selector-filtro">
                    <span>Filtrar categoría</span>
                    <select value={categoriaFiltro} disabled={!categoriasDisponibles} onChange={evento => cambiarFiltroCategoria(evento.target.value)}>
                        <option value="">Todas</option>
                        {categorias.map(categoria => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
                        <option value="__sin_categoria__">Sin categoría</option>
                    </select>
                </label>
            </div>

            <label className="analitica-selector-agrupamiento">
                <span>Mostrar tiempo por</span>
                <select value={agruparPor} onChange={evento => cambiarAgrupamiento(evento.target.value)}>
                    <option value="evento">Evento</option>
                    <option value="categoria" disabled={!categoriasDisponibles}>Categoría</option>
                </select>
            </label>
            {!categoriasDisponibles && <p className="analitica-error" role="status">{errorCategorias || "Las categorías no están disponibles; no se puede mostrar este desglose."}</p>}

            <p className="analitica-periodo-visible" aria-live="polite">
                {periodo === "dia" ? "Día: " : "Semana: "}{fechaVisible}
            </p>

            {!datosDisponibles ? (
                <p className="analitica-error" role="alert">
                    {errorCarga || "No se pudieron cargar los registros. La analítica no está disponible."}
                </p>
            ) : (
                <>
                    <section className="analitica-total" aria-label="Tiempo registrado del período">
                        <span>Tiempo registrado total</span>
                        <strong>{formatearDuracionAnalitica(analitica.totalSegundos)}</strong>
                        <p>El total une los intervalos superpuestos para no contar dos veces el mismo tiempo.</p>
                    </section>

                    <section className="analitica-distribucion" aria-labelledby="titulo-distribucion">
                        <header>
                            <div>
                                <h3 id="titulo-distribucion">Tiempo por {agruparPor === "categoria" ? "categoría" : "actividad"}</h3>
                                <p>Duración efectiva. Las pausas no se incluyen.</p>
                            </div>
                        </header>
                        {grupos.length === 0 ? (
                            <p className="analitica-vacia">No hay tiempo registrado en este período.</p>
                        ) : (
                            <>
                                <p className="analitica-ayuda-solapamientos">
                                    Cada grupo también evita duplicar solapamientos dentro de ese evento. Si actividades de eventos distintos coinciden, sus duraciones pueden sumar más que el total del período.
                                </p>
                                <ol className="analitica-lista-eventos" aria-label={`Duración por ${agruparPor === "categoria" ? "categoría" : "evento"}, de mayor a menor`}>
                                    {grupos.map(grupo => {
                                        const proporcion = (grupo.segundos / mayorDuracion) * 100
                                        const idGrupo = agruparPor === "categoria" ? grupo.categoriaId ?? "sin-categoria" : grupo.eventoId ?? "sin-evento"
                                        return (
                                            <li className="analitica-fila-evento" key={idGrupo}>
                                                <div className="analitica-evento-etiqueta">
                                                    {grupo.color && <span className="analitica-evento-color" style={{ "--color-analitica": grupo.color }} aria-hidden="true" />}
                                                    <strong>{grupo.nombre}</strong>
                                                    <span>{formatearDuracionAnalitica(grupo.segundos)}</span>
                                                </div>
                                                <div className="analitica-barra-fondo" role="meter"
                                                    aria-label={`Tiempo registrado de ${grupo.nombre}`}
                                                    aria-valuemin={0} aria-valuemax={mayorDuracion} aria-valuenow={grupo.segundos}
                                                    aria-valuetext={formatearDuracionAnalitica(grupo.segundos)}>
                                                    <span style={{ width: `${proporcion}%`, "--color-analitica": grupo.color ?? "#64748b" }} />
                                                </div>
                                            </li>
                                        )
                                    })}
                                </ol>
                            </>
                        )}
                    </section>
                </>
            )}
        </section>
    )
}
