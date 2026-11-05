import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;

/**
 * Тестове:
 *  - unit: чисти функции (пари, банков импорт, дати) — без браузър;
 *  - e2e: реалното приложение в Chromium срещу PostgreSQL (изисква `npm run build`).
 * Всеки e2e файл започва с нулиране на демо данните, затова се пускат последователно.
 */
export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure", actionTimeout: 10_000, navigationTimeout: 20_000 },
  projects: [
    { name: "unit", testMatch: /unit\/.*\.spec\.ts/ },
    { name: "e2e", testMatch: /e2e\/.*\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 } } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      APP_URL: BASE_URL,
      PAYMENTS_MOCK: "1",
      STRIPE_SECRET_KEY: "",
      SMTP_HOST: "",
      INFOBIP_API_KEY: "",
      CRON_SECRET: "test-cron-secret",
      PLATFORM_FEE_PERCENT: "1",
      MAIL_OUTBOX_FILE: "test-results/outbox.jsonl",
    },
  },
});
