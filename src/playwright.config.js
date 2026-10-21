import process from "node:process"

import { defineConfig, devices } from "@playwright/test"

process.env.PLAYWRIGHT_BROWSERS_PATH ??= "D:/fabri/Playwright/Browsers"
const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "5187"

export default defineConfig({
    testDir: "./tests/e2e",
    // Keep Focus artifacts separate from other Playwright projects and from
    // any stale, locked files in the shared TestResults directory.
    outputDir: "D:/fabri/Playwright/FocusTestResults",
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
