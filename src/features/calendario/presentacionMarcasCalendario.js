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

export function agruparMarcadoresCercanos(elementos, distancia = ALTO_MINIMO_MARCADOR) {
    const compactos = elementos.filter(elemento => elemento.alto < ALTO_COMPACTO_MARCAS)
    const padres = elementos.map((_, indice) => indice)

    function buscar(indice) {
        if (padres[indice] !== indice) padres[indice] = buscar(padres[indice])
        return padres[indice]
    }

    function unir(a, b) {
        const raizA = buscar(a)
        const raizB = buscar(b)
        if (raizA !== raizB) padres[raizB] = raizA
    }

    const ordenTemporal = elementos
        .map((elemento, indice) => ({ elemento, indice }))
        .sort((a, b) => a.elemento.arriba - b.elemento.arriba || a.elemento.izquierda - b.elemento.izquierda)
    let activos = []

    for (const actual of ordenTemporal) {
        activos = activos.filter(anterior => anterior.elemento.abajo + distancia > actual.elemento.arriba)
        for (const anterior of activos) {
            const primero = anterior.elemento
            const segundo = actual.elemento
            const distanciaHorizontal = Math.max(
                0,
                primero.izquierda - segundo.derecha,
                segundo.izquierda - primero.derecha
            )
            const distanciaVertical = Math.max(
                0,
                primero.arriba - segundo.abajo,
                segundo.arriba - primero.abajo
            )

            if (distanciaHorizontal < distancia && distanciaVertical < distancia) {
                unir(anterior.indice, actual.indice)
            }
        }
        activos.push(actual)
    }

    const gruposPorRaiz = new Map()
    elementos.forEach((elemento, indice) => {
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

