export function MarcoAplicacionPlanificacion({ fragmentos = [], idAplicacion, escalaTemporal = null }) {
    if (!idAplicacion) return null
    const actividades = fragmentos.filter(fragmento => (
        fragmento.plan.idAplicacionPlantilla === idAplicacion
    ))
    if (actividades.length === 0) return null

    const inicioMs = Math.min(...actividades.map(fragmento => fragmento.inicio.getTime()))
    const finMs = Math.max(...actividades.map(fragmento => fragmento.fin.getTime()))
    const inicio = Math.min(...actividades.map(fragmento => fragmento.minutosInicio))
    const fin = Math.max(...actividades.map(fragmento => fragmento.minutosFin))
    const izquierda = Math.min(...actividades.map(fragmento => fragmento.carril / fragmento.cantidadCarriles))
    const derecha = Math.max(...actividades.map(fragmento => (fragmento.carril + 1) / fragmento.cantidadCarriles))

    return (
        <div
            className="marco-aplicacion-planificacion"
            aria-hidden="true"
            data-testid="marco-aplicacion-planificacion"
            style={{
                top: escalaTemporal
                    ? `calc(${(inicioMs - escalaTemporal.inicio.getTime()) / (escalaTemporal.duracionSegundos * 1000) * 100}% - 4px)`
                    : `calc(${inicio / 1440 * 100}% - 4px)`,
                height: escalaTemporal
                    ? `calc(${(finMs - inicioMs) / (escalaTemporal.duracionSegundos * 1000) * 100}% + 8px)`
                    : `calc(${(fin - inicio) / 1440 * 100}% + 8px)`,
                left: `calc(${izquierda * 100}% - 4px)`,
                width: `calc(${(derecha - izquierda) * 100}% + 8px)`
            }}
        />
    )
}
