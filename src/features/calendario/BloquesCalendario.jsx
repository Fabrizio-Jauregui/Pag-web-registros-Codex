import { useLayoutEffect, useMemo, useRef, useState } from "react"

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
    eventos = [],
    onSeleccionarRegistro,
    onSeleccionarPlan,
    onAcercarAgrupacion = () => {},
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

    const altoLienzo = escalaTemporal
        ? escalaTemporal.duracionSegundos * escalaTemporal.pixelesPorSegundo
        : 24 * ALTURA_HORA_BASE

    const elementosPosicionados = elementos.map(elemento => {
        const { fragmento } = elemento
        const cantidadCarriles = Math.max(1, fragmento.cantidadCarriles ?? 1)
        const carril = fragmento.carril ?? 0
        const alto = obtenerDuracionVisualPx(
            fragmento.inicio,
            fragmento.fin,
            escalaTemporal?.pixelesPorSegundo ?? ALTURA_HORA_BASE / 3600
        )
        const x = ((carril + 0.5) / cantidadCarriles) * anchoCapa
        const y = escalaTemporal
            ? (fragmento.inicio.getTime() - escalaTemporal.inicio.getTime()) * escalaTemporal.pixelesPorSegundo / 1000
            : (fragmento.minutosInicio ?? 0) * ALTURA_HORA_BASE / 60
        const compacto = alto < 12
        const anchoCarril = anchoCapa / cantidadCarriles - 4
        const izquierdaCarril = (carril / cantidadCarriles) * anchoCapa + 2
        const arribaCompacto = obtenerTopMarcador(y, altoLienzo)

        return {
            ...elemento,
            id: `${elemento.tipo}-${fragmento.id}`,
            alto,
            x,
            y,
            izquierda: compacto ? x - 4 : izquierdaCarril,
            derecha: compacto ? x + 4 : izquierdaCarril + anchoCarril,
            arriba: compacto ? arribaCompacto : y,
            abajo: compacto ? arribaCompacto + 28 : y + Math.max(2, alto)
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
                const topMarcador = escalaTemporal
                    ? obtenerTopMarcador(elemento.y, altoLienzo)
                    : undefined
                const props = {
                    fragmento,
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
                    key={`grupo-${grupo.map(elemento => elemento.id).join("-")}-${indice}`}
                    grupo={grupo}
                    eventos={eventos}
                    onSeleccionar={seleccionar}
                    onAcercar={onAcercarAgrupacion}
                    altoLienzo={altoLienzo}
                    anchoLienzo={anchoCapa}
                />
            ))}
        </div>
    )
}

