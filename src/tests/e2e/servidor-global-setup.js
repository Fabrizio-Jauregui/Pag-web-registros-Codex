import { spawn } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const raiz = fileURLToPath(new URL("../../../", import.meta.url))
const salida = path.join(raiz, "src", ".playwright-results")
const puerto = process.env.PLAYWRIGHT_PORT ?? "5187"
const url = `http://127.0.0.1:${puerto}`

export default async function iniciarServidor() {
    await mkdir(salida, { recursive: true })
    const vite = path.join(raiz, "node_modules", "vite", "bin", "vite.js")
    const servidor = spawn(process.execPath, [vite, "--config", "src/vite.playwright.config.js", "--configLoader", "runner", "--host", "127.0.0.1", "--port", puerto, "--strictPort"], {
        cwd: raiz,
        stdio: "ignore",
        windowsHide: true
    })
    servidor.unref()
    let salidaTemprana = null
    servidor.once("error", error => { salidaTemprana = error })
    servidor.once("exit", codigo => { salidaTemprana ??= new Error(`Vite terminó antes de estar listo (código ${codigo}).`) })

    const limite = Date.now() + 30_000
    while (Date.now() < limite) {
        if (salidaTemprana) throw salidaTemprana
        try {
            const respuesta = await fetch(url)
            if (respuesta.ok) {
                await writeFile(path.join(salida, `servidor-${puerto}.pid`), String(servidor.pid), "utf8")
                return
            }
        } catch { /* Vite todavía está iniciando. */ }
        await new Promise(resolve => setTimeout(resolve, 200))
    }
    try { process.kill(servidor.pid) } catch { /* Ya terminó. */ }
    throw new Error(`Vite no respondió en ${url} dentro de 30 segundos.`)
}
