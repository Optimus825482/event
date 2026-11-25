import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

import path from "node:path";

import {
  AUTH_STATE_FILE,
  E2E_BASE_URL,
  E2E_DATABASE_URL,
  E2E_PORT,
  FAKE_CAMERA_FILE,
  PROD_AUTH_URL,
  PROD_BASE_URL,
  PROD_DIST_DIR,
  PROD_PORT,
} from "./e2e/support/constants";

// Parolalar ve gizli anahtar her koşuda rastgele üretilir; yalnızca süreç ortamında yaşar
// (kök süreç burada yazar, çalışanlar miras alır). Hiçbir dosyaya yazılmaz.
process.env.E2E_ADMIN_PASSWORD ??= randomBytes(18).toString("base64url");
process.env.E2E_AUTH_SECRET ??= randomBytes(32).toString("hex");

const OFFLINE_SPECS = "**/offline-*.spec.ts";
const DENIED_SPEC = "**/offline-camera-denied.spec.ts";
const FAKE_CAMERA_ARGS = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];
const FAKE_CAMERA_ABSOLUTE = path.resolve(import.meta.dirname, FAKE_CAMERA_FILE);

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
    timezoneId: "Asia/Famagusta",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    { name: "chromium", testIgnore: OFFLINE_SPECS, use: { ...devices["Desktop Chrome"] } },
    {
      // Çevrimdışı yığın (service worker, IndexedDB kuyruğu, kamera): yalnızca üretim derlemesinde çalışır.
      name: "offline",
      testMatch: OFFLINE_SPECS,
      testIgnore: DENIED_SPEC,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: PROD_BASE_URL,
        storageState: { cookies: [], origins: [] },
        serviceWorkers: "allow",
        launchOptions: {
          args: [...FAKE_CAMERA_ARGS, `--use-file-for-fake-video-capture=${FAKE_CAMERA_ABSOLUTE}`],
        },
      },
    },
    {
      // Kamera izni verilmemiş (sahte arayüz bayrağı izni otomatik verdiği için ayrı tarayıcı ayarı gerekir).
      name: "offline-denied",
      testMatch: DENIED_SPEC,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: PROD_BASE_URL,
        storageState: { cookies: [], origins: [] },
        permissions: [],
        launchOptions: { args: ["--use-fake-device-for-media-stream"] },
      },
    },
  ],
  webServer: [
    {
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
    {
      // Üretim derlemesi: kendi portu ve kendi distDir'i (`.next` ve `.next-e2e` dev klasörüne dokunmaz).
      // `compile` kipi tüm repo tip denetimini (başkalarının testleri dahil) çalıştırmaz; tip denetimi ayrıca yapılır.
      command: `npx next build --experimental-build-mode compile && npx next start -p ${PROD_PORT}`,
      url: `${PROD_BASE_URL}/login`,
      reuseExistingServer: false,
      timeout: 420_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        BETTER_AUTH_SECRET: process.env.E2E_AUTH_SECRET,
        // Üretim kipi https:// ister; çerezler `Secure` olur (localhost'ta http üzerinde de kabul edilir).
        BETTER_AUTH_URL: PROD_AUTH_URL,
        BETTER_AUTH_TRUSTED_ORIGINS: PROD_BASE_URL,
        TRUSTED_IP_HEADER: "x-real-ip",
        NEXT_DIST_DIR: PROD_DIST_DIR,
        UPLOAD_DIR: "./.next-e2e/uploads-prod",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
