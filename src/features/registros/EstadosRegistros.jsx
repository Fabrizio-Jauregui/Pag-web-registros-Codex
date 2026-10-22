import { useState } from "react"

import {
    calcularTiempoEfectivo,
    calcularTiempoPausado,
    calcularTiempoTranscurrido
} from "../../domain/tiempo/CalculosDuracion.js"
import { ControlesRegistro } from "./ControlesRegistro"
import { ResumenDuracion } from "./ResumenDuracion"
import { ListaRegistrosActivos } from "./ListaRegistrosActivos.jsx"

export function EstadosRegistros({ estadoRegistro, eventos = [], tareas = [] }) {
    const [nombre, cambiarNombre] = useState("")
    const [eventoId, cambiarEventoId] = useState("")
    const [tareaId, cambiarTareaId] = useState("")
    const { datos, registros, registrosActivos, ahora, error, mensaje } = estadoRegistro
    const registroResumen = registrosActivos.at(-1) ?? registros.at(-1) ?? null
    const segmentos = registroResumen?.segmentos ?? []
    const tiempoEfectivo = registroResumen ? calcularTiempoEfectivo(segmentos, ahora) : null
    const tiempoPausado = registroResumen ? calcularTiempoPausado(segmentos, ahora) : null
    const tiempoTranscurrido = registroResumen ? calcularTiempoTranscurrido(segmentos, ahora) : null

    function cambiarEventoSeleccionado(nuevoId) {
        cambiarEventoId(nuevoId)
        const evento = eventos.find(plantilla => plantilla.id === nuevoId)
        cambiarNombre(evento?.nombre ?? "")
    }

    function manejarPlay() {
        const evento = eventos.find(plantilla => plantilla.id === eventoId) ?? null
        const tarea = tareas.find(elemento => elemento.id === tareaId) ?? null

        if (estadoRegistro.iniciar(nombre, evento, tarea)) {
            cambiarNombre("")
            cambiarEventoId("")
            cambiarTareaId("")
        }
    }

    return (
        <>
            <h2 id="titulo-registro">Registro de tiempo</h2>
            <p className="registro-ayuda">Inicia una actividad con temporizador; puedes pausarla, reanudarla y finalizarla cuando quieras.</p>

            {(datos.advertencia || error || !datos.ok) && (
                <p role="alert">
                    {datos.ok ? (error || datos.advertencia) : datos.error}
                </p>
            )}
            {mensaje && <p role="status">{mensaje}</p>}

            <ControlesRegistro
                nombre={nombre}
                cambiarNombre={cambiarNombre}
                eventos={eventos}
                tareas={tareas}
                eventoId={eventoId}
                cambiarEventoId={cambiarEventoSeleccionado}
                tareaId={tareaId}
                cambiarTareaId={cambiarTareaId}
                estado="Inactivo"
                manejarPlay={manejarPlay}
                manejarPause={() => {}}
                manejarStop={() => {}}
                puedeDetener={false}
                bloqueado={!datos.ok}
            />

            {registrosActivos.length > 0 && (
                <ListaRegistrosActivos registros={registrosActivos} estadoRegistro={estadoRegistro} />
            )}

            {registrosActivos.length === 0 && (
                <ResumenDuracion
                    nombreConfirmado={registroResumen?.nombre ?? ""}
                    estadoRegistro={registroResumen?.estado ?? "Inactivo"}
                    tiempoEfectivo={tiempoEfectivo}
                    tiempoPausado={tiempoPausado}
                    tiempoTranscurrido={tiempoTranscurrido}
                />
            )}

        </>
    )
}
