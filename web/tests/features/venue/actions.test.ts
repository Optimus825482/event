import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eq } from "drizzle-orm";
import { eventTables, tableTypes, venueTemplates } from "@/db/schema";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { venueActionDefs } from "@/features/venue/action-defs";
import { createAction } from "@/lib/action";
import { adminActor, managerActor, noAccessActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";

async function makeActor(actor: Actor = managerActor("fnb")): Promise<Actor> {
  return persistActor(db, actor);
}

/** Sahiplik/eski rol testleri: eski rolle aktör (bu görevde dokunulmaz). */
async function makeLegacy(role: Role): Promise<Actor> {
  const u = await f.createUser(db, { role });
  return { id: u.id, username: u.username, role: u.role, staffId: u.staffId, memberships: [], permissions: [] };
}

function actionsFor(actor: Actor | null) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return {
    saveLayout: defineAction(venueActionDefs.saveLayout),
    saveAsTemplate: defineAction(venueActionDefs.saveAsTemplate),
    createTableType: defineAction(venueActionDefs.createTableType),
    updateTemplate: defineAction(venueActionDefs.updateTemplate),
    deleteTemplate: defineAction(venueActionDefs.deleteTemplate),
  };
}

const decor = { width: 1200, height: 800, elements: [] };

describe("venue actions", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("organizatör yerleşimi kaydeder", async () => {
    const actor = await makeActor(managerActor("fnb"));
    const event = await f.createEvent(db, { organizerId: actor.id });
    const res = await actionsFor(actor).saveLayout({
      eventId: event.id,
      tables: [{ label: "M1", capacity: 8, x: 0, y: 0 }],
      decor,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.totalCapacity).toBe(8);
  });

  it("staff rolü yerleşim kaydedemez; satır yazılmaz", async () => {
    const actor = await makeActor(noAccessActor());
    const event = await f.createEvent(db);
    const res = await actionsFor(actor).saveLayout({
      eventId: event.id,
      tables: [{ label: "M1", capacity: 8, x: 0, y: 0 }],
      decor,
    });
    expect(res).toMatchObject({ ok: false, code: "forbidden" });
    expect(await db.select().from(eventTables)).toHaveLength(0);
  });

  it("kapasite 0 ve yinelenen etiket alan hatası olarak döner", async () => {
    const actor = await makeActor(managerActor("fnb"));
    const event = await f.createEvent(db, { organizerId: actor.id });
    const res = await actionsFor(actor).saveLayout({
      eventId: event.id,
      tables: [
        { label: "M1", capacity: 0, x: 0, y: 0 },
        { label: "m1", capacity: 4, x: 0, y: 0 },
      ],
      decor,
    });
    expect(res).toMatchObject({ ok: false, code: "invalid" });
    if (!res.ok) {
      expect(res.fieldErrors?.["tables.0.capacity"]?.length).toBeGreaterThan(0);
      expect(res.fieldErrors?.["tables.1.label"]?.length).toBeGreaterThan(0);
    }
  });

  it("rezervasyonlu masa silme conflict ve etiketi mesajda", async () => {
    const actor = await makeActor(managerActor("fnb"));
    const event = await f.createEvent(db, { organizerId: actor.id });
    const table = await f.createTable(db, event.id, { label: "VIP-7" });
    const customer = await f.createCustomer(db);
    await f.createReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
    const res = await actionsFor(actor).saveLayout({ eventId: event.id, tables: [], decor });
    expect(res).toMatchObject({ ok: false, code: "conflict" });
    if (!res.ok) expect(res.message).toContain("VIP-7");
  });

  it("mekân sahibi etkinlikten şablon alamaz", async () => {
    const owner = await makeLegacy("venue_owner");
    const event = await f.createEvent(db);
    const res = await actionsFor(owner).saveAsTemplate({ eventId: event.id, name: "X" });
    expect(res).toMatchObject({ ok: false, code: "forbidden" });
    expect(await db.select().from(venueTemplates)).toHaveLength(0);
  });

  it("masa tipini yalnızca ayar yetkisi olan oluşturur", async () => {
    const input = { name: "VIP", color: "#ffaa00", shape: "round", capacity: "12", basePrice: "0" };
    const organizer = await makeActor(managerActor("fnb"));
    expect(await actionsFor(organizer).createTableType(input)).toMatchObject({ ok: false, code: "forbidden" });
    const admin = await makeActor(adminActor());
    expect((await actionsFor(admin).createTableType(input)).ok).toBe(true);
    expect(await db.select().from(tableTypes)).toHaveLength(1);
  });

  describe("mekân sahibi şablonları", () => {
    async function template(createdById: string) {
      const [row] = await db
        .insert(venueTemplates)
        .values({ name: "Şablon", layoutData: { tables: [], decor }, createdById, isPublic: true })
        .returning();
      if (!row) throw new Error("şablon eklenemedi");
      return row;
    }

    it("kendi şablonunu günceller ve siler", async () => {
      const owner = await makeLegacy("venue_owner");
      const mine = await template(owner.id);
      const actions = actionsFor(owner);
      expect((await actions.updateTemplate({ id: mine.id, name: "Yeni" })).ok).toBe(true);
      expect((await actions.deleteTemplate({ id: mine.id })).ok).toBe(true);
      expect(await db.select().from(venueTemplates).where(eq(venueTemplates.id, mine.id))).toHaveLength(0);
    });

    it("başkasının (herkese açık) şablonunu değiştiremez ve silemez", async () => {
      const owner = await makeLegacy("venue_owner");
      const other = await makeLegacy("venue_owner");
      const theirs = await template(other.id);
      const actions = actionsFor(owner);
      expect(await actions.updateTemplate({ id: theirs.id, name: "Ele geçir" })).toMatchObject({ ok: false, code: "forbidden" });
      expect(await actions.deleteTemplate({ id: theirs.id })).toMatchObject({ ok: false, code: "forbidden" });
      expect(await db.select().from(venueTemplates).where(eq(venueTemplates.id, theirs.id))).toHaveLength(1);
    });

    it("olmayan şablon, başkasınınkiyle aynı yanıtı verir (varlık sızmaz)", async () => {
      const owner = await makeLegacy("venue_owner");
      const res = await actionsFor(owner).deleteTemplate({ id: crypto.randomUUID() });
      expect(res).toMatchObject({ ok: false, code: "forbidden" });
      const admin = await makeActor(adminActor());
      expect(await actionsFor(admin).deleteTemplate({ id: crypto.randomUUID() })).toMatchObject({ ok: false, code: "not_found" });
    });
  });
});
