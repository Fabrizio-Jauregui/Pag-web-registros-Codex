import { useMemo, useState } from "react"

const hora = segundos => {
    const signo = segundos < 0 ? "−" : ""
    const valor = Math.abs(segundos)
    return `${signo}${String(Math.floor(valor / 3600)).padStart(2, "0")}:${String(Math.floor(valor % 3600 / 60)).padStart(2, "0")}:${String(valor % 60).padStart(2, "0")}`
}
const leerHora = valor => {
    const coincidencia = typeof valor === "string" && valor.match(/^([+-]?)(\d{2,}):(\d{2}):(\d{2})$/)
    if (!coincidencia) return null
    const [, signo, horas, minutos, segundos] = coincidencia
    const total = Number(horas) * 3600 + Number(minutos) * 60 + Number(segundos)
    if (Number(minutos) > 59 || Number(segundos) > 59 || total > 86400) return null
    return total * (signo === "-" ? -1 : 1)
}
const nuevaActividad = (secuenciaId, ordenSecuencia, nombre = "") => ({
    id: globalThis.crypto.randomUUID(), nombre, eventoId: null, duracionSegundos: 1800,
    secuenciaId, ordenSecuencia, anclaActividadId: null, desplazamientoAnclaSegundos: 0
})

function convertirPlantillaAEditor(plantilla) {
    if (!plantilla) {
        const secuenciaId = globalThis.crypto.randomUUID()
        return [nuevaActividad(secuenciaId, 0), nuevaActividad(secuenciaId, 1)]
    }
    const actividades = plantilla.actividades ?? []
    if (plantilla.modo === "secuencias") return actividades.map(actividad => ({ ...actividad }))
    if (plantilla.modo === "duraciones") {
        const secuenciaId = globalThis.crypto.randomUUID()
        return actividades.map((actividad, indice) => ({
            ...actividad, secuenciaId, ordenSecuencia: indice, anclaActividadId: null,
            desplazamientoAnclaSegundos: 0, duracionSegundos: actividad.duracionSegundos ?? 1800
        }))
    }
    const offsetsOriginales = actividades.map(actividad => plantilla.modo === "relativo"
        ? actividad.inicioDesplazamientoSegundos ?? 0
        : actividad.inicioSegundos ?? 0)
    const base = plantilla.modo === "relativo" ? 0 : Math.min(...offsetsOriginales)
    const offsets = offsetsOriginales.map(offset => offset - base)
    const duracion = actividad => plantilla.modo === "horarios"
        ? ((actividad.finDia ?? 0) * 86400 + (actividad.finSegundos ?? 0)) - (actividad.inicioSegundos ?? 0)
        : actividad.duracionSegundos ?? 1800
    const principalId = globalThis.crypto.randomUUID()
    const principal = { ...actividades[0], secuenciaId: principalId, ordenSecuencia: 0, anclaActividadId: null, desplazamientoAnclaSegundos: offsets[0], duracionSegundos: duracion(actividades[0]) }
    return [principal, ...actividades.slice(1).map((actividad, indice) => ({
        ...actividad,
        secuenciaId: globalThis.crypto.randomUUID(),
        ordenSecuencia: 0,
        anclaActividadId: principal.id,
        desplazamientoAnclaSegundos: offsets[indice + 1] - offsets[0],
        duracionSegundos: duracion(actividad)
    }))]
}

