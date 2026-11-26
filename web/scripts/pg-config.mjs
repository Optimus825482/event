import { existsSync } from "node:fs";
import { isAbsolute, join, posix } from "node:path";
import { resolveTestDbName } from "../tests/helpers/db-name.ts";

export const PG_PORT = "54329";
const DEFAULT_DEV_DB = "eventflow_dev";
const DEFAULT_TEST_DB = "eventflow_test";
const DEV_DB_PATTERN = /^eventflow_dev[a-z0-9_]*$/;
const MAX_LENGTH = 63;

/**
 * Küme dizini. `PGDATA_DIR` tanımlıysa (şerit) win32'de sürücü harfli mutlak yol olmalıdır:
 * Git Bash biçimi (`/d/...`) win32'de "mutlak" sayılır ama geçerli sürücüde `\d\...` olarak çözülür.
 * Veritabanı adlarına bakmaz (stop / start dizin yolu için).
 *
 * @param {Record<string, string | undefined>} env
 * @param {string} root web/ klasörü
 * @param {{ platform?: string }} [opts]
 * @returns {{ dataDir: string; port: "54329"; lane: boolean }}
 */
export function resolveClusterDir(env, root, { platform = process.platform } = {}) {
  const rawDir = env.PGDATA_DIR;
  if (!rawDir) return { dataDir: join(root, ".pgdata"), port: PG_PORT, lane: false };
  if (platform === "win32") {
    if (!/^[A-Za-z]:[\\/]/.test(rawDir)) {
      throw new Error(
        `PGDATA_DIR geçersiz: ${JSON.stringify(rawDir)}. Windows'ta sürücü harfi ile başlayan mutlak yol olmalıdır (ör. D:/PROJELLER/event/web/.pgdata); /d/... biçimi kabul edilmez.`,
      );
    }
  } else if (!(isAbsolute(rawDir) || posix.isAbsolute(rawDir))) {
    throw new Error(`PGDATA_DIR geçersiz: ${JSON.stringify(rawDir)}. Mutlak yol olmalıdır.`);
  }
  return { dataDir: rawDir, port: PG_PORT, lane: true };
}

/**
 * Şerit (`PGDATA_DIR` var) hiçbir zaman küme kurmaz: dizinde `PG_VERSION` yoksa reddedilir
 * (yanlış yazılmış yol ikinci bir küme oluşturmasın).
 */
export function assertLaneClusterExists(cluster, exists = existsSync) {
  if (!cluster.lane) return;
  if (!exists(join(cluster.dataDir, "PG_VERSION"))) {
    throw new Error(
      `PGDATA_DIR içinde küme yok: ${cluster.dataDir} (PG_VERSION bulunamadı). Şeritler küme kurmaz; ortak kümeyi ana depodan başlatın ve yolu denetleyin.`,
    );
  }
}

/**
 * Yönetilen veritabanı adları: [geliştirme (yalnızca yerel küme ise), test]. Geçersiz adlarda hata verir;
 * yalnızca adlara gerçekten gereken komutlar (start/reset/drop-test) çağırmalıdır.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
export function resolveDatabaseNames(env) {
  const databases = [];
  const devName = devDatabaseName(env.DATABASE_URL);
  if (devName !== undefined) databases.push(devName);
  databases.push(resolveTestDbName(env.TEST_DB_NAME));
  return databases;
}

/**
 * Şeritte (`PGDATA_DIR` var) çıplak varsayılan adlar ana ağacın veritabanlarıdır; `reset` / `drop-test`
 * onları silmemelidir (şeridin `.env.local`'inde `DATABASE_URL` ya da `TEST_DB_NAME` satırı eksik kalmış olabilir).
 */
export function assertDestructiveAllowed(env, databases) {
  if (!env.PGDATA_DIR) return;
  const bare = databases.filter((n) => n === DEFAULT_DEV_DB || n === DEFAULT_TEST_DB);
  if (bare.length > 0) {
    throw new Error(
      `Şeritte varsayılan veritabanı adları silinemez: ${bare.join(", ")}. Bunlar ana ağacındır; şeridin .env.local dosyasına DATABASE_URL (eventflow_dev_<şerit>) ve TEST_DB_NAME (eventflow_test_<şerit>) ekleyin.`,
    );
  }
}

/**
 * Tüm yapılandırma (geriye dönük uyumlu birleşik görünüm).
 *
 * @param {Record<string, string | undefined>} env
 * @param {string} root
 * @param {{ platform?: string }} [opts]
 */
export function resolvePgConfig(env, root, opts) {
  const { dataDir, port } = resolveClusterDir(env, root, opts);
  return { dataDir, port, databases: resolveDatabaseNames(env) };
}

/** Yerel kümeyi gösteren DATABASE_URL'nin veritabanı adı; yerel değilse undefined. */
function devDatabaseName(raw) {
  if (raw === undefined || raw === "") return DEFAULT_DEV_DB;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(host) || url.port !== PG_PORT) return undefined;
  const name = decodeURIComponent(url.pathname.replace(/^\//, "")) || DEFAULT_DEV_DB;
  if (name.length > MAX_LENGTH || !DEV_DB_PATTERN.test(name)) {
    throw new Error(`DATABASE_URL veritabanı adı geçersiz: "${name}". Ad eventflow_dev önekli olmalıdır.`);
  }
  return name;
}
