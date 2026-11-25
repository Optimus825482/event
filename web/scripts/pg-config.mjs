import { isAbsolute, join } from "node:path";
import { resolveTestDbName } from "../tests/helpers/db-name.ts";

export const PG_PORT = "54329";
const DEFAULT_DEV_DB = "eventflow_dev";
const DEV_DB_PATTERN = /^eventflow_dev[a-z0-9_]*$/;
const MAX_LENGTH = 63;

/**
 * Yerel PostgreSQL kümesinin yapılandırması. Paralel worktree'ler tek kümeyi paylaşır:
 * `PGDATA_DIR` küme dizinini, `DATABASE_URL` ve `TEST_DB_NAME` şeridin veritabanlarını belirler.
 * Hiçbiri tanımlı değilse bugünkü varsayılanlar (`<root>/.pgdata`, eventflow_dev, eventflow_test).
 *
 * @param {Record<string, string | undefined>} env
 * @param {string} root web/ klasörü
 * @returns {{ dataDir: string; port: "54329"; databases: string[] }}
 */
export function resolvePgConfig(env, root) {
  const rawDir = env.PGDATA_DIR;
  if (rawDir && !isAbsolute(rawDir)) {
    throw new Error(`PGDATA_DIR geçersiz: ${JSON.stringify(rawDir)}. Mutlak yol olmalıdır.`);
  }
  const dataDir = rawDir ? rawDir : join(root, ".pgdata");

  const databases = [];
  const devName = devDatabaseName(env.DATABASE_URL);
  if (devName !== undefined) databases.push(devName);
  databases.push(resolveTestDbName(env.TEST_DB_NAME));
  return { dataDir, port: PG_PORT, databases };
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
