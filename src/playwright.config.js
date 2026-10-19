import process from "node:process"

import { defineConfig, devices } from "@playwright/test"

process.env.PLAYWRIGHT_BROWSERS_PATH ??= "D:/fabri/Playwright/Browsers"

export default defineConfig({
    testDir: "./tests/e2e",
    outputDir: "D:/fabri/Playwright/TestResults",
    fullyParallel: true,
    reporter: "list",
    use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:5173",
        trace: "retain-on-failure",
    },
    webServer: {
        command: "npm run dev -- --configLoader runner --host 127.0.0.1 --port 5173 --strictPort",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
})
