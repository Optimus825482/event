import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, ".pgdata");
const PORT = "54329";
const DATABASES = ["eventflow_dev", "eventflow_test"];
const WIN_BIN = "C:/Program Files/PostgreSQL/17/bin";
const ext = process.platform === "win32" ? ".exe" : "";

function findBin(name) {
  const candidates = [join(WIN_BIN, name + ext)];
  for (const dir of (process.env.PATH ?? "").split(process.platform === "win32" ? ";" : ":")) {
    if (dir) candidates.push(join(dir, name + ext));
  }
  const found = candidates.find((c) => existsSync(c));
  if (!found) throw new Error(`${name} bulunamadı (PostgreSQL 17 kurulu mu?)`);
  return found;
}

function run(bin, args, { allowFail = false, detached = false } = {}) {
  // detached: sunucu süreci pipe tutamaklarını miras alıp çağrıyı asılı bırakmasın (Windows).
  const res = spawnSync(findBin(bin), args, {
    encoding: "utf8",
    stdio: detached ? "ignore" : "pipe",
    env: { ...process.env, PGCLIENTENCODING: "UTF8" },
  });
  if (res.status !== 0 && !allowFail) {
    throw new Error(`${bin} ${args.join(" ")} başarısız:\n${res.stdout ?? ""}\n${res.stderr ?? ""}`);
  }
  return res;
}

const psql = (sql, db = "postgres") =>
  run("psql", ["-h", "localhost", "-p", PORT, "-U", "postgres", "-d", db, "-tAc", sql]);

function isRunning() {
  return run("pg_ctl", ["-D", dataDir, "status"], { allowFail: true }).status === 0;
}

function init() {
  if (existsSync(join(dataDir, "PG_VERSION"))) return;
  run("initdb", ["-D", dataDir, "-U", "postgres", "-A", "trust", "-E", "UTF8", "--locale=C"]);
  console.log("küme oluşturuldu:", dataDir);
}

function ensureDatabases() {
  for (const name of DATABASES) {
    const exists = psql(`select 1 from pg_database where datname='${name}'`).stdout.trim() === "1";
    if (!exists) psql(`create database ${name}`);
  }
}

function start() {
  init();
  if (!isRunning()) {
    run("pg_ctl", ["-D", dataDir, "-l", join(dataDir, "server.log"), "-o", `-p ${PORT} -c listen_addresses=localhost`, "-w", "-t", "180", "start"], {
      detached: true,
    });
  }
  ensureDatabases();
  console.log(`PostgreSQL hazır: localhost:${PORT}`);
}

function stop() {
  if (isRunning()) run("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"]);
  console.log("PostgreSQL durduruldu");
}

function reset() {
  start();
  for (const name of DATABASES) psql(`drop database if exists ${name} with (force)`);
  ensureDatabases();
  console.log("veritabanları sıfırlandı");
}

/**
 * `npm run dev` öncesi (predev) çalışır: DATABASE_URL bu projenin yerel kümesini
 * gösteriyorsa kümeyi başlatır; uzak/başka bir veritabanıysa dokunmaz.
 * Başlatılamazsa yalnızca uyarır; dev sunucusunun açılmasını engellemez.
 */
function ensure() {
  const raw = process.env.DATABASE_URL ?? `postgres://postgres@localhost:${PORT}/eventflow_dev`;
  let url;
  try {
    url = new URL(raw);
  } catch {
    console.warn("DATABASE_URL çözümlenemedi; yerel PostgreSQL otomatik başlatılmadı");
    return;
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const isLocalCluster = ["localhost", "127.0.0.1", "::1"].includes(host) && url.port === PORT;
  if (!isLocalCluster) {
    console.log(`DATABASE_URL yerel kümeyi göstermiyor (${url.host}); PostgreSQL otomatik başlatılmadı`);
    return;
  }
  try {
    start();
  } catch (err) {
    console.warn("Yerel PostgreSQL otomatik başlatılamadı:\n" + (err instanceof Error ? err.message : err));
  }
}

const commands = { init, start, stop, reset, ensure };
const cmd = process.argv[2] ?? "";
const handler = commands[cmd];
if (!handler) {
  console.error(`Kullanım: node scripts/pg.mjs <${Object.keys(commands).join("|")}>`);
  process.exit(1);
}
try {
  handler();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
