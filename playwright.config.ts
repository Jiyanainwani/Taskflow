import { defineConfig, devices } from '@playwright/test'

const apiPort = process.env.E2E_API_PORT ?? '3101'
const frontendPort = process.env.E2E_FRONTEND_PORT ?? '3100'
const apiOrigin = `http://127.0.0.1:${apiPort}`
const frontendOrigin = `http://127.0.0.1:${frontendPort}`
const ci = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: ci ? 1 : 0,
  reporter: ci ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: frontendOrigin,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run start:dev',
      cwd: 'backend',
      url: `${apiOrigin}/api/health`,
      name: 'TaskFlow API',
      timeout: 120_000,
      reuseExistingServer: !ci,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: apiPort,
        MONGODB_URI:
          process.env.E2E_MONGODB_URI ??
          'mongodb://127.0.0.1:27017/taskflow_playwright',
        JWT_ACCESS_SECRET:
          'playwright-only-access-secret-should-never-be-used-outside-tests',
        JWT_REFRESH_SECRET:
          'playwright-only-refresh-secret-should-never-be-used-outside-tests',
        FRONTEND_URL: frontendOrigin,
        REDIS_URL: process.env.E2E_REDIS_URL ?? 'redis://127.0.0.1:6379',
        GOOGLE_CLIENT_ID: 'playwright-test-client-id',
        GOOGLE_CLIENT_SECRET: 'playwright-test-client-secret',
        GOOGLE_CALLBACK_URL: `${apiOrigin}/api/auth/google/callback`,
        SENTRY_TEST_ENABLED: 'false',
      },
    },
    {
      command: `npm run dev -- --hostname 127.0.0.1 --port ${frontendPort}`,
      cwd: '.',
      url: frontendOrigin,
      name: 'TaskFlow frontend',
      timeout: 120_000,
      reuseExistingServer: !ci,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: `${apiOrigin}/api`,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
})
