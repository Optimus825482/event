import bcrypt from "bcryptjs";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MigrationReport } from "../../../scripts/migrate-legacy/report";
import { runMigration } from "../../../scripts/migrate-legacy/run";
import { createLegacyDb, createTargetDb, dbUrl, dropDb, uniqueDbName, withClient } from "./harness";

/**
 * Eski Excel içe aktarımı ve ekip organizasyonu masa referanslarını yerleşim kimliği yerine
 * masa NUMARASI (etiket) ya da loca adıyla saklıyordu; eski uygulama bunları
 * kimlik → etiket → loca adı sırasıyla çözüyordu (Step5Summary.resolveToTableId).
 * Gruplar, atamalar, ekip masaları ve ek personel masaları da aynı sırayla çözülmeli.
 * SENTETİK veri (gerçek kişisel veri içermez).
 */

const LEGACY = uniqueDbName("eventflow_legacy_test", "refs");
const TARGET = uniqueDbName("eventflow_etl_test", "refs");

const id = (group: number, n: number) => `00000000-0000-4000-8${String(group).padStart(3, "0")}-${String(n).padStart(12, "0")}`;
const ADMIN = id(1, 1);
const STAFF = id(2, 1);
const EVENT = id(4, 1);
const OTHER_EVENT = id(4, 2);
const GROUP = id(7, 11);
const TEAM = id(7, 2);
const ASSIGNMENT = id(9, 1);
const EXTRA = id(9, 9);

async function ins(client: pg.Client, table: string, row: Record<string, unknown>): Promise<void> {
  const cols = Object.keys(row);
  const values = cols.map((c) => {
    const v = row[c];
    return v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v;
  });
  await client.query(
    `INSERT INTO public."${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
    values,
  );
}

async function seed(client: pg.Client): Promise<void> {
  await ins(client, "users", { id: ADMIN, username: "admin", role: "admin", email: "admin@example.test", password: bcrypt.hashSync("x-12345678", 4), fullName: "Yönetici", createdAt: "2024-01-01 09:00:00" });
  await ins(client, "staff", { id: STAFF, sicilNo: "S001", fullName: "Personel Bir", position: "garson" });
  const layout = {
    placedTables: [
      { id: "table-1-a1", tableNumber: 1, type: "standard", capacity: 8, x: 0, y: 0, isLoca: false },
      { id: "table-2-b2", tableNumber: 2, type: "standard", capacity: 8, x: 100, y: 0, isLoca: false },
      { id: "loca-1-c3", tableNumber: 3, type: "loca", capacity: 6, x: 0, y: 200, isLoca: true, locaName: "L1" },
    ],
  };
  await ins(client, "events", { id: EVENT, name: "Etkinlik", eventDate: "2025-06-01 21:00:00", organizerId: ADMIN, venueLayout: JSON.stringify(layout) });
  // Aynı numaralı masası olan başka bir etkinlik: referans yalnızca KENDİ etkinliğinde çözülmeli.
  await ins(client, "events", {
    id: OTHER_EVENT, name: "Diğer", eventDate: "2025-07-01 21:00:00", organizerId: ADMIN,
    venueLayout: JSON.stringify({ placedTables: [{ id: "table-9-z9", tableNumber: 9, type: "standard", capacity: 8, x: 0, y: 0 }] }),
  });
  await ins(client, "service_teams", { id: TEAM, eventId: EVENT, name: "Ekip", tableIds: ["2"] });
  await ins(client, "table_groups", { id: GROUP, eventId: EVENT, name: "Ön", tableIds: ["1", "table-2-b2", "9"], sortOrder: 0 });
  await ins(client, "event_staff_assignments", { id: ASSIGNMENT, eventId: EVENT, staffId: STAFF, tableIds: ["1", "L1", "404"], createdAt: "2025-05-01 00:00:00" });
  await ins(client, "event_extra_staff", { id: EXTRA, event_id: EVENT, full_name: "Geçici", assigned_tables: JSON.stringify(["3"]) });
}

let report: MigrationReport;

beforeAll(async () => {
  await createLegacyDb(LEGACY);
  await withClient(LEGACY, seed);
  await createTargetDb(TARGET);
  report = await runMigration({ legacyUrl: dbUrl(LEGACY), targetUrl: dbUrl(TARGET), dryRun: false, legacyTz: "Europe/Istanbul", emptyCheck: true });
}, 180_000);

afterAll(async () => {
  await dropDb(LEGACY);
  await dropDb(TARGET);
}, 180_000);

describe("masa numarasıyla saklanan masa referansları", () => {
  it("taşıma işlenir ve doğrulama geçer", () => {
    expect(report.error).toBeNull();
    expect(report.outcome).toBe("committed");
    expect(report.verification.filter((v) => !v.ok)).toEqual([]);
  });

  it("grup, atama, ekip ve ek personel masaları numara / loca adıyla çözülür", async () => {
    await withClient(TARGET, async (c) => {
      const q = async (sql: string, params: unknown[]) => (await c.query<{ label: string }>(sql, params)).rows.map((r) => r.label).sort();
      expect(await q("SELECT t.label FROM table_group_tables g JOIN event_tables t ON t.id = g.table_id WHERE g.table_group_id = $1", [GROUP])).toEqual(["1", "2"]);
      expect(await q("SELECT t.label FROM assignment_tables a JOIN event_tables t ON t.id = a.table_id WHERE a.assignment_id = $1", [ASSIGNMENT])).toEqual(["1", "L1"]);
      expect(await q("SELECT t.label FROM event_extra_staff_tables x JOIN event_tables t ON t.id = x.table_id WHERE x.extra_staff_id = $1", [EXTRA])).toEqual(["L1"]);
    });
  });

  it("yalnızca hiçbir yolla çözülemeyen referanslar yetim kalır; etiketle çözülenler raporlanır", () => {
    const orphans = report.categories.orphanTableReferences.map((f) => [f.table, f.legacyRef]);
    expect(orphans.sort()).toEqual([
      ["event_staff_assignments", "404"],
      ["table_groups", "9"],
    ]);
    const byLabel = report.categories.tablesResolvedByLabel.map((f) => [f.table, f.legacyRef]).sort();
    expect(byLabel).toEqual([
      ["event_extra_staff", "3"],
      ["event_staff_assignments", "1"],
      ["event_staff_assignments", "L1"],
      ["service_teams", "2"],
      ["table_groups", "1"],
    ]);
  });
});
