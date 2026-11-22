/**
 * Çalışma zamanı veritabanı geçişi (drizzle-kit gerektirmez).
 *
 * Kullanım: DATABASE_URL=postgres://... node scripts/migrate.mjs
 *
 * - `drizzle` klasöründeki SQL migration'larını drizzle-orm'un node-postgres migrator'ıyla uygular
 *   (kayıt tablosu `drizzle.__drizzle_migrations`; `drizzle-kit migrate` ile aynı).
 * - Aynı anda başlayan iki kapsayıcı yarışmasın diye PostgreSQL advisory lock alır.
 * - Çıkış kodu: 0 başarılı, 1 hata. Her sonuç için tek satır yazar; parola yazmaz.
 * - MIGRATIONS_FOLDER ile klasör değiştirilebilir (varsayılan: betiğin yanındaki ../drizzle).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

// Sabit, uygulamaya özgü anahtar ("EVFL" + "MIGR" ASCII); başka advisory lock'larla çakışmasın.
const LOCK_KEY = "4991030329302226";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("migrate: DATABASE_URL tanımlı değil");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = process.env.MIGRATIONS_FOLDER
  ? path.resolve(process.env.MIGRATIONS_FOLDER)
  : path.resolve(here, "..", "drizzle");

const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 15_000 });
let exitCode = 0;
let locked = false;

try {
  await client.connect();
  console.log("migrate: veritabanına bağlanıldı, kilit bekleniyor");
  await client.query("select pg_advisory_lock($1::bigint)", [LOCK_KEY]);
  locked = true;
  const started = Date.now();
  await migrate(drizzle(client), { migrationsFolder });
  const { rows } = await client.query("select count(*)::int as n from drizzle.__drizzle_migrations");
  console.log(`migrate: tamam (${rows[0].n} migration kayıtlı, ${Date.now() - started} ms, klasör ${migrationsFolder})`);
} catch (error) {
  console.error(`migrate: BAŞARISIZ - ${error instanceof Error ? error.message : String(error)}`);
  exitCode = 1;
} finally {
  if (locked) await client.query("select pg_advisory_unlock($1::bigint)", [LOCK_KEY]).catch(() => {});
  await client.end().catch(() => {});
}
process.exit(exitCode);
