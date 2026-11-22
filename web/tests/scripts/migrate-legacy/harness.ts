import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

/**
 * Taşıma testleri için geçici veritabanları. Yalnızca `eventflow_legacy_test_*` ve
 * `eventflow_etl_test_*` adları oluşturulur/silinir (özel küme: localhost:54329).
 */

export const PG_BASE = "postgres://postgres@localhost:54329";
const ALLOWED = /^(eventflow_legacy_test|eventflow_etl_test)_[a-z0-9_]+$/;
const ROOT = path.resolve(import.meta.dirname, "../../..");
export const LEGACY_SCHEMA = path.join(ROOT, "..", "docs", "legacy", "schema.sql");
export const MIGRATIONS_DIR = path.join(ROOT, "drizzle");

export const dbUrl = (name: string) => `${PG_BASE}/${name}`;
export const uniqueDbName = (prefix: "eventflow_legacy_test" | "eventflow_etl_test", tag = "") =>
  `${prefix}_${tag ? `${tag}_` : ""}${randomBytes(4).toString("hex")}`;

function assertAllowed(name: string): void {
  if (!ALLOWED.test(name)) throw new Error(`Test veritabanı adı izinli değil: ${name}`);
}

async function admin<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: dbUrl("postgres") });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function createDb(name: string): Promise<void> {
  assertAllowed(name);
  await admin((c) => c.query(`CREATE DATABASE ${name}`));
}

export async function dropDb(name: string): Promise<void> {
  assertAllowed(name);
  await admin((c) => c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`));
}

export async function withClient<T>(name: string, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: dbUrl(name), options: "-c timezone=UTC" });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Eski şemayı (veri içermeyen döküm) yükler. */
export async function createLegacyDb(name: string): Promise<void> {
  await createDb(name);
  const ddl = await readFile(LEGACY_SCHEMA, "utf8");
  await withClient(name, (c) => c.query(ddl));
}

export async function createTargetDb(name: string, migrated = true): Promise<void> {
  await createDb(name);
  if (!migrated) return;
  const pool = new pg.Pool({ connectionString: dbUrl(name), max: 1, options: "-c timezone=UTC" });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await pool.end();
  }
}

/** Eski veritabanındaki tüm tabloların içerik özeti (değişmediğini doğrulamak için). */
export async function checksum(name: string): Promise<Record<string, string>> {
  return withClient(name, async (c) => {
    const tables = await c.query<{ t: string }>(
      "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1",
    );
    const out: Record<string, string> = {};
    for (const { t } of tables.rows) {
      const res = await c.query<{ h: string }>(
        `SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS h FROM public."${t}" x`,
      );
      out[t] = res.rows[0]?.h ?? "";
    }
    return out;
  });
}

export async function totalRows(name: string): Promise<number> {
  return withClient(name, async (c) => {
    const tables = await c.query<{ t: string }>(
      "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    );
    let n = 0;
    for (const { t } of tables.rows) {
      const res = await c.query<{ n: string }>(`SELECT count(*)::text AS n FROM public."${t}"`);
      n += Number(res.rows[0]?.n ?? 0);
    }
    return n;
  });
}
