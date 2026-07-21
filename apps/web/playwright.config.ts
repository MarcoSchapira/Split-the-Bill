import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5180'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5180',
    reuseExistingServer: true,
    url: baseURL,
  },
  projects: [390, 768, 1024, 1440].map((width) => ({
    name: `chromium-${width}`,
    use: {
      ...devices['Desktop Chrome'],
      reducedMotion: 'reduce',
      viewport: { width, height: width === 390 ? 844 : 900 },
    },
  })),
})
