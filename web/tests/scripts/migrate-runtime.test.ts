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

  /** Gerçek klasörün ilk `count` migration'ını (journal dahil) ayrı bir klasöre kopyalar. */
  function realPrefix(name: string, count: number): string {
    const dir = path.join(root, name);
    mkdirSync(path.join(dir, "meta"), { recursive: true });
    const journal = JSON.parse(readFileSync(path.join(REAL_FOLDER, "meta", "_journal.json"), "utf8")) as {
      entries: { tag: string }[];
    };
    const entries = journal.entries.slice(0, count);
    for (const e of entries) {
      writeFileSync(path.join(dir, `${e.tag}.sql`), readFileSync(path.join(REAL_FOLDER, `${e.tag}.sql`)));
    }
    writeFileSync(path.join(dir, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
    return dir;
  }

  describe("0014: sabit roller kalkar (eski rollü kullanıcılar üyeliksiz `user` olur)", () => {
    const insertUser = (c: Client, username: string, role: string) =>
      c
        .query<{ id: string }>(
          `insert into users (name, email, username, role) values ($1, $2, $1, $3) returning id`,
          [username, `${username}@example.test`, role],
        )
        .then((r) => r.rows[0]!.id);

    it("migration: organizer satırı user olur, admin admin kalır, user_permissions boşalır (0011 durumundan)", async () => {
      await recreateDb();
      const at0011 = migrate(realPrefix("upto0011", 12));
      expect(at0011.status, at0011.out).toBe(0);
      const ids = await withClient(DB_URL, async (c) => {
        const admin = await insertUser(c, "yonetici", "admin");
        const organizer = await insertUser(c, "organizator", "organizer");
        const leader = await insertUser(c, "lider", "leader");
        await c.query(`insert into user_permissions (user_id, module, can_view) values ($1, 'events', false)`, [organizer]);
        for (const target of ["leader", "staff", "all", "admin"]) {
          await c.query(
            `insert into notifications (type, title, message, target_role) values ('system_announcement', $1, 'm', $2)`,
            [target, target],
          );
        }
        return { admin, organizer, leader };
      });

      const res = migrate(REAL_FOLDER);
      expect(res.status, res.out).toBe(0);

      await withClient(DB_URL, async (c) => {
        const roles = await c.query<{ id: string; role: string }>("select id, role::text as role from users");
        const byId = Object.fromEntries(roles.rows.map((r) => [r.id, r.role]));
        expect(byId).toEqual({ [ids.admin]: "admin", [ids.organizer]: "user", [ids.leader]: "user" });
        const perms = await c.query("select 1 from user_permissions");
        expect(perms.rowCount).toBe(0);
        const memberships = await c.query("select 1 from department_memberships");
        expect(memberships.rowCount).toBe(0);
        const labels = await c.query<{ v: string }>(
          "select unnest(enum_range(null::user_role))::text as v",
        );
        expect(labels.rows.map((r) => r.v)).toEqual(["admin", "user"]);
        const audiences = await c.query<{ title: string; audience: string }>(
          "select title, audience::text as audience from notifications order by title",
        );
        expect(audiences.rows).toEqual([
          { title: "admin", audience: "admin" },
          { title: "all", audience: "all" },
          { title: "leader", audience: "admin" },
          { title: "staff", audience: "admin" },
        ]);
        const defaults = await c.query<{ column_name: string; column_default: string | null }>(
          `select column_name, column_default from information_schema.columns
           where (table_name = 'users' and column_name = 'role')
              or (table_name = 'user_permissions' and column_name = 'can_view')
           order by column_name`,
        );
        expect(defaults.rows).toEqual([
          { column_name: "can_view", column_default: "false" },
          { column_name: "role", column_default: "'user'::user_role" },
        ]);
      });
    });

    it("0013 durumundaki veritabanında user üyelikleri ve izin satırları korunur; eski rollünün ve yöneticinin satırları silinir", async () => {
      await recreateDb();
      const at0013 = migrate(realPrefix("upto0013", 14));
      expect(at0013.status, at0013.out).toBe(0);
      const ids = await withClient(DB_URL, async (c) => {
        const member = await insertUser(c, "uye", "user");
        const legacy = await insertUser(c, "eski", "staff");
        const admin = await insertUser(c, "yonetici", "admin");
        for (const userId of [member, legacy]) {
          await c.query(`insert into department_memberships (user_id, department, level) values ($1, 'casino', 'manager')`, [userId]);
        }
        for (const userId of [member, legacy, admin]) {
          await c.query(`insert into user_permissions (user_id, module, can_view) values ($1, 'reservations', true)`, [userId]);
        }
        return { member, legacy, admin };
      });

      const res = migrate(REAL_FOLDER);
      expect(res.status, res.out).toBe(0);

      await withClient(DB_URL, async (c) => {
        const roles = await c.query<{ id: string; role: string }>("select id, role::text as role from users");
        expect(Object.fromEntries(roles.rows.map((r) => [r.id, r.role]))).toEqual({
          [ids.member]: "user",
          [ids.legacy]: "user",
          [ids.admin]: "admin",
        });
        const memberships = await c.query<{ user_id: string }>("select user_id from department_memberships");
        expect(memberships.rows).toEqual([{ user_id: ids.member }]);
        const perms = await c.query<{ user_id: string }>("select user_id from user_permissions");
        expect(perms.rows).toEqual([{ user_id: ids.member }]);
      });
    });
  });

  describe("0015: şirket saat dilimi varsayılanı Kıbrıs saati olur", () => {
    const tzOf = (c: Client, id: string) =>
      c
        .query<{ timezone: string }>("select timezone from system_settings where id = $1", [id])
        .then((r) => r.rows[0]?.timezone);

    it("eski varsayılan (Europe/Istanbul) Asia/Famagusta olur; elle yazılmış başka dil dokunulmaz kalır; yeni satır varsayılanı alır", async () => {
      await recreateDb();
      const at0014 = migrate(realPrefix("upto0014", 15));
      expect(at0014.status, at0014.out).toBe(0);
      const ids = await withClient(DB_URL, async (c) => {
        const istanbul = await c.query<{ id: string }>(
          "insert into system_settings (company_name, timezone) values ('A', 'Europe/Istanbul') returning id",
        );
        const custom = await c.query<{ id: string }>(
          "insert into system_settings (company_name, timezone) values ('B', 'Europe/London') returning id",
        );
        return { istanbul: istanbul.rows[0]!.id, custom: custom.rows[0]!.id };
      });

      const res = migrate(REAL_FOLDER);
      expect(res.status, res.out).toBe(0);

      await withClient(DB_URL, async (c) => {
        expect(await tzOf(c, ids.istanbul)).toBe("Asia/Famagusta");
        expect(await tzOf(c, ids.custom)).toBe("Europe/London");
        const fresh = await c.query<{ id: string }>("insert into system_settings (company_name) values ('C') returning id");
        expect(await tzOf(c, fresh.rows[0]!.id)).toBe("Asia/Famagusta");
      });
    });
  });

  it("veritabanına ulaşılamazsa çıkış kodu 1", () => {
    const res = migrate(REAL_FOLDER, "postgres://postgres@localhost:1/none");
    expect(res.status).toBe(1);
  });
});