export function EditorPlantillaCalendario({ plantilla = null, eventos, onGuardar, onCancelar }) {
    const [modoEdicion, cambiarModoEdicion] = useState(plantilla?.modo === "cronometro" ? "cronometro" : "secuencias")
    const [nombre, cambiarNombre] = useState(plantilla?.nombre ?? "")
    const [actividades, cambiarActividades] = useState(() => convertirPlantillaAEditor(plantilla))
    const [seleccionada, cambiarSeleccionada] = useState(() => actividades[0]?.id ?? null)
    const [desplazamientosTexto, cambiarDesplazamientosTexto] = useState({})
    const [error, cambiarError] = useState("")
    const actividadesCalculadas = useMemo(() => {
        const porId = new Map()
        const grupos = new Map()
        actividades.forEach(actividad => {
            if (!grupos.has(actividad.secuenciaId)) grupos.set(actividad.secuenciaId, [])
            grupos.get(actividad.secuenciaId).push(actividad)
        })
        for (const grupo of grupos.values()) grupo.sort((a, b) => a.ordenSecuencia - b.ordenSecuencia)
        function inicioDe(actividad) {
            if (porId.has(actividad.id)) return porId.get(actividad.id)
            const grupo = grupos.get(actividad.secuenciaId)
            const indice = grupo.findIndex(item => item.id === actividad.id)
            const inicio = indice > 0
                ? inicioDe(grupo[indice - 1]) + grupo[indice - 1].duracionSegundos
                : actividad.anclaActividadId
                    ? inicioDe(actividades.find(item => item.id === actividad.anclaActividadId)) + (actividad.desplazamientoAnclaSegundos ?? 0)
                    : actividad.desplazamientoAnclaSegundos ?? 0
            porId.set(actividad.id, inicio)
            return inicio
        }
        return actividades.map(actividad => ({ ...actividad, inicioDesplazamientoSegundos: inicioDe(actividad) }))
    }, [actividades])
    const seleccion = actividades.find(actividad => actividad.id === seleccionada)
    const secuencias = [...new Set(actividades.map(actividad => actividad.secuenciaId))]

    function actualizar(id, cambios) {
        cambiarActividades(actuales => actuales.map(actividad => actividad.id === id ? { ...actividad, ...cambios } : actividad))
        cambiarError("")
    }
    function agregarAlFinal() {
        if (!seleccion) return
        const grupo = actividades.filter(actividad => actividad.secuenciaId === seleccion.secuenciaId)
        const actividad = nuevaActividad(seleccion.secuenciaId, grupo.length, "Nueva actividad")
        const ultima = grupo.sort((a, b) => a.ordenSecuencia - b.ordenSecuencia).at(-1)
        actividad.anclaActividadId = ultima.anclaActividadId ?? null
        actividad.desplazamientoAnclaSegundos = ultima.desplazamientoAnclaSegundos ?? 0
        cambiarActividades(actuales => [...actuales, actividad])
        cambiarSeleccionada(actividad.id)
    }
    function agregarEnParalelo() {
        if (!seleccion) return
        const secuenciaId = globalThis.crypto.randomUUID()
        const actividad = nuevaActividad(secuenciaId, 0, "Nueva actividad")
        actividad.anclaActividadId = seleccion.id
        actividad.desplazamientoAnclaSegundos = 0
        cambiarActividades(actuales => [...actuales, actividad])
        cambiarSeleccionada(actividad.id)
    }
    function quitar(id) {
        const dependientes = actividades.filter(item => item.anclaActividadId === id)
        if (dependientes.length) {
            cambiarError("No se puede quitar esta actividad porque otras secuencias la usan como referencia. Quitá esas secuencias primero.")
            return
        }
        const actividad = actividades.find(item => item.id === id)
        const grupo = actividades.filter(item => item.secuenciaId === actividad.secuenciaId).sort((a, b) => a.ordenSecuencia - b.ordenSecuencia)
        const promovida = actividad.ordenSecuencia === 0 ? grupo[1] : null
        const restantes = actividades.filter(item => item.id !== id).map(item => {
            if (item.id === promovida?.id) return { ...item, ordenSecuencia: 0, anclaActividadId: actividad.anclaActividadId ?? null, desplazamientoAnclaSegundos: actividad.desplazamientoAnclaSegundos ?? 0 }
            return item.secuenciaId === actividad.secuenciaId && item.ordenSecuencia > actividad.ordenSecuencia
                ? { ...item, ordenSecuencia: item.ordenSecuencia - 1 }
                : item
        })
        cambiarActividades(restantes)
        if (seleccionada === id) cambiarSeleccionada(restantes[0]?.id ?? null)
        cambiarError("")
    }
    function moverDentroDeSecuencia(id, destinoId) {
        const origen = actividades.find(item => item.id === id)
        const destino = actividades.find(item => item.id === destinoId)
        if (!origen || !destino || origen.secuenciaId !== destino.secuenciaId) return
        const ordenadas = actividades.filter(item => item.secuenciaId === origen.secuenciaId).sort((a, b) => a.ordenSecuencia - b.ordenSecuencia)
        const desde = ordenadas.findIndex(item => item.id === id)
        const hasta = ordenadas.findIndex(item => item.id === destinoId)
        ordenadas.splice(hasta, 0, ordenadas.splice(desde, 1)[0])
        const posiciones = new Map(ordenadas.map((item, indice) => [item.id, indice]))
        cambiarActividades(actuales => actuales.map(item => posiciones.has(item.id) ? { ...item, ordenSecuencia: posiciones.get(item.id) } : item))
    }
    function guardar() {
        if (!nombre.trim()) { cambiarError("Escribí el nombre de la plantilla."); return }
        if (actividades.length < 2) { cambiarError("Agregá al menos dos actividades a la plantilla."); return }
        for (const actividad of actividades) {
            if (!actividad.nombre.trim() && !actividad.eventoId) { cambiarError("Escribí un nombre o elegí un evento para cada actividad."); return }
            const duracionEnCampo = actividad.duracionTexto === undefined ? actividad.duracionSegundos : leerHora(actividad.duracionTexto)
            if (!Number.isInteger(duracionEnCampo) || duracionEnCampo <= 0 || duracionEnCampo > 86400) { cambiarError("Cada duración debe ser mayor que cero y usar HH:MM:SS."); return }
            if (!Number.isInteger(actividad.duracionSegundos) || actividad.duracionSegundos <= 0 || actividad.duracionSegundos > 86400) { cambiarError("Cada duración debe ser mayor que cero y no superar 24 horas."); return }
        }
        const total = actividadesCalculadas
        if (total.some(actividad => actividad.inicioDesplazamientoSegundos < 0 || actividad.inicioDesplazamientoSegundos + actividad.duracionSegundos > 86400)) {
            cambiarError("Las actividades deben quedar dentro de las primeras 24 horas desde el inicio de la plantilla.")
            return
        }
        const resultado = onGuardar({
            id: plantilla?.id, nombre: nombre.trim(), modo: "secuencias",
            actividades: total.map(actividad => ({
                id: actividad.id, nombre: (eventos.find(evento => evento.id === actividad.eventoId)?.nombre ?? actividad.nombre).trim(),
                eventoId: actividad.eventoId ?? null, duracionSegundos: actividad.duracionSegundos,
                secuenciaId: actividad.secuenciaId, ordenSecuencia: actividad.ordenSecuencia,
                anclaActividadId: actividad.anclaActividadId ?? null,
                desplazamientoAnclaSegundos: actividad.desplazamientoAnclaSegundos ?? 0,
                inicioDesplazamientoSegundos: actividad.inicioDesplazamientoSegundos
            }))
        })
        if (!resultado.ok) { cambiarError(resultado.error); return }
        onCancelar()
    }

    if (modoEdicion === "cronometro") return <EditorPlantillaCronometro plantilla={plantilla} eventos={eventos} onGuardar={onGuardar} onCancelar={onCancelar} onCambiarModo={() => cambiarModoEdicion("secuencias")} />

    return <section className="editor-plantilla-calendario" aria-labelledby="titulo-editor-plantilla">
        <header><div><p className="editor-plantilla-etiqueta">Diseñador de secuencias</p><h3 id="titulo-editor-plantilla">{plantilla?.id ? `Editar: ${plantilla.nombre}` : "Crear plantilla"}</h3><p>Las actividades de una secuencia empiezan cuando termina la anterior. Para solapar, seleccioná una actividad y agregá una secuencia paralela.</p></div><button type="button" onClick={onCancelar}>Cancelar</button></header>
        <label className="editor-plantilla-nombre">Nombre de la plantilla<input aria-label="Nombre de la plantilla" maxLength={80} value={nombre} onChange={e => cambiarNombre(e.target.value)} /></label>
        <button type="button" onClick={() => cambiarModoEdicion("cronometro")}>Crear planificación sin duraciones</button>
        <div className="editor-secuencias-acciones"><button type="button" onClick={agregarAlFinal} disabled={!seleccion}>Agregar al final de la secuencia seleccionada</button><button type="button" onClick={agregarEnParalelo} disabled={!seleccion}>Agregar en paralelo a la actividad seleccionada</button></div>
        <div className="editor-secuencias" aria-label="Secuencias de la plantilla">
            {secuencias.map((secuenciaId, indiceSecuencia) => {
                const grupo = actividades.filter(actividad => actividad.secuenciaId === secuenciaId).sort((a, b) => a.ordenSecuencia - b.ordenSecuencia)
                const primera = grupo[0]
                const ancla = actividades.find(actividad => actividad.id === primera?.anclaActividadId)
                const offset = primera?.desplazamientoAnclaSegundos ?? 0
                return <section className="editor-secuencia" key={secuenciaId} aria-label={indiceSecuencia === 0 ? "Secuencia principal" : `Secuencia paralela ${indiceSecuencia}`}>
                    <h4>{indiceSecuencia === 0 ? "Secuencia principal" : `En paralelo con ${ancla?.nombre || "actividad seleccionada"}`}</h4>
                    {ancla && <div className="editor-secuencia-ajuste"><label className="editor-secuencia-desplazamiento">Empieza <select aria-label={`Relación con ${ancla.nombre || "la actividad de referencia"}`} value={offset < 0 ? "antes" : offset === 0 ? "durante" : "despues"} onChange={e => {
                        const magnitud = Math.abs(offset)
                        const valor = e.target.value === "antes" ? -(magnitud || 60) : e.target.value === "despues" ? (magnitud || 60) : 0
                        cambiarActividades(actuales => actuales.map(item => item.secuenciaId === secuenciaId ? { ...item, desplazamientoAnclaSegundos: valor } : item))
                    }}><option value="antes">antes de</option><option value="durante">al mismo tiempo que</option><option value="despues">después de</option></select><input aria-label={`Desplazamiento respecto de ${ancla.nombre || "la actividad de referencia"}`} value={desplazamientosTexto[secuenciaId] ?? hora(Math.abs(offset))} onChange={e => {
                        const texto = e.target.value
                        cambiarDesplazamientosTexto(actual => ({ ...actual, [secuenciaId]: texto }))
                        const magnitud = leerHora(texto)
                        if (magnitud !== null && magnitud >= 0) {
                            const signo = primera.desplazamientoAnclaSegundos < 0 ? -1 : 1
                            cambiarActividades(actuales => actuales.map(item => item.secuenciaId === secuenciaId ? { ...item, desplazamientoAnclaSegundos: signo * magnitud } : item))
                        }
                    }} onBlur={() => {
                        const valor = leerHora(desplazamientosTexto[secuenciaId] ?? hora(Math.abs(offset)))
                        if (valor === null || valor < 0) { cambiarError("El desplazamiento debe tener formato HH:MM:SS."); return }
                        const signo = primera.desplazamientoAnclaSegundos < 0 ? -1 : 1
                        const desplazamientoAnclaSegundos = signo * Math.abs(valor)
                        cambiarActividades(actuales => actuales.map(item => item.secuenciaId === secuenciaId ? { ...item, desplazamientoAnclaSegundos } : item))
                        cambiarDesplazamientosTexto(actual => ({ ...actual, [secuenciaId]: undefined }))
                        cambiarError("")
                    }} /><span>el inicio de {ancla?.nombre || "la referencia"}</span></label><p className="editor-secuencia-relacion" role="status">{offset === 0
                        ? `Empieza al mismo tiempo que ${ancla?.nombre || "la actividad de referencia"}.`
                        : `Empieza ${hora(Math.abs(offset))} ${offset < 0 ? "antes" : "después"} del inicio de ${ancla?.nombre || "la actividad de referencia"}.`}</p><label className="editor-secuencia-control-posicion">Ajuste visual del desplazamiento<input type="range" min="-86400" max="86400" step="60" value={offset} onChange={e => {
                        const desplazamientoAnclaSegundos = Number(e.target.value)
                        cambiarActividades(actuales => actuales.map(item => item.secuenciaId === secuenciaId ? { ...item, desplazamientoAnclaSegundos } : item))
                        cambiarDesplazamientosTexto(actual => ({ ...actual, [secuenciaId]: undefined }))
                    }} /></label></div>}
                    {grupo.map((actividad, indice) => {
                        const evento = eventos.find(item => item.id === actividad.eventoId)
                        const calculada = actividadesCalculadas.find(item => item.id === actividad.id)
                        return <fieldset key={actividad.id} className={seleccionada === actividad.id ? "editor-plantilla-actividad seleccionada" : "editor-plantilla-actividad"} draggable onDragStart={evento => evento.dataTransfer.setData("text/plain", actividad.id)} onDragOver={evento => evento.preventDefault()} onDrop={evento => { evento.preventDefault(); moverDentroDeSecuencia(evento.dataTransfer.getData("text/plain"), actividad.id) }} onClick={() => cambiarSeleccionada(actividad.id)}>
                            <legend>Actividad {indice + 1}</legend>
                            <small className="editor-secuencia-tiempo">Empieza en +{hora(calculada?.inicioDesplazamientoSegundos ?? 0)} · dura {hora(actividad.duracionSegundos)}</small>
                            <label>Evento (opcional)<select value={actividad.eventoId ?? ""} onChange={e => {
                                const seleccionado = eventos.find(item => item.id === e.target.value)
                                actualizar(actividad.id, { eventoId: seleccionado?.id ?? null, ...(seleccionado ? { nombre: seleccionado.nombre } : {}) })
                            }}><option value="">Sin evento</option>{eventos.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
                            <label>Nombre<input aria-label="Nombre" value={evento?.nombre ?? actividad.nombre} disabled={Boolean(evento)} maxLength={80} onChange={e => actualizar(actividad.id, { nombre: e.target.value })} /></label>
                            <label>Duración (HH:MM:SS)<input aria-label="Duración (HH:MM:SS)" inputMode="numeric" value={actividad.duracionTexto ?? hora(actividad.duracionSegundos)} onChange={e => {
                                const duracion = leerHora(e.target.value)
                                actualizar(actividad.id, { duracionTexto: e.target.value, ...(duracion !== null && duracion > 0 ? { duracionSegundos: duracion } : {}) })
                            }} onBlur={() => {
                                const valor = leerHora(actividad.duracionTexto ?? "")
                                if (valor === null || valor <= 0) cambiarError("La duración debe ser mayor que cero y usar el formato HH:MM:SS.")
                                else actualizar(actividad.id, { duracionSegundos: valor, duracionTexto: undefined })
                            }} /></label>
                            <div className="editor-secuencia-reordenar"><button type="button" disabled={indice === 0} onClick={() => moverDentroDeSecuencia(actividad.id, grupo[indice - 1]?.id)}>Subir</button><button type="button" disabled={indice === grupo.length - 1} onClick={() => moverDentroDeSecuencia(actividad.id, grupo[indice + 1]?.id)}>Bajar</button><button type="button" onClick={() => quitar(actividad.id)}>Quitar actividad</button></div>
                        </fieldset>
                    })}
                </section>
            })}
        </div>
        {error && <p role="alert">{error}</p>}
        <footer><button type="button" className="plan-plantilla-primario" onClick={guardar}>Guardar plantilla</button><button type="button" onClick={onCancelar}>Cancelar</button></footer>
    </section>
}

function EditorPlantillaCronometro({ plantilla, eventos, onGuardar, onCancelar, onCambiarModo }) {
    const crearGrupo = (actividades = []) => Math.max(-1, ...actividades.map(item => item.grupoCronometro ?? -1)) + 1
    const [nombre, cambiarNombre] = useState(plantilla?.nombre ?? "")
    const [actividades, cambiarActividades] = useState(() => {
        if (plantilla?.modo === "cronometro") return plantilla.actividades.map(item => ({ ...item }))
        if (plantilla?.actividades?.length) return plantilla.actividades.map((item, indice) => ({
            id: item.id ?? globalThis.crypto.randomUUID(), nombre: item.nombre ?? "", eventoId: item.eventoId ?? null, grupoCronometro: indice
        }))
        return [
            { id: globalThis.crypto.randomUUID(), nombre: "", eventoId: null, grupoCronometro: 0 },
            { id: globalThis.crypto.randomUUID(), nombre: "", eventoId: null, grupoCronometro: 1 }
        ]
    })
    const [error, cambiarError] = useState("")
    const grupos = [...new Set(actividades.map(item => item.grupoCronometro))].sort((a, b) => a - b)

    function actualizar(id, cambios) {
        cambiarActividades(actuales => actuales.map(item => item.id === id ? { ...item, ...cambios } : item))
    }
    function agregarSiguiente(id) {
        const seleccionado = actividades.find(item => item.id === id)
        if (!seleccionado) return
        cambiarActividades(actuales => [...actuales, { id: globalThis.crypto.randomUUID(), nombre: "", eventoId: null, grupoCronometro: crearGrupo(actuales) }])
    }
    function agregarParalelo(grupo) {
        cambiarActividades(actuales => [...actuales, { id: globalThis.crypto.randomUUID(), nombre: "", eventoId: null, grupoCronometro: grupo }])
    }
    function mover(id, delta) {
        const ordenados = [...actividades]
        const indice = ordenados.findIndex(item => item.id === id)
        const destino = indice + delta
        if (destino < 0 || destino >= ordenados.length) return
        ;[ordenados[indice], ordenados[destino]] = [ordenados[destino], ordenados[indice]]
        const mapa = new Map()
        let siguiente = 0
        const normalizados = ordenados.map(item => {
            if (!mapa.has(item.grupoCronometro)) mapa.set(item.grupoCronometro, siguiente++)
            return { ...item, grupoCronometro: mapa.get(item.grupoCronometro) }
        })
        cambiarActividades(normalizados)
    }
    function quitar(id) {
        const restantes = actividades.filter(item => item.id !== id)
        const mapa = new Map()
        cambiarActividades(restantes.map(item => {
            if (!mapa.has(item.grupoCronometro)) mapa.set(item.grupoCronometro, mapa.size)
            return { ...item, grupoCronometro: mapa.get(item.grupoCronometro) }
        }))
    }
    function guardar() {
        if (!nombre.trim()) { cambiarError("Escribí el nombre de la plantilla."); return }
        if (actividades.length < 2) { cambiarError("Agregá al menos dos eventos."); return }
        if (actividades.some(item => !item.nombre.trim() && !item.eventoId)) { cambiarError("Escribí un nombre o elegí un evento para cada actividad."); return }
        const indices = new Map()
        const items = actividades.map(item => {
            if (!indices.has(item.grupoCronometro)) indices.set(item.grupoCronometro, indices.size)
            const evento = eventos.find(elemento => elemento.id === item.eventoId)
            return { id: item.id, nombre: (evento?.nombre ?? item.nombre).trim(), eventoId: item.eventoId ?? null, grupoCronometro: indices.get(item.grupoCronometro), ordenSecuencia: indices.get(item.grupoCronometro) }
        })
        const resultado = onGuardar({ id: plantilla?.id, nombre: nombre.trim(), modo: "cronometro", actividades: items })
        if (!resultado.ok) { cambiarError(resultado.error); return }
        onCancelar()
    }
    return <section className="editor-plantilla-calendario editor-plantilla-cronometro" aria-labelledby="titulo-editor-plantilla">
        <header><div><p className="editor-plantilla-etiqueta">Planificación con cronómetro</p><h3 id="titulo-editor-plantilla">{plantilla?.id ? `Editar: ${plantilla.nombre}` : "Crear plantilla"}</h3><p>Definí el orden. Cada evento empezará cuando lo inicies y continuará hasta que lo finalices.</p></div><button type="button" onClick={onCancelar}>Cancelar</button></header>
        <label className="editor-plantilla-nombre">Nombre de la plantilla<input aria-label="Nombre de la plantilla" maxLength={80} value={nombre} onChange={e => cambiarNombre(e.target.value)} /></label>
        <button type="button" onClick={onCambiarModo}>Volver a la planificación con duraciones</button>
        <div className="editor-secuencias-acciones"><p>Agregá eventos a la misma etapa para iniciarlos juntos o por separado; la etapa siguiente se puede iniciar aunque estos sigan activos.</p></div>
        <div className="editor-secuencias" aria-label="Eventos secuenciales">
            {grupos.map((grupo, indiceGrupo) => <section className="editor-secuencia" key={grupo} aria-label={`Etapa ${indiceGrupo + 1}`}>
                <h4>Etapa {indiceGrupo + 1}{actividades.filter(item => item.grupoCronometro === grupo).length > 1 ? " · eventos paralelos" : ""}</h4>
                {actividades.filter(item => item.grupoCronometro === grupo).map((actividad, indice) => <fieldset className="editor-plantilla-actividad" key={actividad.id}>
                    <legend>Evento {indice + 1}</legend>
                    <label>Evento (opcional)<select value={actividad.eventoId ?? ""} onChange={e => { const evento = eventos.find(item => item.id === e.target.value); actualizar(actividad.id, { eventoId: evento?.id ?? null, ...(evento ? { nombre: evento.nombre } : {}) }) }}><option value="">Sin evento</option>{eventos.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
                    <label>Nombre<input aria-label="Nombre" value={eventos.find(item => item.id === actividad.eventoId)?.nombre ?? actividad.nombre} disabled={Boolean(actividad.eventoId)} maxLength={80} onChange={e => actualizar(actividad.id, { nombre: e.target.value })} /></label>
                    <div className="editor-secuencia-reordenar"><button type="button" onClick={() => mover(actividad.id, -1)} disabled={actividades[0]?.id === actividad.id}>Subir</button><button type="button" onClick={() => mover(actividad.id, 1)} disabled={actividades.at(-1)?.id === actividad.id}>Bajar</button><button type="button" onClick={() => agregarSiguiente(actividad.id)}>Agregar etapa siguiente</button><button type="button" onClick={() => agregarParalelo(grupo)}>Agregar en paralelo</button><button type="button" disabled={actividades.length <= 2} onClick={() => quitar(actividad.id)}>Quitar evento</button></div>
                </fieldset>)}
            </section>)}
        </div>
        {error && <p role="alert">{error}</p>}
        <footer><button type="button" className="plan-plantilla-primario" onClick={guardar}>Guardar plantilla</button><button type="button" onClick={onCancelar}>Cancelar</button></footer>
    </section>
}
