export const ALTO_MINIMO_MARCADOR = 28
export const ALTO_COMPACTO_MARCAS = 12

export function obtenerDuracionVisualPx(inicio, fin, pixelesPorSegundo) {
    if (!(inicio instanceof Date) || !(fin instanceof Date) || !Number.isFinite(pixelesPorSegundo)) {
        return 0
    }

    return Math.max(0, (fin.getTime() - inicio.getTime()) / 1000 * pixelesPorSegundo)
}

export function obtenerTopMarcador(y, altoLienzo, altoObjetivo = ALTO_MINIMO_MARCADOR) {
    if (!Number.isFinite(y) || !Number.isFinite(altoLienzo) || altoLienzo <= 0) return 0
    return Math.max(0, Math.min(y - altoObjetivo / 2, Math.max(0, altoLienzo - altoObjetivo)))
}

export function agruparMarcadoresCercanos(elementos, distancia = ALTO_MINIMO_MARCADOR, altoLienzo = null) {
    const compactos = elementos.filter(elemento => elemento.alto < ALTO_COMPACTO_MARCAS)
    const altoTemporal = Number.isFinite(altoLienzo) && altoLienzo > 0
        ? altoLienzo
        : Math.max(distancia, ...compactos.map(elemento => elemento.y + distancia))
    const cantidadBandas = Math.max(1, Math.floor(altoTemporal / distancia))
    const altoBanda = altoTemporal / cantidadBandas
    const bandas = new Map()
    for (const elemento of compactos) {
        const banda = Math.max(0, Math.min(cantidadBandas - 1, Math.floor(elemento.y / altoBanda)))
        if (!bandas.has(banda)) bandas.set(banda, [])
        bandas.get(banda).push(elemento)
    }

    const grupos = [...bandas.entries()].map(([banda, miembros]) => {
        miembros.sort((a, b) => a.y - b.y || a.x - b.x)
        const yRepresentativo = miembros.reduce((total, elemento) => total + elemento.y, 0) / miembros.length
        const elementoAncla = miembros.reduce((mejor, elemento) => (
            Math.abs(elemento.y - yRepresentativo) < Math.abs(mejor.y - yRepresentativo) ? elemento : mejor
        ), miembros[0])
        return {
            elementos: miembros,
            yRepresentativo,
            yIndicador: (banda + 0.5) * altoBanda,
            xRepresentativo: elementoAncla.x
        }
    })

    return {
        compactos,
        grupos,
        idsAgrupados: new Set(compactos.map(elemento => elemento.id))
    }
}

export function obtenerDuracionLegible(fragmento) {
    return Math.max(0, (fragmento.fin.getTime() - fragmento.inicio.getTime()) / 1000)
}

