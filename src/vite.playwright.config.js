import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Keep Vite's optimizer cache on D: during Playwright runs. The regular Vite
// configuration remains unchanged for everyday development.
export default defineConfig({
  plugins: [react()],
  cacheDir: 'D:/fabri/Playwright/ViteCache',
})
