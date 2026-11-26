import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// Sır her koşuda rastgele üretilir; yalnızca süreç ortamında yaşar, hiçbir dosyaya yazılmaz.
process.env.SATIS_E2E_SECRET ??= randomBytes(32).toString("hex");

const port = Number(process.env.SATIS_E2E_PORT ?? 3380);
const fakeCorePort = Number(process.env.SATIS_FAKE_CORE_PORT ?? 3390);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "tr-TR",
    timezoneId: "Asia/Famagusta",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobil",
      use: { ...devices["Desktop Chrome"], browserName: "chromium", viewport: { width: 375, height: 812 }, hasTouch: true },
    },
  ],
  webServer: {
    command: `npx next dev -p ${port}`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      CORE_API_URL: `http://127.0.0.1:${fakeCorePort}`,
      SALES_API_SECRET: process.env.SATIS_E2E_SECRET,
      SITE_URL: `http://localhost:${port}`,
      TRUSTED_IP_HEADER: "x-real-ip",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
