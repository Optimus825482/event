import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import base from "../playwright.config";

/** Paralel koşu yapılandırması: ana koşu (3380) sürerken ayrı port, derleme ve çıktı dizinleriyle çalışır.
 *
 *  Kullanım:
 *  SATIS_STATE_DIR=.state-paralel MD_OUT_DIR=../test-results-paralel/mobil-denetim \
 *  SATIS_E2E_PORT=3381 SATIS_FAKE_CORE_PORT=3391 \
 *  npx playwright test -c e2e/paralel.config.ts e2e/mobil-denetim.spec.ts
 */

const port = Number(process.env.SATIS_E2E_PORT ?? 3381);
const fakeCorePort = Number(process.env.SATIS_FAKE_CORE_PORT ?? 3391);
const baseWebServer = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
if (!baseWebServer) throw new Error("Temel yapılandırmada webServer tanımlı değil");

export default defineConfig({
  ...base,
  // Görece yollar (testDir, outputDir) yapılandırma dosyasının dizinine göre çözülür; mutlak yap.
  testDir: resolve(import.meta.dirname),
  outputDir: resolve(import.meta.dirname, "..", "test-results-paralel"),
  // globalSetup yolu yapılandırma dosyasının dizinine göre çözülür; bu dosya e2e/ altında.
  globalSetup: "./global-setup.ts",
  use: { ...base.use, baseURL: `http://localhost:${port}` },
  webServer: {
    ...baseWebServer,
    command: `npx next dev -p ${port}`,
    // webServer varsayılan olarak yapılandırma dosyasının dizininde başlar; next dev proje kökünde çalışmalı.
    cwd: resolve(import.meta.dirname, ".."),
    url: `http://localhost:${port}/api/health`,
    env: {
      ...baseWebServer.env,
      CORE_API_URL: `http://127.0.0.1:${fakeCorePort}`,
      // Ana koşunun .next/e2e dizinine dokunmasın diye ayrı derleme çıktısı.
      NEXT_DIST_DIR: ".next/e2e-paralel",
    },
  },
});
