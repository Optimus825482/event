// Çekirdeğin `tsx`'iyle, cwd = web/ ile çalışır (bkz. start-core.mjs). Statik içe aktarma yoktur:
// çekirdek paketleri web/ paket çözümünden, çekirdek modülleri web/ yolundan dinamik yüklenir.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DB_PATTERN = /^eventflow_e2e[a-z0-9_]*$/;

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (value !== undefined) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`--${name} gerekli`);
}

const coreRequire = createRequire(path.resolve("package.json"));
const coreImport = (relative: string) => import(pathToFileURL(path.resolve(relative)).href);

async function main(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const dbName = decodeURIComponent(url.pathname.slice(1));
  if (!DB_PATTERN.test(dbName) || dbName.length > 63) {
    throw new Error(`Veritabanı adı ${DB_PATTERN} desenine uymuyor: ${JSON.stringify(dbName)}`);
  }
  const out = arg("out");
  const tableCount = Number(arg("tables", "6"));
  const seats = Number(arg("seats", "8"));

  const { Pool } = coreRequire("pg");
  const { drizzle } = coreRequire("drizzle-orm/node-postgres");
  const { migrate } = coreRequire("drizzle-orm/node-postgres/migrator");

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new Pool({ connectionString: adminUrl.toString(), max: 1 });
  try {
    const res = await admin.query("select 1 from pg_database where datname = $1", [dbName]);
    if (res.rowCount === 0) await admin.query(`create database ${dbName}`);
  } finally {
    await admin.end();
  }

  const pool = new Pool({ connectionString: url.toString(), max: 2, options: "-c timezone=UTC" });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve("drizzle") });
    const names = await pool.query(
      "select quote_ident(schemaname) || '.' || quote_ident(tablename) as name from pg_tables where schemaname = 'public'",
    );
    if (names.rows.length > 0) {
      await pool.query(`truncate table ${names.rows.map((r: { name: string }) => r.name).join(", ")} restart identity cascade`);
    }

    const schema = await coreImport("src/db/schema/index.ts");
    const { createEvent, createTable } = await coreImport("tests/helpers/factories.ts");
    const { openOnline, setFinalPrices, setSaleSettings } = await coreImport("tests/helpers/seating.ts");
    const { setStage } = await coreImport("tests/helpers/planning.ts");
    const db = drizzle(pool, { schema });

    const result = await db.transaction(async (tx: unknown) => {
      const event = await createEvent(tx, {
        name: "Çapraz Test Gecesi",
        status: "published",
        startsAt: new Date(Date.now() + 30 * 86_400_000),
      });
      const tables: { id: string; label: string; seats: number }[] = [];
      for (let i = 1; i <= tableCount; i++) {
        const t = await createTable(tx, event.id, {
          label: `T${i}`,
          capacity: seats,
          x: 100 + ((i - 1) % 10) * 90,
          y: 100 + Math.floor((i - 1) / 10) * 90,
          saleCategory: i <= 2 ? "premium" : "standard",
        });
        tables.push({ id: t.id, label: t.label, seats });
      }
      await createTable(tx, event.id, { label: "C1", capacity: seats, x: 100, y: 40, allocation: "casino" });
      await openOnline(tx, event.id, tables.map((t) => t.id));
      await setFinalPrices(tx, event.id, { standard: "1500.00", premium: "2500.00" });
      await setSaleSettings(tx, event.id, { holdMinutes: 10, blockSingleLeftover: true, sharedTables: true });
      await setStage(tx, event.id, "on_sale");
      return { eventId: event.id as string, tables };
    });

    mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    writeFileSync(path.resolve(out), JSON.stringify(result), "utf8");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exit(1);
});
