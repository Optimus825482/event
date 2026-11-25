import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { venueTemplates } from "@/db/schema";
import { can } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { venueActionDefs } from "@/features/venue/action-defs";
import { createAction } from "@/lib/action";
import { assistantActor, managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

function actionsFor(actor: Actor) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return {
    saveLayout: defineAction(venueActionDefs.saveLayout),
    deleteTemplate: defineAction(venueActionDefs.deleteTemplate),
  };
}

const decor = { width: 1200, height: 800, elements: [] };
const tables = [{ label: "M1", capacity: 8, x: 0, y: 0 }];

describe("etkinlik yerleşimi yetkisi (venues modülü)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("F&B yöneticisi etkinlik yerleşimini kaydeder", async () => {
    const actor = await persistActor(db, managerActor("fnb"));
    const event = await f.createEvent(db);
    expect((await actionsFor(actor).saveLayout({ eventId: event.id, tables, decor })).ok).toBe(true);
  });

  it("F&B asistanı yerleşimi kaydeder", async () => {
    const actor = await persistActor(db, assistantActor("fnb"));
    const event = await f.createEvent(db);
    expect((await actionsFor(actor).saveLayout({ eventId: event.id, tables, decor })).ok).toBe(true);
  });

  it("Casino yöneticisi yerleşimi görür ama kaydedemez", async () => {
    const actor = await persistActor(db, managerActor("casino"));
    const event = await f.createEvent(db);
    expect(can(actor, "events", "view")).toBe(true);
    expect(can(actor, "venues", "view")).toBe(true);
    expect(await actionsFor(actor).saveLayout({ eventId: event.id, tables, decor })).toMatchObject({
      ok: false,
      code: "forbidden",
    });
  });

  it("Entertainment yöneticisi etkinliği düzenler ama yerleşimi kaydedemez", async () => {
    const actor = await persistActor(db, managerActor("entertainment"));
    const event = await f.createEvent(db, { organizerId: actor.id });
    expect(can(actor, "events", "edit")).toBe(true);
    expect(await actionsFor(actor).saveLayout({ eventId: event.id, tables, decor })).toMatchObject({
      ok: false,
      code: "forbidden",
    });
  });

  it("F&B asistanı yerleşim şablonunu silemez; yönetici siler", async () => {
    const assistant = await persistActor(db, assistantActor("fnb"));
    const manager = await persistActor(db, managerActor("fnb"));
    const [row] = await db
      .insert(venueTemplates)
      .values({ name: "Şablon", layoutData: { tables: [], decor }, createdById: manager.id, isPublic: true })
      .returning();
    if (!row) throw new Error("şablon eklenemedi");
    expect(await actionsFor(assistant).deleteTemplate({ id: row.id })).toMatchObject({ ok: false, code: "forbidden" });
    expect((await actionsFor(manager).deleteTemplate({ id: row.id })).ok).toBe(true);
  });
});
