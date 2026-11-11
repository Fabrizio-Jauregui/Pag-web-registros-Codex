import process from "node:process"

import { defineConfig, devices } from "@playwright/test"

process.env.PLAYWRIGHT_BROWSERS_PATH ??= "D:/fabri/Playwright/Browsers"
const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "5187"

export default defineConfig({
    testDir: "./tests/e2e",
    // Store per-run screenshots, traces, and reports in the writable project workspace.
    outputDir: "./.playwright-results",
    globalSetup: "./tests/e2e/servidor-global-setup.js",
    globalTeardown: "./tests/e2e/servidor-global-teardown.js",
    fullyParallel: true,
    reporter: "list",
    use: {
        baseURL: `http://127.0.0.1:${playwrightPort}`,
        trace: "retain-on-failure",
    },
    projects: [
        {
            name: "desktop-chromium",
            testIgnore: "**/planificaciones-movil.spec.js",
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "mobile-chromium",
            testMatch: "**/planificaciones-movil.spec.js",
            use: { ...devices["Pixel 7"] },
        },
    ],
})
