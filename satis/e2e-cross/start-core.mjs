// Çekirdeği (web/) tohumlar ve `next dev` olarak başlatır. Ortam (DATABASE_URL vb.) Playwright config'inden gelir.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const satisRoot = path.resolve(here, "..");
const coreRoot = path.resolve(satisRoot, "..", "web");
const port = process.env.E2E_PORT ?? "3460";
const stateFile = path.join(here, ".state.json");

const seed = spawnSync(
  process.execPath,
  [
    path.join(coreRoot, "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(here, "seed-core.ts"),
    "--out",
    stateFile,
    "--tables",
    process.env.SEED_TABLES ?? "6",
    "--seats",
    process.env.SEED_SEATS ?? "8",
  ],
  { cwd: coreRoot, encoding: "utf8", env: process.env },
);
if (seed.status !== 0) {
  process.stderr.write(`Çekirdek tohumu başarısız (çıkış ${seed.status}):\n${seed.stdout ?? ""}\n${seed.stderr ?? ""}\n`);
  process.exit(1);
}

const next = path.join(coreRoot, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [next, "dev", "-p", port], { cwd: coreRoot, stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
