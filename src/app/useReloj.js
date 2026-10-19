import { useContext } from "react"
import { ContextoReloj } from "./ContextoReloj.js"

export function useReloj() {
    return useContext(ContextoReloj) ?? new Date()
}
