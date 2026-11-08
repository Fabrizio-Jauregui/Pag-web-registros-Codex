export const ORIGEN_GESTION_FOCUS = "focus"
export const ORIGEN_GESTION_PLANIFICACION = "planificacion"
export const ORIGEN_GESTION_INDEPENDIENTE = "independiente"

export function obtenerOrigenGestionRegistro(registro) {
    if (registro?.origenFocus === true) return ORIGEN_GESTION_FOCUS
    if (typeof registro?.planId === "string" && registro.planId.trim() !== "") {
        return ORIGEN_GESTION_PLANIFICACION
    }
    return ORIGEN_GESTION_INDEPENDIENTE
}
