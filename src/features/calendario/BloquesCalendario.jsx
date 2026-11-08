import { useLayoutEffect, useMemo, useRef, useState } from "react"

import { ALTURA_HORA_BASE } from "./zoomCalendario.js"
import { BloqueRegistro } from "./BloqueRegistro.jsx"
import { BloquePlan } from "./BloquePlan.jsx"
import { GrupoMarcasCalendario } from "./GrupoMarcasCalendario.jsx"
import {
    agruparMarcadoresCercanos,
    obtenerDuracionVisualPx
} from "./presentacionMarcasCalendario.js"

export function BloquesCalendario({
    fragmentosRegistros = [],
    fragmentosPlanes = [],
    eventos = [],
    onSeleccionarRegistro,
    onSeleccionarPlan,
    onAjustarRegistro,
    onAjustarPlan,
    edicionDirectaHabilitada,
    permiteCambiarDia = false,
    planActivoSeguimientoId = null,
    escalaTemporal = null
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

    const elementosPosicionados = elementos.map(elemento => {
        const { fragmento } = elemento
        const cantidadCarriles = Math.max(1, fragmento.cantidadCarriles ?? 1)
        const carril = fragmento.carril ?? 0
        return {
            ...elemento,
            id: `${elemento.tipo}-${fragmento.id}`,
            alto: obtenerDuracionVisualPx(fragmento.inicio, fragmento.fin, escalaTemporal?.pixelesPorSegundo ?? ALTURA_HORA_BASE / 3600),
            x: ((carril + 0.5) / cantidadCarriles) * anchoCapa,
            y: escalaTemporal
                ? (fragmento.inicio.getTime() - escalaTemporal.inicio.getTime()) * escalaTemporal.pixelesPorSegundo / 1000
                : (fragmento.minutosInicio ?? 0) * ALTURA_HORA_BASE / 60
        }
    })
    const { compactos, grupos, idsAgrupados } = agruparMarcadoresCercanos(elementosPosicionados)
    const compactoPorId = new Set(compactos.map(elemento => elemento.id))

    function seleccionar(tipo, fragmento) {
        if (tipo === "registro") onSeleccionarRegistro(fragmento.registro, fragmento)
        else onSeleccionarPlan(fragmento.plan, fragmento)
    }

    return (
        <div ref={capaRef} className="bloques-calendario-capa">
            {elementosPosicionados.filter(elemento => !idsAgrupados.has(elemento.id)).map(elemento => {
                const { tipo, fragmento, id } = elemento
                const compacto = compactoPorId.has(id)
                const cantidadCarriles = Math.max(1, fragmento.cantidadCarriles ?? 1)
                const anchoCarril = anchoCapa / cantidadCarriles - 4
                const props = {
                    fragmento,
                    compacto,
                    anchoCarril,
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
                    key={`grupo-${grupo.map(elemento => elemento.id).join("-")}-${indice}`}
                    grupo={grupo}
                    eventos={eventos}
                    onSeleccionar={seleccionar}
                />
            ))}
        </div>
    )
}

