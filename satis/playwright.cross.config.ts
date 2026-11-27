import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// Sırlar her koşuda rastgele üretilir; yalnızca süreç ortamında yaşar, hiçbir dosyaya yazılmaz.
const CROSS_SECRET = (process.env.CROSS_SECRET ??= randomBytes(32).toString("hex"));
const CROSS_AUTH_SECRET = (process.env.CROSS_AUTH_SECRET ??= randomBytes(32).toString("hex"));
const CROSS_USER_PASSWORD = (process.env.CROSS_USER_PASSWORD ??= `Cross1${randomBytes(12).toString("hex")}A`);

const corePort = Number(process.env.E2E_PORT ?? 3460);
const satisPort = Number(process.env.SATIS_E2E_PORT ?? 3380);
const dbName = process.env.E2E_DB_NAME ?? "eventflow_e2e_f7";

const mobileUse = {
  ...devices["Desktop Chrome"],
  browserName: "chromium" as const,
  viewport: { width: 375, height: 812 },
  hasTouch: true,
};

export default defineConfig({
  testDir: "./e2e-cross",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  outputDir: "test-results-cross",
  use: {
    baseURL: `http://localhost:${satisPort}`,
    locale: "tr-TR",
    timezoneId: "Asia/Famagusta",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobil",
      testIgnore: "**/demo.spec.ts",
      use: mobileUse,
    },
    {
      name: "demo",
      testMatch: "**/demo.spec.ts",
      dependencies: ["mobil"],
      use: mobileUse,
    },
  ],
  webServer: [
    {
      command: "node e2e-cross/start-core.mjs",
      url: `http://localhost:${corePort}/api/health`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        DATABASE_URL: `postgres://postgres@localhost:54329/${dbName}`,
        BETTER_AUTH_SECRET: CROSS_AUTH_SECRET,
        BETTER_AUTH_URL: `http://localhost:${corePort}`,
        CROSS_USER_PASSWORD,
        NEXT_DIST_DIR: ".next-e2e",
        UPLOAD_DIR: "./.next-e2e/uploads",
        SALES_API_SECRET: CROSS_SECRET,
        PAYMENT_PROVIDER: "demo",
        SALES_SITE_URL: `http://localhost:${satisPort}`,
        E2E_PORT: String(corePort),
      },
    },
    {
      command: `npx next dev -p ${satisPort}`,
      url: `http://localhost:${satisPort}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        CORE_API_URL: `http://localhost:${corePort}`,
        SALES_API_SECRET: CROSS_SECRET,
        SITE_URL: `http://localhost:${satisPort}`,
        TRUSTED_IP_HEADER: "x-real-ip",
        // `.next` altında: ayrı kök dizin geliştirme sunucusunu sürekli yeniden yükletir (playwright.config.ts).
        NEXT_DIST_DIR: ".next/cross",
      },
    },
  ],
});
