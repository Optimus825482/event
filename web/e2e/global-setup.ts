import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { request } from "@playwright/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { ADMIN_USERNAME, AUTH_STATE_FILE, E2E_BASE_URL, E2E_DATABASE_URL, E2E_DB_NAME, PG_BASE_URL } from "./support/constants";

const ROOT = path.resolve(import.meta.dirname, "..");

async function ensureDatabase(): Promise<void> {
  const admin = new Pool({ connectionString: `${PG_BASE_URL}/postgres`, max: 1 });
  try {
    const res = await admin.query("select 1 from pg_database where datname = $1", [E2E_DB_NAME]);
    if (res.rowCount === 0) await admin.query(`create database ${E2E_DB_NAME}`);
  } finally {
    await admin.end();
  }
}

/** Şemayı uygular ve public şemadaki tüm tabloları boşaltır (tekrar çalıştırılabilir). */
async function migrateAndTruncate(): Promise<void> {
  const pool = new Pool({ connectionString: E2E_DATABASE_URL, max: 1, options: "-c timezone=UTC" });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.join(ROOT, "drizzle") });
    const res = await pool.query<{ name: string }>(
      "select quote_ident(schemaname) || '.' || quote_ident(tablename) as name from pg_tables where schemaname = 'public'",
    );
    if (res.rows.length > 0) {
      await pool.query(`truncate table ${res.rows.map((r) => r.name).join(", ")} restart identity cascade`);
    }
  } finally {
    await pool.end();
  }
}

function seedAdmin(password: string, authSecret: string): void {
  const tsx = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const res = spawnSync(process.execPath, [tsx, "scripts/create-admin.ts", ADMIN_USERNAME], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_SECRET: authSecret,
      BETTER_AUTH_URL: E2E_BASE_URL,
      ADMIN_PASSWORD: password,
    },
  });
  if (res.status !== 0) throw new Error(`Yönetici oluşturulamadı:\n${res.stdout}\n${res.stderr}`);
}

export default async function globalSetup(): Promise<void> {
  const password = process.env.E2E_ADMIN_PASSWORD;
  const authSecret = process.env.E2E_AUTH_SECRET;
  if (!password || !authSecret) throw new Error("E2E_ADMIN_PASSWORD / E2E_AUTH_SECRET tanımlı değil (playwright.config.ts)");

  await ensureDatabase();
  await migrateAndTruncate();
  seedAdmin(password, authSecret);

  // Oturumu bir kez açıp çerezi diske yazar; giriş testleri bundan bağımsız boş oturumla çalışır.
  mkdirSync(path.dirname(path.join(ROOT, AUTH_STATE_FILE)), { recursive: true });
  const api = await request.newContext({ baseURL: E2E_BASE_URL, extraHTTPHeaders: { origin: E2E_BASE_URL } });
  try {
    const res = await api.post("/api/auth/sign-in/username", { data: { username: ADMIN_USERNAME, password } });
    if (!res.ok()) throw new Error(`Oturum açılamadı: ${res.status()}`);
    await api.storageState({ path: path.join(ROOT, AUTH_STATE_FILE) });
  } finally {
    await api.dispose();
  }
}
