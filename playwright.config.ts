import 'dotenv/config'
import { defineConfig, devices } from '@playwright/test'

import { E2E_PORT, E2E_URL, e2eEnvironment } from './e2e/environment'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // The tests share one seeded database. Running them one after another keeps them from stepping on each other.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  // The first visit to each page compiles it. The waits leave room for that.
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: E2E_URL,
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec prisma generate && pnpm exec next dev -p ${E2E_PORT}`,
    url: E2E_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: e2eEnvironment,
  },
})
