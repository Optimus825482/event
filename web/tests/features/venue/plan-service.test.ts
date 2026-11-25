import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { getFloorPlan } from "@/features/venue/plan-service";
import { adminActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createEvent, createTable, createUser } from "../../helpers/factories";

async function actorOf(role: "admin" | "organizer"): Promise<Actor> {
  if (role === "admin") return persistActor(db, adminActor());
  // Sahiplik testi: eski organizatör rolü (bu görevde dokunulmaz).
  const u = await createUser(db, { role });
  return { id: u.id, username: u.username, role, staffId: null, memberships: [], permissions: [] };
}

describe("getFloorPlan", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("masaları, dekoru ve tuval boyutunu döner", async () => {
    const admin = await actorOf("admin");
    const event = await createEvent(db);
    await createTable(db, event.id, { label: "A1", capacity: 6, x: 100, y: 200, isLoca: true });
    await db
      .update(events)
      .set({
        layoutDecor: { width: 900, height: 600, elements: [{ id: "s1", kind: "stage", x: 0, y: 0, width: 200, height: 80 }] },
      })
      .where(eq(events.id, event.id));
    const plan = await getFloorPlan(db, admin, event.id);
    expect(plan.canvas).toEqual({ width: 900, height: 600 });
    expect(plan.decor).toHaveLength(1);
    expect(plan.tables).toMatchObject([{ label: "A1", capacity: 6, x: 100, y: 200, isLoca: true, shape: "round", color: null }]);
  });

  it("organizatör başkasının etkinliğini göremez; kendisininkini görür", async () => {
    const owner = await actorOf("organizer");
    const other = await actorOf("organizer");
    const event = await createEvent(db, { organizerId: owner.id });
    await expect(getFloorPlan(db, other, event.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(getFloorPlan(db, owner, event.id)).resolves.toMatchObject({ tables: [] });
  });

  it("olmayan etkinlik not_found", async () => {
    const admin = await actorOf("admin");
    await expect(getFloorPlan(db, admin, "00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ code: "not_found" });
  });
});
