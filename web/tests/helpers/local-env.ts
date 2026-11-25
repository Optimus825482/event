import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * `.env.local` metninden yalnızca istenen anahtarları alır (`KEY=değer`, `#` yorum, tek/çift tırnak).
 * Diğer anahtarlar (BETTER_AUTH_SECRET, SEED_ADMIN_PASSWORD, ...) asla döndürülmez.
 */
export function pickLocalEnv(text: string, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!keys.includes(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.endsWith(value[0]!)) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** `.env.local` dosyasından yalnızca `keys`; dosya yoksa boş nesne. */
export function readLocalEnv(webRoot: string, keys: readonly string[]): Record<string, string> {
  const file = path.join(webRoot, ".env.local");
  if (!existsSync(file)) return {};
  return pickLocalEnv(readFileSync(file, "utf8"), keys);
}

/** Önce süreç ortamındaki `TEST_DB_NAME`, yoksa `webRoot/.env.local` içindeki (yalnızca bu anahtar). */
export function localTestDbName(env: Readonly<Record<string, string | undefined>>, webRoot: string): string | undefined {
  if (env.TEST_DB_NAME) return env.TEST_DB_NAME;
  return readLocalEnv(webRoot, ["TEST_DB_NAME"]).TEST_DB_NAME || undefined;
}
