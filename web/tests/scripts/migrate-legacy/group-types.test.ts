import { APP_TIME_ZONE } from "@/lib/time-zone";
import bcrypt from "bcryptjs";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MigrationReport } from "../../../scripts/migrate-legacy/report";
import { runMigration } from "../../../scripts/migrate-legacy/run";
import { createLegacyDb, createTargetDb, dbUrl, dropDb, uniqueDbName, withClient } from "./harness";

/** Eski grup tipleri: tanınmayan tip "standard" olur; loca/standart tutarsızlığı raporlanır ve bağlantı taşınmaz. SENTETİK veri. */

const LEGACY = uniqueDbName("eventflow_legacy_test", "gtype");
const TARGET = uniqueDbName("eventflow_etl_test", "gtype");

const id = (group: number, n: number) => `00000000-0000-4000-8${String(group).padStart(3, "0")}-${String(n).padStart(12, "0")}`;
const ADMIN = id(1, 1);
const EVENT = id(4, 1);
const G_VIP = id(7, 1);
const G_LOCA_BAD = id(7, 2);
const G_STD_BAD = id(7, 3);
const G_LOCA_OK = id(7, 4);

async function ins(client: pg.Client, table: string, row: Record<string, unknown>): Promise<void> {
  const cols = Object.keys(row);
  await client.query(
    `INSERT INTO public."${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
    cols.map((c) => row[c]),
  );
}

async function seed(client: pg.Client): Promise<void> {
  await ins(client, "users", { id: ADMIN, username: "admin", role: "admin", email: "admin@example.test", password: bcrypt.hashSync("x-12345678", 4), fullName: "Yönetici", createdAt: "2024-01-01 09:00:00" });
  const layout = {
    placedTables: [
      { id: "t-a", tableNumber: 1, type: "standard", capacity: 8, x: 0, y: 0, isLoca: false },
      { id: "t-b", tableNumber: 2, type: "standard", capacity: 8, x: 100, y: 0, isLoca: false },
      { id: "t-l1", tableNumber: 3, type: "loca", capacity: 6, x: 0, y: 200, isLoca: true, locaName: "L1" },
      { id: "t-l2", tableNumber: 4, type: "loca", capacity: 6, x: 100, y: 200, isLoca: true, locaName: "L2" },
    ],
  };
  await ins(client, "events", { id: EVENT, name: "Etkinlik", eventDate: "2025-06-01 21:00:00", organizerId: ADMIN, venueLayout: JSON.stringify(layout) });
  await ins(client, "table_groups", { id: G_VIP, eventId: EVENT, name: "Vip", groupType: "vip", tableIds: ["t-a"], sortOrder: 0 });
  await ins(client, "table_groups", { id: G_LOCA_BAD, eventId: EVENT, name: "LocaKötü", groupType: "loca", tableIds: ["t-b"], sortOrder: 1 });
  await ins(client, "table_groups", { id: G_STD_BAD, eventId: EVENT, name: "StdKötü", groupType: "standard", tableIds: ["t-l1"], sortOrder: 2 });
  await ins(client, "table_groups", { id: G_LOCA_OK, eventId: EVENT, name: "LocaIyi", groupType: "loca", tableIds: ["t-l2"], sortOrder: 3 });
}

let report: MigrationReport;

beforeAll(async () => {
  await createLegacyDb(LEGACY);
  await withClient(LEGACY, seed);
  await createTargetDb(TARGET);
  report = await runMigration({ legacyUrl: dbUrl(LEGACY), targetUrl: dbUrl(TARGET), dryRun: false, legacyTz: APP_TIME_ZONE, emptyCheck: true });
}, 180_000);

afterAll(async () => {
  await dropDb(LEGACY);
  await dropDb(TARGET);
}, 180_000);

describe("eski masa grubu tipleri", () => {
  it("taşıma kısıt hatasıyla düşmez", () => {
    expect(report.error).toBeNull();
    expect(report.outcome).toBe("committed");
  });

  it("tanınmayan tip standard olur, tutarsız bağlantılar atlanır, tutarlılar korunur", async () => {
    await withClient(TARGET, async (c) => {
      const types = (await c.query<{ name: string; group_type: string }>("SELECT name, group_type FROM table_groups")).rows;
      expect(Object.fromEntries(types.map((r) => [r.name, r.group_type]))).toEqual({
        Vip: "standard",
        LocaKötü: "loca",
        StdKötü: "standard",
        LocaIyi: "loca",
      });
      const links = (
        await c.query<{ name: string; label: string }>(
          "SELECT g.name, t.label FROM table_group_tables l JOIN table_groups g ON g.id = l.table_group_id JOIN event_tables t ON t.id = l.table_id",
        )
      ).rows.map((r) => `${r.name}:${r.label}`);
      expect(links.sort()).toEqual(["LocaIyi:L2", "Vip:1"]);
    });
  });

  it("normalize edilen tip ve her tutarsızlık raporlanır", () => {
    const rows = report.categories.invalidValues.filter((f) => f.table === "table_groups");
    expect(rows.filter((f) => f.field === "groupType").map((f) => [f.id, f.from, f.to])).toEqual([[G_VIP, "vip", "standard"]]);
    expect(rows.filter((f) => f.field === "tableIds").map((f) => f.id).sort()).toEqual([G_LOCA_BAD, G_STD_BAD].sort());
  });
});
