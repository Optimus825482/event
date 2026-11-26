// Derleme çıktısında sır sızıntısı denetimi: koşu başına rastgele nöbetçi sırla `next build` çalıştırır ve
// çıktıda nöbetçinin geçmediğini; ortam modülünün istemci paketine girmediğini doğrular.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { findLeaks } from "./bundle-scan.mjs";

const distDir = ".next-check";
const sentinel = randomBytes(32).toString("hex"); // 64 karakter

rmSync(distDir, { recursive: true, force: true });

const build = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_DIST_DIR: distDir,
    NEXT_TELEMETRY_DISABLED: "1",
    SALES_API_SECRET: sentinel,
    CORE_API_URL: "http://core.invalid",
    SITE_URL: "https://satis.invalid", // üretim kipinde env.ts https ve TRUSTED_IP_HEADER ister
    TRUSTED_IP_HEADER: "x-real-ip",
  },
});
if (build.status !== 0) {
  rmSync(distDir, { recursive: true, force: true });
  console.error("Derleme başarısız oldu.");
  process.exit(build.status ?? 1);
}

let failed = false;

const secretLeaks = findLeaks(distDir, [sentinel]);
if (secretLeaks.length > 0) {
  failed = true;
  console.error("Sır derleme çıktısına sızmış. Dosyalar:");
  for (const file of secretLeaks) console.error(`  ${file}`);
}

const envLeaks = findLeaks(`${distDir}/static`, ["SALES_API_SECRET", "CORE_API_URL"]);
if (envLeaks.length > 0) {
  failed = true;
  console.error("Ortam modülü istemci paketine girmiş. Dosyalar:");
  for (const file of envLeaks) console.error(`  ${file}`);
}

rmSync(distDir, { recursive: true, force: true });

if (failed) process.exit(1);
console.log("Derleme çıktısında sır yok");
