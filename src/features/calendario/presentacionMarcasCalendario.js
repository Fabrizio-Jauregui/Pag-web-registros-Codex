export const ALTO_MINIMO_MARCADOR = 28
export const ALTO_COMPACTO_MARCAS = 12

export function obtenerDuracionVisualPx(inicio, fin, pixelesPorSegundo) {
    if (!(inicio instanceof Date) || !(fin instanceof Date) || !Number.isFinite(pixelesPorSegundo)) {
        return 0
    }

    return Math.max(0, (fin.getTime() - inicio.getTime()) / 1000 * pixelesPorSegundo)
}

export function agruparMarcadoresCercanos(elementos, distancia = ALTO_MINIMO_MARCADOR) {
    const compactos = elementos.filter(elemento => elemento.alto < ALTO_COMPACTO_MARCAS)
    const padres = compactos.map((_, indice) => indice)

    function buscar(indice) {
        if (padres[indice] !== indice) padres[indice] = buscar(padres[indice])
        return padres[indice]
    }

    function unir(a, b) {
        const raizA = buscar(a)
        const raizB = buscar(b)
        if (raizA !== raizB) padres[raizB] = raizA
    }

    for (let a = 0; a < compactos.length; a += 1) {
        for (let b = a + 1; b < compactos.length; b += 1) {
            if (Math.abs(compactos[a].x - compactos[b].x) < distancia
                && Math.abs(compactos[a].y - compactos[b].y) < distancia) {
                unir(a, b)
            }
        }
    }

    const gruposPorRaiz = new Map()
    compactos.forEach((elemento, indice) => {
        const raiz = buscar(indice)
        if (!gruposPorRaiz.has(raiz)) gruposPorRaiz.set(raiz, [])
        gruposPorRaiz.get(raiz).push(elemento)
    })

    const grupos = [...gruposPorRaiz.values()]
        .filter(grupo => grupo.length > 1)
        .map(grupo => grupo.sort((a, b) => a.y - b.y || a.x - b.x))

    return {
        compactos,
        grupos,
        idsAgrupados: new Set(grupos.flatMap(grupo => grupo.map(elemento => elemento.id)))
    }
}

export function obtenerDuracionLegible(fragmento) {
    return Math.max(0, (fragmento.fin.getTime() - fragmento.inicio.getTime()) / 1000)
}

