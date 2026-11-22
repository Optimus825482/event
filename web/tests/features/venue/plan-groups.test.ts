import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { systemSettings, tableGroupTables } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { getFloorPlan, listTableGroupMembers } from "@/features/venue/plan-service";
import { getEditorViewSettings } from "@/features/venue/view-settings-service";
import { truncateAll } from "../../helpers/db";
import { createEvent, createTable, createTableGroup, createUser } from "../../helpers/factories";

async function admin(): Promise<Actor> {
  const u = await createUser(db, { role: "admin" });
  return { id: u.id, username: u.username, role: "admin", staffId: null };
}

describe("planda masa grupları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("gruba bağlı masa grup adı/rengiyle döner, diğeri null", async () => {
    const actor = await admin();
    const event = await createEvent(db);
    const grouped = await createTable(db, event.id, { label: "A1" });
    await createTable(db, event.id, { label: "A2" });
    const group = await createTableGroup(db, event.id, { name: "Salon 1", color: "#ef4444" });
    await db.insert(tableGroupTables).values({ eventId: event.id, tableGroupId: group.id, tableId: grouped.id });

    const plan = await getFloorPlan(db, actor, event.id);
    const byLabel = new Map(plan.tables.map((t) => [t.label, t]));
    expect(byLabel.get("A1")?.group).toEqual({ name: "Salon 1", color: "#ef4444" });
    expect(byLabel.get("A2")?.group).toBeNull();
    await expect(listTableGroupMembers(db, event.id)).resolves.toEqual([
      { tableId: grouped.id, name: "Salon 1", color: "#ef4444" },
    ]);
  });
});

describe("düzenleyici görünüm ayarları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("ayar satırı yoksa varsayılan", async () => {
    await expect(getEditorViewSettings(db)).resolves.toEqual({ gridSize: 20, snap: true, showGrid: true });
  });

  it("sistem ayarlarındaki ızgara değerlerini okur", async () => {
    await db.insert(systemSettings).values({ defaultGridSize: 40, snapToGrid: false, showGridByDefault: false });
    await expect(getEditorViewSettings(db)).resolves.toEqual({ gridSize: 40, snap: false, showGrid: false });
  });
});
