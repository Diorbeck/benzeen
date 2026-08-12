import { defineConfig, devices } from '@playwright/test';

// Smoke-e2e (PR-B): гоняется в CI против собранного приложения с тестовой БД
// (postgres-сервис + миграции + сид). Только гостевые сценарии — никаких
// auth-обходов в прод-коде. Скриншоты упавших шагов уходят артефактами.
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3000/ru',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
