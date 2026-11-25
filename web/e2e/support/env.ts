import path from "node:path";
import { readLocalEnv } from "../../tests/helpers/local-env";

const DB_PATTERN = /^eventflow_e2e[a-z0-9_]*$/;
const MAX_LENGTH = 63;
export const E2E_ENV_KEYS = ["E2E_DB_NAME", "E2E_PORT", "E2E_PROD_PORT"] as const;

function parsePort(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1024 || port > 65535) {
    throw new Error(`${name} geçersiz: ${JSON.stringify(raw)}. 1024-65535 arası tam sayı olmalı.`);
  }
  return port;
}

/** E2E veritabanı adı ve portları; paralel worktree'ler için ortamdan değişir, varsayılanlar bugünkü gibidir. */
export function resolveE2eEnv(env: Record<string, string | undefined>): { dbName: string; port: number; prodPort: number } {
  const rawDb = env.E2E_DB_NAME;
  let dbName = "eventflow_e2e";
  if (rawDb !== undefined && rawDb !== "") {
    if (rawDb.length > MAX_LENGTH || !DB_PATTERN.test(rawDb)) {
      throw new Error(
        `E2E_DB_NAME geçersiz: ${JSON.stringify(rawDb)}. Ad ${DB_PATTERN} desenine uymalı ve en fazla ${MAX_LENGTH} karakter olmalıdır.`,
      );
    }
    dbName = rawDb;
  }
  const port = parsePort("E2E_PORT", env.E2E_PORT, 3100);
  const prodPort = parsePort("E2E_PROD_PORT", env.E2E_PROD_PORT, 3101);
  if (port === prodPort) throw new Error("E2E_PORT ile E2E_PROD_PORT aynı olamaz");
  return { dbName, port, prodPort };
}

/** Süreç ortamı `.env.local`'den önceliklidir; dosyadan yalnızca üç E2E anahtarı okunur. */
export function loadE2eEnv(env: Readonly<Record<string, string | undefined>> = process.env) {
  const webRoot = path.resolve(import.meta.dirname, "../..");
  return resolveE2eEnv({ ...readLocalEnv(webRoot, E2E_ENV_KEYS), ...pickDefined(env) });
}

function pickDefined(env: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of E2E_ENV_KEYS) {
    const value = env[key];
    if (value !== undefined && value !== "") out[key] = value;
  }
  return out;
}
