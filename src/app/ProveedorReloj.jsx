import { useEffect, useState } from "react"
import { ContextoReloj } from "./ContextoReloj.js"

export function ProveedorReloj({ activo, children }) {
    const [ahora, cambiarAhora] = useState(() => new Date())

    useEffect(() => {
        if (!activo) return undefined

        const refresco = setTimeout(() => cambiarAhora(new Date()), 0)
        const intervalo = setInterval(() => cambiarAhora(new Date()), 1000)
        return () => {
            clearTimeout(refresco)
            clearInterval(intervalo)
        }
    }, [activo])

    return <ContextoReloj.Provider value={ahora}>{children}</ContextoReloj.Provider>
}
