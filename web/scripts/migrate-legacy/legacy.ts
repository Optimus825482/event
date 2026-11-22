import pg from "pg";
import { Row } from "./values";

/**
 * Eski (NestJS/TypeORM) veritabanını SALT-OKUNUR okur.
 * - Oturum `default_transaction_read_only=on` ile açılır, okuma `BEGIN READ ONLY` +
 *   REPEATABLE READ anlık görüntüsünde yapılır (tüm tablolar aynı anı görür).
 * - `timestamp without time zone` sütunları PostgreSQL'de `"col" AT TIME ZONE $tz` ile
 *   `timestamptz`'ye çevrilerek okunur; böylece `LEGACY_TZ` yorumu (DST dahil) veritabanının
 *   kendi saat dilimi kurallarıyla yapılır.
 * - `date` sütunları ham metin olarak okunur (yerel saat dilimine kaymaz).
 */

export const LEGACY_TABLES = [
  "customers",
  "department_locations",
  "department_positions",
  "departments",
  "event_extra_staff",
  "event_invitations",
  "event_staff_assignments",
  "events",
  "guest_notes",
  "invitation_templates",
  "migrations",
  "notification_reads",
  "notifications",
  "organization_templates",
  "positions",
  "reservations",
  "service_point_staff_assignments",
  "service_points",
  "service_teams",
  "staff",
  "staff_assignments",
  "staff_colors",
  "staff_performance_logs",
  "staff_performance_reviews",
  "staff_roles",
  "system_settings",
  "table_groups",
  "table_types",
  "teams",
  "users",
  "venue_templates",
  "work_locations",
  "work_shifts",
  // Eski kodda entity'si ve migration'ı var, şema dökümünde yok: varsa taşınır.
  "user_permissions",
] as const;

export type LegacyTable = (typeof LEGACY_TABLES)[number];
export type UnknownTable = { name: string; rows: number };
export type LegacyData = Record<LegacyTable, Row[]> & { readonly unknownTables: readonly UnknownTable[] };

const DATE_OID = 1082;
const TIMESTAMP_OID = 1114;

function legacyTypes(): pg.CustomTypesConfig {
  return {
    getTypeParser: ((oid: number, format?: "text" | "binary") => {
      if (oid === DATE_OID || oid === TIMESTAMP_OID) return (value: string) => value;
      return format === "binary" ? pg.types.getTypeParser(oid, "binary") : pg.types.getTypeParser(oid, "text");
    }) as pg.CustomTypesConfig["getTypeParser"],
  };
}

export type LegacySource = { client: pg.Client; close: () => Promise<void> };

export async function openLegacy(connectionString: string): Promise<LegacySource> {
  const client = new pg.Client({
    connectionString,
    types: legacyTypes(),
    options: "-c default_transaction_read_only=on",
    application_name: "eventflow-migrate-legacy (read-only)",
  });
  await client.connect();
  await client.query("SET default_transaction_read_only = on");
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const check = await client.query<{ transaction_read_only: string }>("SHOW transaction_read_only");
  if (check.rows[0]?.transaction_read_only !== "on") {
    await client.end();
    throw new Error("Eski veritabanı oturumu salt-okunur açılamadı");
  }
  return {
    client,
    close: async () => {
      try {
        await client.query("ROLLBACK");
      } finally {
        await client.end();
      }
    },
  };
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Saat dilimi adı PostgreSQL'in tanıdığı bir ad olmalı (yanlış yazım sessizce UTC'ye düşmesin). */
export async function assertTimeZone(client: pg.Client, tz: string): Promise<void> {
  const res = await client.query("SELECT 1 FROM pg_timezone_names WHERE name = $1", [tz]);
  if (res.rowCount === 0) throw new Error(`LEGACY_TZ tanınmıyor: ${tz}`);
}

async function readTable(client: pg.Client, table: string, tz: string): Promise<Row[]> {
  const cols = await client.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table],
  );
  if (cols.rows.length === 0) return [];
  const list = cols.rows
    .map((c) =>
      c.data_type === "timestamp without time zone"
        ? `(${quoteIdent(c.column_name)} AT TIME ZONE $1) AS ${quoteIdent(c.column_name)}`
        : quoteIdent(c.column_name),
    )
    .join(", ");
  const hasId = cols.rows.some((c) => c.column_name === "id");
  const order = hasId ? ` ORDER BY ${quoteIdent("id")}` : "";
  const res = await client.query<Record<string, unknown>>(
    `SELECT ${list}, $1::text AS "__tz" FROM public.${quoteIdent(table)}${order}`,
    [tz],
  );
  return res.rows.map((r) => {
    const copy: Record<string, unknown> = { ...r };
    delete copy.__tz;
    return new Row(copy);
  });
}

export async function loadLegacy(client: pg.Client, tz: string): Promise<LegacyData> {
  await assertTimeZone(client, tz);
  const existing = await client.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
  );
  const names = new Set(existing.rows.map((r) => r.table_name));
  const known = new Set<string>(LEGACY_TABLES);
  const tables = {} as Record<LegacyTable, Row[]>;
  for (const table of LEGACY_TABLES) {
    tables[table] = names.has(table) ? await readTable(client, table, tz) : [];
  }
  const unknownTables: UnknownTable[] = [];
  for (const name of [...names].filter((n) => !known.has(n)).sort()) {
    const res = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.${quoteIdent(name)}`);
    unknownTables.push({ name, rows: Number(res.rows[0]?.n ?? 0) });
  }
  return { ...tables, unknownTables };
}

export function sourceCounts(data: LegacyData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const table of LEGACY_TABLES) out[table] = data[table].length;
  return out;
}
