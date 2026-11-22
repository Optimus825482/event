import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PG_BASE_URL } from "../helpers/db-name";

const SCRIPT = path.resolve(import.meta.dirname, "../../scripts/migrate.mjs");
const REAL_FOLDER = path.resolve(import.meta.dirname, "../../drizzle");
const DB_NAME = "eventflow_test_fixh_mig";
const DB_URL = `${PG_BASE_URL}/${DB_NAME}`;

function migrate(folder: string, url = DB_URL) {
  const res = spawnSync(process.execPath, [SCRIPT], {
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", DATABASE_URL: url, MIGRATIONS_FOLDER: folder },
    encoding: "utf8",
    timeout: 120_000,
  });
  return { status: res.status, out: res.stdout + res.stderr };
}

async function withClient<T>(url: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function recreateDb(): Promise<void> {
  await withClient(`${PG_BASE_URL}/postgres`, async (c) => {
    await c.query(`drop database if exists ${DB_NAME} with (force)`);
    await c.query(`create database ${DB_NAME}`);
  });
}

const applied = () =>
  withClient(DB_URL, async (c) => {
    const { rows } = await c.query<{ n: number }>("select count(*)::int as n from drizzle.__drizzle_migrations");
    return rows[0]?.n ?? 0;
  });

/** Küçük bir migration klasörü; `files` sırayla 0000, 0001, ... olur. */
function makeFolder(root: string, name: string, files: string[]): string {
  const dir = path.join(root, name);
  mkdirSync(path.join(dir, "meta"), { recursive: true });
  const entries = files.map((sql, idx) => {
    const tag = `${String(idx).padStart(4, "0")}_m`;
    writeFileSync(path.join(dir, `${tag}.sql`), sql);
    return { idx, version: "7", when: 1_800_000_000_000 + idx * 1000, tag, breakpoints: true };
  });
  writeFileSync(path.join(dir, "meta", "_journal.json"), JSON.stringify({ version: "7", dialect: "postgresql", entries }));
  return dir;
}

describe("scripts/migrate.mjs çalışma zamanı migrator'ı", { timeout: 60_000 }, () => {
  let root = "";
  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "ef-migrate-"));
  });
  afterAll(async () => {
    rmSync(root, { recursive: true, force: true });
    await withClient(`${PG_BASE_URL}/postgres`, (c) => c.query(`drop database if exists ${DB_NAME} with (force)`));
  });

  it("boş veritabanına 0000'dan en son migration'a temiz uygulanır; ikinci çalıştırma işlem yapmaz", async () => {
    await recreateDb();
    const total = readdirSync(REAL_FOLDER).filter((f) => f.endsWith(".sql")).length;
    const first = migrate(REAL_FOLDER);
    expect(first.status, first.out).toBe(0);
    expect(await applied()).toBe(total);
    const second = migrate(REAL_FOLDER);
    expect(second.status, second.out).toBe(0);
    expect(await applied()).toBe(total);
  });

  describe("ALTER TYPE ... ADD VALUE ve yeni değerin kullanımı (drizzle migrator tüm bekleyenleri TEK işlemde uygular)", () => {
    const create = `CREATE TYPE "public"."t" AS ENUM('a');`;
    const addValue = `ALTER TYPE "public"."t" ADD VALUE 'b';`;
    const useValue = `CREATE TABLE "x" ("v" "public"."t" DEFAULT 'b' NOT NULL);`;
    const harmless = `CREATE TABLE "x" ("v" "public"."t" DEFAULT 'a' NOT NULL);`;

    it("tür aynı çalıştırmada yaratıldıysa (boş veritabanı) yeni değer kullanılabilir", async () => {
      await recreateDb();
      const res = migrate(makeFolder(root, "fresh", [create, addValue, useValue]));
      expect(res.status, res.out).toBe(0);
    });

    it("tür önceki bir çalıştırmadan kalmışsa değeri ekleyen ve kullanan migration'lar aynı çalıştırmada BAŞARISIZ olur ve hepsi geri alınır", async () => {
      await recreateDb();
      expect(migrate(makeFolder(root, "step1", [create])).status).toBe(0);
      const res = migrate(makeFolder(root, "step2", [create, addValue, useValue]));
      expect(res.status).toBe(1);
      expect(res.out).toContain("BAŞARISIZ");
      // ADD VALUE da geri alındı: ne kayıt ne tablo kaldı.
      expect(await applied()).toBe(1);
    });

    it("değeri yalnızca ekleyen migration (kullanmayan) mevcut veritabanında sorunsuz uygulanır", async () => {
      await recreateDb();
      expect(migrate(makeFolder(root, "step1b", [create])).status).toBe(0);
      const res = migrate(makeFolder(root, "step2b", [create, addValue, harmless]));
      expect(res.status, res.out).toBe(0);
      expect(await applied()).toBe(3);
    });
  });

  it("veritabanına ulaşılamazsa çıkış kodu 1", () => {
    const res = migrate(REAL_FOLDER, "postgres://postgres@localhost:1/none");
    expect(res.status).toBe(1);
  });
});

/** Yazar kuralı: bir migration'ın eklediği enum değeri hiçbir SQL migration'ında (sonrakiler dahil) kullanılmaz. */
function findUnsafeEnumValueUses(files: { name: string; sql: string }[]): string[] {
  const added: { value: string; file: string }[] = [];
  const addRe = /ALTER\s+TYPE\s+\S+\s+ADD\s+VALUE\s+(?:IF\s+NOT\s+EXISTS\s+)?'([^']+)'/gi;
  for (const f of files) for (const m of f.sql.matchAll(addRe)) added.push({ value: m[1] ?? "", file: f.name });
  const problems: string[] = [];
  for (const f of files) {
    for (const statement of f.sql.split("--> statement-breakpoint")) {
      if (/ALTER\s+TYPE[\s\S]*ADD\s+VALUE/i.test(statement)) continue;
      for (const a of added) {
        if (statement.includes(`'${a.value}'`)) problems.push(`${f.name} kullanıyor '${a.value}' (eklendiği yer: ${a.file})`);
      }
    }
  }
  return problems;
}

describe("migration yazarı kuralı: ADD VALUE ile eklenen değer migration'larda kullanılmaz", () => {
  it("gerçek migration klasöründe ihlal yok", () => {
    const files = readdirSync(REAL_FOLDER)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((name) => ({ name, sql: readFileSync(path.join(REAL_FOLDER, name), "utf8") }));
    expect(findUnsafeEnumValueUses(files)).toEqual([]);
  });

  it("denetleyici ihlali yakalar", () => {
    const problems = findUnsafeEnumValueUses([
      { name: "0001.sql", sql: `ALTER TYPE "public"."t" ADD VALUE 'yeni';` },
      { name: "0002.sql", sql: `INSERT INTO x (v) VALUES ('yeni');` },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("0002.sql");
  });
});
