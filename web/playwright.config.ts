import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

import { AUTH_STATE_FILE, E2E_BASE_URL, E2E_DATABASE_URL, E2E_PORT } from "./e2e/support/constants";

// Parolalar ve gizli anahtar her koşuda rastgele üretilir; yalnızca süreç ortamında yaşar
// (kök süreç burada yazar, çalışanlar miras alır). Hiçbir dosyaya yazılmaz.
process.env.E2E_ADMIN_PASSWORD ??= randomBytes(18).toString("base64url");
process.env.E2E_AUTH_SECRET ??= randomBytes(32).toString("hex");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  // Tüm testler tek veritabanını paylaşır.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: E2E_BASE_URL,
    storageState: AUTH_STATE_FILE,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Geliştiricinin 3000 portundaki sunucusuna ve `.next` klasörüne dokunmaz.
    command: `npx next dev -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_SECRET: process.env.E2E_AUTH_SECRET,
      BETTER_AUTH_URL: E2E_BASE_URL,
      NEXT_DIST_DIR: ".next-e2e",
      UPLOAD_DIR: "./.next-e2e/uploads",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
