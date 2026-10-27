import process from "node:process"

import { defineConfig, devices } from "@playwright/test"

process.env.PLAYWRIGHT_BROWSERS_PATH ??= "D:/fabri/Playwright/Browsers"
const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "5187"

export default defineConfig({
    testDir: "./tests/e2e",
    // Store per-run screenshots, traces, and reports in the writable project workspace.
    outputDir: "./.playwright-results",
    fullyParallel: true,
    reporter: "list",
    use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${playwrightPort}`,
        trace: "retain-on-failure",
    },
    webServer: {
        command: `npm run dev -- --config src/vite.playwright.config.js --configLoader runner --host 127.0.0.1 --port ${playwrightPort} --strictPort`,
        url: `http://127.0.0.1:${playwrightPort}`,
        reuseExistingServer: false,
        timeout: 30_000,
    },
})
