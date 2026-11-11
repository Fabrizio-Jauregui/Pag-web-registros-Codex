import { readFile, rm } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const salida = path.join(fileURLToPath(new URL("../../../", import.meta.url)), "src", ".playwright-results")

export default async function detenerServidor() {
    const puerto = process.env.PLAYWRIGHT_PORT ?? "5187"
    const archivoPid = path.join(salida, `servidor-${puerto}.pid`)
    let pid
    try { pid = Number(await readFile(archivoPid, "utf8")) } catch { return }
    try { process.kill(pid) } catch { /* El servidor ya terminó. */ }
    const url = `http://127.0.0.1:${puerto}`
    const limite = Date.now() + 5_000
    while (Date.now() < limite) {
        try {
            await fetch(url)
            await new Promise(resolve => setTimeout(resolve, 100))
        } catch { break }
    }
    await rm(archivoPid, { force: true })
}
