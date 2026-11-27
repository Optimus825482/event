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

type EventSpec = {
  key: "gala" | "koltuk" | "masa" | "icerik";
  name: string;
  saleMode: "table" | "seat";
  tableCount: number;
  seats: number;
  withContent?: boolean;
};

async function main(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const dbName = decodeURIComponent(url.pathname.slice(1));
  if (!DB_PATTERN.test(dbName) || dbName.length > 63) {
    throw new Error(`Veritabanı adı ${DB_PATTERN} desenine uymuyor: ${JSON.stringify(dbName)}`);
  }
  const userPassword = process.env.CROSS_USER_PASSWORD;
  if (!userPassword) {
    throw new Error("CROSS_USER_PASSWORD ortam değişkeni gerekli");
  }

  const out = arg("out");
  const tableCount = Number(arg("tables", "6"));
  const seats = Number(arg("seats", "8"));
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR ?? "./.next-e2e/uploads");

  const { Pool } = coreRequire("pg");
  const { drizzle } = coreRequire("drizzle-orm/node-postgres");
  const { migrate } = coreRequire("drizzle-orm/node-postgres/migrator");
  const sharp = coreRequire("sharp");

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
    const { adminActor } = await coreImport("tests/helpers/actors.ts");
    const { createAdmin } = await coreImport("scripts/create-admin-dev.ts");
    const { createUser } = await coreImport("src/features/users/service.ts");
    const { saveImage } = await coreImport("src/features/uploads/images.ts");

    const db = drizzle(pool, { schema });

    const adminUsername = "cross-admin";
    const entUsername = "cross-ent";
    await createAdmin({ username: adminUsername, password: userPassword });
    await createUser(db, adminActor(), {
      username: entUsername,
      password: userPassword,
      role: "user",
      memberships: [{ department: "entertainment", level: "manager" }],
      permissions: [],
    });

    const makeSolidPng = async (r: number, g: number, b: number, name: string) => {
      const buf = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r, g, b } } }).png().toBuffer();
      return new File([buf], name, { type: "image/png" });
    };
    const koltukCover = (await saveImage(await makeSolidPng(180, 140, 60, "cover.png"), "event", uploadRoot)).path;
    const koltukArtist = (await saveImage(await makeSolidPng(60, 120, 180, "artist.png"), "artist", uploadRoot)).path;

    const startsAt = new Date(Date.now() + 30 * 86_400_000);

    async function seedEvent(tx: unknown, spec: EventSpec) {
      let artistId: string | undefined;
      let artistName: string | undefined;
      let coverImage: string | undefined;

      if (spec.withContent) {
        const [artist] = await (tx as typeof db)
          .insert(schema.artists)
          .values({
            name: "Çapraz Sanatçı",
            nameKey: "ÇAPRAZ SANATÇI",
            image: koltukArtist,
            isDemo: false,
          })
          .returning();
        artistId = artist.id;
        artistName = artist.name;
        coverImage = koltukCover;
      }

      const event = await createEvent(tx, {
        name: spec.name,
        status: "published",
        startsAt,
        ...(artistId ? { artistId, artistName } : {}),
        ...(coverImage ? { coverImage } : {}),
      });

      if (spec.withContent) {
        await (tx as typeof db).insert(schema.eventSiteContent).values({
          eventId: event.id,
          summary: "Çapraz test tanıtım metni.",
          ageLimit: "18+",
          dressCode: "Şık",
          doorsOpenAt: new Date(startsAt.getTime() - 90 * 60_000),
          sightlineSet: null,
        });
      }

      const tables: { id: string; label: string; seats: number }[] = [];
      for (let i = 1; i <= spec.tableCount; i++) {
        const t = await createTable(tx, event.id, {
          label: `T${i}`,
          capacity: spec.seats,
          x: 100 + ((i - 1) % 10) * 90,
          y: 100 + Math.floor((i - 1) / 10) * 90,
          saleCategory: i <= 2 ? "premium" : "standard",
        });
        tables.push({ id: t.id, label: t.label, seats: spec.seats });
      }
      await createTable(tx, event.id, { label: "C1", capacity: spec.seats, x: 100, y: 40, allocation: "casino" });
      await openOnline(tx, event.id, tables.map((t) => t.id));
      await setFinalPrices(tx, event.id, { standard: "1500.00", premium: "2500.00" });
      await setSaleSettings(tx, event.id, {
        holdMinutes: 10,
        blockSingleLeftover: true,
        sharedTables: spec.saleMode === "seat",
        saleMode: spec.saleMode,
      });
      await setStage(tx, event.id, "on_sale");
      return { id: event.id as string, name: spec.name, saleMode: spec.saleMode, tables };
    }

    const specs: EventSpec[] = [
      { key: "gala", name: "Çapraz Test Gecesi", saleMode: "seat", tableCount, seats },
      { key: "koltuk", name: "Çapraz Sandalye Gecesi", saleMode: "seat", tableCount: 6, seats, withContent: true },
      { key: "masa", name: "Çapraz Masa Gecesi", saleMode: "table", tableCount: 6, seats },
      { key: "icerik", name: "Çapraz İçerik Gecesi", saleMode: "seat", tableCount: 6, seats },
    ];

    const events = await db.transaction(async (tx: unknown) => {
      const entries = await Promise.all(specs.map(async (spec) => [spec.key, await seedEvent(tx, spec)] as const));
      return Object.fromEntries(entries) as Record<EventSpec["key"], Awaited<ReturnType<typeof seedEvent>>>;
    });

    const result = {
      eventId: events.gala.id,
      tables: events.gala.tables,
      events,
      users: { admin: adminUsername, entertainment: entUsername },
    };

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
