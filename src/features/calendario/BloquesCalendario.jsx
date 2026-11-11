import { cloneElement, useLayoutEffect, useMemo, useRef, useState } from "react"

import { ALTURA_HORA_BASE } from "./zoomCalendario.js"
import { BloqueRegistro } from "./BloqueRegistro.jsx"
import { BloquePlan } from "./BloquePlan.jsx"
import { GrupoMarcasCalendario } from "./GrupoMarcasCalendario.jsx"
import {
    agruparMarcadoresCercanos,
    obtenerDuracionVisualPx,
    obtenerTopMarcador
} from "./presentacionMarcasCalendario.js"

export function BloquesCalendario({
    fragmentosRegistros = [],
    fragmentosPlanes = [],
    marcadoresSecuenciales = [],
    eventos = [],
    onSeleccionarRegistro,
    onSeleccionarPlan,
    onAcercarGrupo = () => {},
    onAjustarRegistro,
    onAjustarPlan,
    edicionDirectaHabilitada,
    permiteCambiarDia = false,
    planActivoSeguimientoId = null,
    escalaTemporal = null,
    fechaColumna = null
}) {
    const capaRef = useRef(null)
    const [anchoCapa, cambiarAnchoCapa] = useState(0)
    const elementos = useMemo(() => [
        ...fragmentosRegistros.map(fragmento => ({ tipo: "registro", fragmento })),
        ...fragmentosPlanes.map(fragmento => ({ tipo: "plan", fragmento }))
    ], [fragmentosRegistros, fragmentosPlanes])

    useLayoutEffect(() => {
        const capa = capaRef.current
        if (!capa) return

        function medir() {
            cambiarAnchoCapa(capa.clientWidth)
        }
        medir()
        const observador = new ResizeObserver(medir)
        observador.observe(capa)
        return () => observador.disconnect()
    }, [])

    const pixelesPorSegundo = escalaTemporal?.pixelesPorSegundo ?? ALTURA_HORA_BASE / 3600
    const altoLienzo = escalaTemporal
        ? escalaTemporal.duracionSegundos * escalaTemporal.pixelesPorSegundo
        : 24 * ALTURA_HORA_BASE
    const elementosBase = elementos.map(elemento => {
        const { fragmento } = elemento
        const y = escalaTemporal
            ? (fragmento.inicio.getTime() - escalaTemporal.inicio.getTime()) * pixelesPorSegundo / 1000
            : (fragmento.minutosInicio ?? 0) * ALTURA_HORA_BASE / 60
        const alto = obtenerDuracionVisualPx(fragmento.inicio, fragmento.fin, pixelesPorSegundo)
        const compacto = alto < 12
        const topVisual = compacto && escalaTemporal ? obtenerTopMarcador(y, altoLienzo) : y
        return {
            ...elemento,
            id: `${elemento.tipo}-${fragmento.id}`,
            alto,
            y,
            inicioVisual: topVisual,
            finVisual: topVisual + (compacto ? 28 : Math.max(2, alto)),
            compacto
        }
    })
    const marcadoresBase = marcadoresSecuenciales.flatMap(marcador => {
        const y = escalaTemporal
            ? (marcador.inicio.getTime() - escalaTemporal.inicio.getTime()) * pixelesPorSegundo / 1000
            : ((marcador.inicio.getHours() * 3600 + marcador.inicio.getMinutes() * 60 + marcador.inicio.getSeconds()) * ALTURA_HORA_BASE) / 3600
        if (y < 0 || y > altoLienzo) return []
        const alto = 34
        const top = obtenerTopMarcador(y, altoLienzo, alto)
        return [{
            tipo: "cronometro",
            id: `cronometro-${marcador.id}`,
            marcador,
            y,
            alto,
            inicioVisual: top,
            finVisual: top + alto,
            compacto: false
        }]
    })

    // Distribuir por el espacio visible, no solo por los intervalos de datos:
    // la tarjeta de cronómetro ocupa píxeles para poder leerse, pero no adquiere duración.
    const elementosConCarriles = [...elementosBase, ...marcadoresBase].sort((a, b) => (
        a.inicioVisual - b.inicioVisual || a.finVisual - b.finVisual || a.id.localeCompare(b.id)
    ))
    const gruposVisuales = []
    let grupoVisual = []
    let finGrupoVisual = -Infinity
    for (const elemento of elementosConCarriles) {
        if (grupoVisual.length && elemento.inicioVisual >= finGrupoVisual) {
            gruposVisuales.push(grupoVisual)
            grupoVisual = []
            finGrupoVisual = -Infinity
        }
        grupoVisual.push(elemento)
        finGrupoVisual = Math.max(finGrupoVisual, elemento.finVisual)
    }
    if (grupoVisual.length) gruposVisuales.push(grupoVisual)
    const elementosPosicionados = gruposVisuales.flatMap(grupo => {
        const finCarril = []
        const asignados = grupo.map(elemento => {
            let carril = finCarril.findIndex(fin => fin <= elemento.inicioVisual)
            if (carril < 0) carril = finCarril.length
            finCarril[carril] = elemento.finVisual
            return { ...elemento, carril }
        })
        return asignados.map(elemento => ({
            ...elemento,
            cantidadCarriles: finCarril.length,
            x: ((elemento.carril + 0.5) / finCarril.length) * anchoCapa
        }))
    })
    const elementosContenido = elementosPosicionados.filter(elemento => elemento.tipo !== "cronometro")
    const marcadoresPosicionados = elementosPosicionados.filter(elemento => elemento.tipo === "cronometro")
    const { compactos, grupos, idsAgrupados } = agruparMarcadoresCercanos(
        elementosContenido,
        undefined,
        altoLienzo
    )
    const compactoPorId = new Set(compactos.map(elemento => elemento.id))

    function seleccionar(tipo, fragmento) {
        if (tipo === "registro") onSeleccionarRegistro(fragmento.registro, fragmento)
        else onSeleccionarPlan(fragmento.plan, fragmento)
    }

    return (
        <div ref={capaRef} className="bloques-calendario-capa">
            {elementosContenido.filter(elemento => !idsAgrupados.has(elemento.id)).map(elemento => {
                const { tipo, fragmento, id } = elemento
                const compacto = compactoPorId.has(id)
                const cantidadCarriles = Math.max(1, elemento.cantidadCarriles)
                const anchoCarril = anchoCapa / cantidadCarriles - 4
                const topMarcador = escalaTemporal
                    ? obtenerTopMarcador(elemento.y, altoLienzo)
                    : undefined
                const props = {
                    fragmento: { ...fragmento, carril: elemento.carril, cantidadCarriles },
                    compacto,
                    anchoCarril,
                    topMarcador,
                    desplazamientoMarcaY: escalaTemporal && compacto
                        ? elemento.y - topMarcador - 4
                        : undefined,
                    onAjustarRegistro,
                    onAjustarPlan,
                    edicionDirectaHabilitada,
                    permiteCambiarDia,
                    estaEnSeguimiento: tipo === "plan" && fragmento.plan.id === planActivoSeguimientoId,
                    escalaTemporal
                }

                return tipo === "registro"
                    ? <BloqueRegistro key={id} {...props} onSeleccionar={onSeleccionarRegistro} />
                    : <BloquePlan
                        key={id}
                        {...props}
                        edicionDirectaHabilitada={edicionDirectaHabilitada && fragmento.plan.id !== planActivoSeguimientoId}
                        evento={eventos.find(evento => evento.id === fragmento.plan.eventoId)}
                        onSeleccionar={onSeleccionarPlan}
                    />
            })}
            {grupos.map((grupo, indice) => (
                <GrupoMarcasCalendario
                    key={`grupo-${grupo.elementos.map(elemento => elemento.id).join("-")}-${indice}`}
                    grupo={grupo}
                    eventos={eventos}
                    onSeleccionar={seleccionar}
                    onAcercar={onAcercarGrupo}
                    altoLienzo={altoLienzo}
                    anchoLienzo={anchoCapa}
                    fechaColumna={fechaColumna}
                />
            ))}
            {marcadoresPosicionados.map(({ marcador, y, carril, cantidadCarriles }) => cloneElement(marcador.elemento, {
                key: `${marcador.id}-${fechaColumna ?? "dia"}`,
                style: {
                    ...marcador.elemento.props.style,
                    top: `${obtenerTopMarcador(y, altoLienzo, 34)}px`,
                    left: `calc(${carril * 100 / cantidadCarriles}% + 2px)`,
                    width: `${Math.max(28, Math.min(250, anchoCapa / cantidadCarriles - 4))}px`
                }
            }))}
        </div>
    )
}