/**
 * Yazar kuralı: bir migration'ın eklediği enum değeri hiçbir SQL migration'ında (sonrakiler dahil) kullanılmaz.
 * İstisna: tür sonradan `CREATE TYPE` ile baştan yaratılırsa (önce `DROP TYPE`), o andan sonraki ifadeler yeni
 * türün değerlerini kullanır ve bunlar aynı işlemde yaratıldığından güvenlidir.
 */
function findUnsafeEnumValueUses(files: { name: string; sql: string }[]): string[] {
  const addRe = /ALTER\s+TYPE\s+(\S+)\s+ADD\s+VALUE\s+(?:IF\s+NOT\s+EXISTS\s+)?'([^']+)'/i;
  const createRe = /CREATE\s+TYPE\s+(\S+)\s+AS\s+ENUM/i;
  let added: { type: string; value: string; file: string }[] = [];
  const problems: string[] = [];
  for (const f of files) {
    for (const statement of f.sql.split("--> statement-breakpoint")) {
      const addMatch = addRe.exec(statement);
      if (addMatch) {
        added.push({ type: addMatch[1] ?? "", value: addMatch[2] ?? "", file: f.name });
        continue;
      }
      const createMatch = createRe.exec(statement);
      if (createMatch) {
        added = added.filter((a) => a.type !== createMatch[1]);
        continue;
      }
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

  it("tür sonradan baştan yaratılırsa (DROP + CREATE TYPE) sonraki kullanım ihlal sayılmaz; öncesi sayılır", () => {
    const problems = findUnsafeEnumValueUses([
      { name: "0001.sql", sql: `ALTER TYPE "public"."t" ADD VALUE 'yeni';` },
      {
        name: "0002.sql",
        sql: [
          `UPDATE x SET v = 'yeni';`,
          `DROP TYPE "public"."t";`,
          `CREATE TYPE "public"."t" AS ENUM('eski', 'yeni');`,
          `UPDATE y SET v = 'yeni';`,
        ].join("--> statement-breakpoint\n"),
      },
      { name: "0003.sql", sql: `INSERT INTO z (v) VALUES ('yeni');` },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("0002.sql");
  });

  it("başka bir türün yeniden yaratılması eklenen değeri serbest bırakmaz", () => {
    const problems = findUnsafeEnumValueUses([
      { name: "0001.sql", sql: `ALTER TYPE "public"."t" ADD VALUE 'yeni';` },
      { name: "0002.sql", sql: `CREATE TYPE "public"."u" AS ENUM('a');--> statement-breakpoint\nINSERT INTO z (v) VALUES ('yeni');` },
    ]);
    expect(problems).toHaveLength(1);
  });
});
