import path from "node:path";
import { getTableName, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { PgInsertValue, PgTable } from "drizzle-orm/pg-core";
import pg from "pg";
import * as schema from "@/db/schema";
import { MERIT_BALLROOM_NAME } from "@/features/venue/presets/merit-ballroom";

export type TargetDb = NodePgDatabase<typeof schema>;

export const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../drizzle");

/** Oturumdan bağımsız (geçici) tablolar: boşluk denetimine katılmaz. */
const EPHEMERAL_TABLES = new Set(["rate_limits", "login_attempts", "verifications"]);

// PostgreSQL bir sorguda en çok 65535 parametre kabul eder; en geniş tablo ~30 sütun.
const CHUNK = 500;

export async function openTarget(connectionString: string): Promise<{ client: pg.Client; db: TargetDb }> {
  const client = new pg.Client({
    connectionString,
    options: "-c timezone=UTC",
    application_name: "eventflow-migrate-legacy",
  });
  await client.connect();
  return { client, db: drizzle(client, { schema }) };
}

/**
 * Hedef, depodaki son Drizzle migration'ına kadar migrate edilmiş olmalı. Drizzle her
 * uygulanan migration için `created_at = journal.when` yazar; karşılaştırma bu damgayla
 * yapılır (dosya hash'i satır sonu farkına — CRLF/LF — duyarlı olduğu için kullanılmaz).
 */
export async function assertLatestMigration(client: pg.Client, migrationsDir = MIGRATIONS_DIR): Promise<void> {
  const expected = readMigrationFiles({ migrationsFolder: migrationsDir }).map((m) => String(m.folderMillis));
  const exists = await client.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'",
  );
  if (exists.rowCount === 0) throw new Error("Hedef veritabanı migrate edilmemiş (drizzle.__drizzle_migrations yok)");
  const applied = await client.query<{ at: string }>("SELECT created_at::text AS at FROM drizzle.__drizzle_migrations");
  const appliedSet = new Set(applied.rows.map((r) => r.at));
  const missing = expected.filter((when) => !appliedSet.has(when));
  if (missing.length > 0 || appliedSet.size !== expected.length) {
    throw new Error(
      `Hedef son migration'da değil: depoda ${expected.length}, hedefte ${appliedSet.size} migration, eksik ${missing.length}`,
    );
  }
}

export async function publicTables(client: pg.Client): Promise<string[]> {
  const res = await client.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
  );
  return res.rows.map((r) => r.table_name);
}

/**
 * Migration'ların kendisinin eklediği (taşınan veri olmayan) satırlar: sayımlara ve boşluk denetimine katılmaz.
 * Yalnızca sahipsiz hazır salon şablonu (0010); aynı tablodaki başka her satır yine sayılır.
 */
const SEEDED_ROWS: Readonly<Record<string, { where: string; params: readonly string[] }>> = {
  venue_templates: { where: "NOT (created_by_id IS NULL AND name = $1)", params: [MERIT_BALLROOM_NAME] },
};

export async function countRows(client: pg.Client): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const table of await publicTables(client)) {
    const seeded = SEEDED_ROWS[table];
    const res = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM public."${table.replace(/"/g, '""')}"${seeded ? ` WHERE ${seeded.where}` : ""}`,
      seeded ? [...seeded.params] : [],
    );
    out[table] = Number(res.rows[0]?.n ?? 0);
  }
  return out;
}

/** Hedefte alan verisi varsa çalışmayı reddeder; ihlal eden tablo adlarını döner. */
export async function nonEmptyDomainTables(client: pg.Client): Promise<string[]> {
  const counts = await countRows(client);
  return Object.entries(counts)
    .filter(([table, n]) => n > 0 && !EPHEMERAL_TABLES.has(table))
    .map(([table]) => table);
}

/** Toplu ekleme ve tablo başına yazılan satır sayacı. */
export class Writer {
  readonly written: Record<string, number> = {};

  constructor(readonly db: TargetDb) {}

  async insert<T extends PgTable>(table: T, rows: PgInsertValue<T>[]): Promise<void> {
    const name = getTableName(table);
    this.written[name] = (this.written[name] ?? 0) + rows.length;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await this.db.insert(table).values(rows.slice(i, i + CHUNK));
    }
  }

  async execute(query: ReturnType<typeof sql>): Promise<void> {
    await this.db.execute(query);
  }
}
