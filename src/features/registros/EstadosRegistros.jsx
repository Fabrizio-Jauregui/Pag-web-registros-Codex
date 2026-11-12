import { useState } from "react"

import {
    calcularTiempoEfectivo,
    calcularTiempoPausado,
    calcularTiempoTranscurrido
} from "../../domain/tiempo/CalculosDuracion.js"
import { ControlesRegistro } from "./ControlesRegistro"
import { ResumenDuracion } from "./ResumenDuracion"
import { ListaRegistrosActivos } from "./ListaRegistrosActivos.jsx"

export function EstadosRegistros({ estadoRegistro, eventos = [], tareas = [], categorias = [], ordenEventos, cambiarOrdenEventos, onFinalizarVinculado }) {
    const [origen, cambiarOrigen] = useState({ tipo: "", eventoId: "", tareaId: "", nombre: "", categoriaIds: [] })
    const { datos, registros, registrosActivos, ahora, error, mensaje } = estadoRegistro
    const registroResumen = registrosActivos.at(-1) ?? registros.at(-1) ?? null
    const segmentos = registroResumen?.segmentos ?? []
    const tiempoEfectivo = registroResumen ? calcularTiempoEfectivo(segmentos, ahora) : null
    const tiempoPausado = registroResumen ? calcularTiempoPausado(segmentos, ahora) : null
    const tiempoTranscurrido = registroResumen ? calcularTiempoTranscurrido(segmentos, ahora) : null

    function manejarPlay() {
        const evento = origen.tipo === "evento" ? eventos.find(plantilla => plantilla.id === origen.eventoId) ?? null : null
        const tarea = origen.tipo === "tarea" ? tareas.find(elemento => elemento.id === origen.tareaId) ?? null : null
        const actividadPuntual = origen.tipo === "puntual" ? { nombre: origen.nombre, categoriaIds: origen.categoriaIds } : null
        if (estadoRegistro.iniciar(origen.nombre, evento, tarea, { actividadPuntual })) {
            cambiarOrigen({ tipo: "", eventoId: "", tareaId: "", nombre: "", categoriaIds: [] })
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
                origen={origen}
                cambiarOrigen={cambiarOrigen}
                eventos={eventos}
                tareas={tareas}
                categorias={categorias}
                estado="Inactivo"
                manejarPlay={manejarPlay}
                manejarPause={() => {}}
                manejarStop={() => {}}
                puedeDetener={false}
                bloqueado={!datos.ok}
                ordenEventos={ordenEventos}
                cambiarOrdenEventos={cambiarOrdenEventos}
            />

            <ListaRegistrosActivos registros={registrosActivos} estadoRegistro={estadoRegistro} onFinalizarVinculado={onFinalizarVinculado} />

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
