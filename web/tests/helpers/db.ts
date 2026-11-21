import { existsSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// Testler HER ZAMAN test veritabanını kullanır; DATABASE_URL'e bakılmaz.
const BASE_URL = "postgres://postgres@localhost:54329";
const TEST_DB = "eventflow_test";
export const TEST_DATABASE_URL = `${BASE_URL}/${TEST_DB}`;

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../drizzle");
const PG_OPTIONS = "-c timezone=UTC";

async function ensureTestDatabase(): Promise<void> {
  const admin = new Pool({ connectionString: `${BASE_URL}/postgres`, max: 1 });
  try {
    const res = await admin.query("select 1 from pg_database where datname = $1", [TEST_DB]);
    if (res.rowCount === 0) await admin.query(`create database ${TEST_DB}`);
  } finally {
    await admin.end();
  }
}

export async function setupTestDb(): Promise<void> {
  await ensureTestDatabase();
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 1, options: PG_OPTIONS });
  try {
    if (existsSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"))) {
      await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
    }
  } finally {
    await pool.end();
  }
}

export async function truncateAll(): Promise<void> {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 1, options: PG_OPTIONS });
  try {
    const res = await pool.query<{ name: string }>(
      "select quote_ident(schemaname) || '.' || quote_ident(tablename) as name from pg_tables where schemaname = 'public'",
    );
    if (res.rows.length === 0) return;
    const names = res.rows.map((r) => r.name).join(", ");
    await pool.query(`truncate table ${names} restart identity cascade`);
  } finally {
    await pool.end();
  }
}
