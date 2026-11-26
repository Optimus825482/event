import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { events, tableTypes, venueTemplates } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { listEventTables } from "@/features/events/service";
import { applyVenueTemplate, saveAsTemplate, saveLayout } from "@/features/venue/service";
import { parseTemplateLayout } from "@/features/venue/template-layout";
import {
  deleteVenueTemplate,
  duplicateVenueTemplate,
  listVenueTemplates,
  updateVenueTemplate,
} from "@/features/venue/templates-service";
import type { TemplateLayout } from "@/features/venue/schemas";
import { DomainError } from "@/lib/action";
import { adminActor, managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { setAllocation } from "../../helpers/seating";

async function makeActor(actor: Actor = managerActor("fnb")): Promise<Actor> {
  return persistActor(db, actor);
}


async function caught(promise: Promise<unknown>): Promise<DomainError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  return err as DomainError;
}

const ATTRS = { isVip: false, isPinned: false, size: null, floor: 1, sortNumber: null } as const;

const templateLayout: TemplateLayout = {
  version: 1,
  tables: [
    { label: "M1", capacity: 10, tableTypeId: null, x: 500, y: 500, rotation: 0, isLoca: false, ...ATTRS },
    { label: "T2", capacity: 6, tableTypeId: null, x: 600, y: 500, rotation: 0, isLoca: false, ...ATTRS },
    { label: "T3", capacity: 4, tableTypeId: null, x: 700, y: 500, rotation: 0, isLoca: true, ...ATTRS },
  ],
  decor: {
    width: 2000,
    height: 1000,
    elements: [{ id: "s", kind: "stage", x: 0, y: 0, width: 400, height: 100, rotation: 0, label: "Sahne" }],
  },
};

async function insertTemplate(createdById: string | null, o: Partial<typeof venueTemplates.$inferInsert> = {}) {
  const [row] = await db
    .insert(venueTemplates)
    .values({ name: "Salon A", layoutData: templateLayout, createdById, ...o })
    .returning();
  if (!row) throw new Error("şablon yok");
  return row;
}

describe("applyVenueTemplate", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("rezervasyonlu mevcut masaları korur, diğerlerini şablonla değiştirir", async () => {
    const actor = await makeActor();
    const event = await f.createEvent(db, { organizerId: actor.id });
    const saved = await saveLayout(db, actor, {
      eventId: event.id,
      tables: [
        { label: "M1", capacity: 8, x: 10, y: 10 },
        { label: "Eski", capacity: 8, x: 20, y: 20 },
      ],
      decor: { elements: [] },
    });
    const m1 = saved.tables.find((t) => t.label === "M1");
    if (!m1) throw new Error("masa yok");
    const customer = await f.createCustomer(db);
    await setAllocation(db, [m1.id], "casino");
    const reservation = await f.createReservation(db, { eventId: event.id, tableId: m1.id, customerId: customer.id });
    const template = await insertTemplate(actor.id);

    const res = await applyVenueTemplate(db, actor, { eventId: event.id, templateId: template.id });

    expect(res.keptLabels).toEqual(["M1"]);
    expect(res.skippedLabels).toEqual(["M1"]);
    const after = await listEventTables(db, event.id);
    expect(after.map((t) => t.label)).toEqual(["M1", "T2", "T3"]);
    const keptRow = after.find((t) => t.label === "M1");
    expect(keptRow).toMatchObject({ id: m1.id, x: 10, capacity: 8 });
    expect(reservation.tableId).toBe(m1.id);
    expect(res.totalCapacity).toBe(8 + 6 + 4);

    const [ev] = await db.select().from(events).where(eq(events.id, event.id));
    expect(ev?.venueTemplateId).toBe(template.id);
    expect(ev?.totalCapacity).toBe(18);
    expect(ev?.layoutDecor).toMatchObject({ width: 2000, elements: [{ label: "Sahne" }] });
    const [tpl] = await db.select().from(venueTemplates).where(eq(venueTemplates.id, template.id));
    expect(tpl?.usageCount).toBe(1);
  });

  it("başkasının özel şablonu not_found; herkese açık şablon uygulanabilir", async () => {
    const actor = await makeActor();
    const other = await makeActor();
    const event = await f.createEvent(db, { organizerId: actor.id });
    const privateTpl = await insertTemplate(other.id);
    expect((await caught(applyVenueTemplate(db, actor, { eventId: event.id, templateId: privateTpl.id }))).code).toBe(
      "not_found",
    );
    const publicTpl = await insertTemplate(other.id, { isPublic: true });
    const res = await applyVenueTemplate(db, actor, { eventId: event.id, templateId: publicTpl.id });
    expect(res.tables).toHaveLength(3);
  });

  it("silinmiş masa tipine işaret eden şablon masası tipsiz eklenir", async () => {
    const actor = await makeActor();
    const event = await f.createEvent(db, { organizerId: actor.id });
    const [type] = await db.insert(tableTypes).values({ name: "VIP" }).returning();
    const layout: TemplateLayout = {
      ...templateLayout,
      tables: [
        { label: "A", capacity: 4, tableTypeId: type?.id ?? null, x: 0, y: 0, rotation: 0, isLoca: false, ...ATTRS },
        { label: "B", capacity: 4, tableTypeId: crypto.randomUUID(), x: 0, y: 0, rotation: 0, isLoca: false, ...ATTRS },
      ],
    };
    const tpl = await insertTemplate(actor.id, { layoutData: layout });
    const res = await applyVenueTemplate(db, actor, { eventId: event.id, templateId: tpl.id });
    expect(res.tables.find((t) => t.label === "A")?.tableTypeId).toBe(type?.id);
    expect(res.tables.find((t) => t.label === "B")?.tableTypeId).toBeNull();
  });

  it("iptal edilmiş etkinliğe uygulanamaz", async () => {
    const actor = await makeActor();
    const event = await f.createEvent(db, { organizerId: actor.id, status: "cancelled" });
    const tpl = await insertTemplate(actor.id);
    expect((await caught(applyVenueTemplate(db, actor, { eventId: event.id, templateId: tpl.id }))).code).toBe(
      "conflict",
    );
  });
});

describe("saveAsTemplate", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("masaları ve dekoru şablona yazar; başka etkinliğe uygulanınca aynı yerleşim çıkar", async () => {
    const actor = await makeActor();
    const event = await f.createEvent(db, { organizerId: actor.id });
    await saveLayout(db, actor, {
      eventId: event.id,
      tables: [
        { label: "A", capacity: 4, x: 1, y: 2, rotation: 30 },
        { label: "B", capacity: 6, x: 3, y: 4, isLoca: true },
      ],
      decor: { width: 900, height: 600, elements: [{ id: "w", kind: "wall", x: 0, y: 0, width: 10, height: 600 }] },
    });
    const tpl = await saveAsTemplate(db, actor, { eventId: event.id, name: " Salon ", description: "" });
    expect(tpl).toMatchObject({ name: "Salon", description: null, isPublic: false, createdById: actor.id });
    const layout = parseTemplateLayout(tpl.layoutData);
    expect(layout.tables).toHaveLength(2);
    expect(layout.decor.width).toBe(900);

    const target = await f.createEvent(db, { organizerId: actor.id });
    const res = await applyVenueTemplate(db, actor, { eventId: target.id, templateId: tpl.id });
    expect(res.tables.map((t) => [t.label, t.capacity, t.x, t.y, t.rotation, t.isLoca])).toEqual([
      ["A", 4, 1, 2, 30, false],
      ["B", 6, 3, 4, 0, true],
    ]);
  });

  it("olmayan etkinlikten şablon alınamaz", async () => {
    const actor = await makeActor();
    expect((await caught(saveAsTemplate(db, actor, { eventId: crypto.randomUUID(), name: "X" }))).code).toBe("not_found");
  });
});

describe("şablon yönetimi", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("liste: kullanıcı kendi ve herkese açık şablonları görür; admin hepsini", async () => {
    const actor = await makeActor();
    const other = await makeActor();
    await insertTemplate(actor.id, { name: "Benim" });
    await insertTemplate(other.id, { name: "Açık", isPublic: true });
    await insertTemplate(other.id, { name: "Gizli" });
    const mine = await listVenueTemplates(db, actor);
    expect(mine.map((t) => t.name).sort()).toEqual(["Açık", "Benim"]);
    expect(mine.find((t) => t.name === "Benim")).toMatchObject({ canManage: true, tableCount: 3, capacity: 20 });
    expect(mine.find((t) => t.name === "Açık")?.canManage).toBe(false);
    const admin = await makeActor(adminActor());
    expect(await listVenueTemplates(db, admin)).toHaveLength(3);
  });

  it("yalnızca sahibi ya da admin günceller ve siler", async () => {
    const owner = await makeActor();
    const other = await makeActor();
    const tpl = await insertTemplate(owner.id, { isPublic: true });
    expect((await caught(updateVenueTemplate(db, other, { id: tpl.id, name: "X" }))).code).toBe("conflict");
    expect((await caught(deleteVenueTemplate(db, other, { id: tpl.id }))).code).toBe("conflict");
    const updated = await updateVenueTemplate(db, owner, { id: tpl.id, name: "Yeni", isPublic: false });
    expect(updated).toMatchObject({ name: "Yeni", isPublic: false });
    const admin = await makeActor(adminActor());
    await deleteVenueTemplate(db, admin, { id: tpl.id });
    expect(await db.select().from(venueTemplates)).toHaveLength(0);
  });

  it("şablon silinince onu kullanan etkinliğin masaları kalır", async () => {
    const actor = await makeActor();
    const event = await f.createEvent(db, { organizerId: actor.id });
    const tpl = await insertTemplate(actor.id);
    await applyVenueTemplate(db, actor, { eventId: event.id, templateId: tpl.id });
    await deleteVenueTemplate(db, actor, { id: tpl.id });
    expect(await listEventTables(db, event.id)).toHaveLength(3);
    const [ev] = await db.select().from(events).where(eq(events.id, event.id));
    expect(ev?.venueTemplateId).toBeNull();
  });

  it("görülebilen şablonu özel kopya olarak çoğaltır", async () => {
    const actor = await makeActor();
    const other = await makeActor();
    const tpl = await insertTemplate(other.id, { isPublic: true });
    const copy = await duplicateVenueTemplate(db, actor, { id: tpl.id });
    expect(copy).toMatchObject({ name: "Salon A (Kopya)", isPublic: false, createdById: actor.id });
    const hidden = await insertTemplate(other.id);
    expect((await caught(duplicateVenueTemplate(db, actor, { id: hidden.id }))).code).toBe("not_found");
  });
});

describe("şablon: masa nitelikleri", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("şablona kaydedilir ve başka etkinliğe uygulanınca korunur", async () => {
    const actor = await makeActor();
    const event = await f.createEvent(db, { organizerId: actor.id });
    await saveLayout(db, actor, {
      eventId: event.id,
      tables: [{ label: "V1", capacity: 4, x: 1, y: 2, isVip: true, isPinned: true, size: 70, floor: 3, sortNumber: 5 }],
      decor: { width: 900, height: 600, elements: [] },
    });
    const tpl = await saveAsTemplate(db, actor, { eventId: event.id, name: "Nitelikli" });
    expect(parseTemplateLayout(tpl.layoutData).tables[0]).toMatchObject({ isVip: true, isPinned: true, size: 70, floor: 3, sortNumber: 5 });
    const target = await f.createEvent(db, { organizerId: actor.id });
    const res = await applyVenueTemplate(db, actor, { eventId: target.id, templateId: tpl.id });
    expect(res.tables[0]).toMatchObject({ label: "V1", isVip: true, isPinned: true, size: 70, floor: 3, sortNumber: 5 });
  });

  it("yeni alanları olmayan v1 şablon okunur ve varsayılanlarla uygulanır", async () => {
    const actor = await makeActor();
    const event = await f.createEvent(db, { organizerId: actor.id });
    const oldV1 = {
      version: 1,
      tables: [{ label: "E1", capacity: 6, tableTypeId: null, x: 10, y: 20, rotation: 0, isLoca: false }],
      decor: { width: 1200, height: 800, elements: [] },
    };
    expect(parseTemplateLayout(oldV1).tables[0]).toMatchObject({ isVip: false, isPinned: false, size: null, floor: 1, sortNumber: null, x: 10, y: 20 });
    const [tpl] = await db.insert(venueTemplates).values({ name: "Eski v1", layoutData: oldV1, createdById: actor.id }).returning();
    const res = await applyVenueTemplate(db, actor, { eventId: event.id, templateId: tpl?.id ?? "" });
    expect(res.tables[0]).toMatchObject({ label: "E1", isVip: false, isPinned: false, size: null, floor: 1, sortNumber: null });
  });

  it("kullanımdaki masa şablon uygulanınca niteliklerini korur", async () => {
    const actor = await makeActor();
    const event = await f.createEvent(db, { organizerId: actor.id });
    const saved = await saveLayout(db, actor, {
      eventId: event.id,
      tables: [{ label: "K1", capacity: 4, x: 5, y: 5, isVip: true, floor: 2, size: 48 }],
      decor: { width: 900, height: 600, elements: [] },
    });
    const table = saved.tables[0];
    if (!table) throw new Error("masa yok");
    const customer = await f.createCustomer(db);
    await setAllocation(db, [table.id], "casino");
    await f.createReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
    const tpl = await insertTemplate(actor.id);
    const res = await applyVenueTemplate(db, actor, { eventId: event.id, templateId: tpl.id });
    expect(res.tables.find((t) => t.label === "K1")).toMatchObject({ isVip: true, floor: 2, size: 48 });
  });
});

describe("parseTemplateLayout", () => {
  it("eski biçim: VIP, sabit (isLocked), boyut, kat, sayısal masa numarası ve merkez koordinatı", () => {
    const layout = parseTemplateLayout({
      placedTables: [
        { id: "a", tableNumber: 7, capacity: 8, x: 100, y: 200, size: 60, isVip: true, isLocked: true, floor: 3 },
        { id: "b", tableNumber: "12", capacity: 8, x: 100, y: 200 },
        { id: "c", tableNumber: "A-1", capacity: 8, x: 0, y: 0, floor: 99, size: "x" },
        { id: "d", tableNumber: 4, capacity: 8, x: 0, y: 0, floor: 5.5 },
      ],
    });
    const [a, b, c, d] = layout.tables;
    expect(a).toMatchObject({ x: 130, y: 230, size: 60, isVip: true, isPinned: true, floor: 3, sortNumber: 7 });
    expect(b).toMatchObject({ x: 120, y: 220, size: null, isVip: false, isPinned: false, floor: 1, sortNumber: 12 });
    expect(c).toMatchObject({ x: 20, y: 20, size: null, floor: 9, sortNumber: null });
    expect(d).toMatchObject({ floor: 6, sortNumber: 4 });
  });

  it("eski placedTables/stageElements biçimini dönüştürür", () => {
    const layout = parseTemplateLayout({
      placedTables: [
        { id: "t1", tableNumber: 1, capacity: 8, x: 10, y: 20, isLoca: false },
        { id: "t2", tableNumber: 1, capacity: 0, x: 30, y: 40 },
        { id: "l1", tableNumber: 3, locaName: "L1", capacity: 12, x: 50, y: 60, isLoca: true },
        { broken: true },
      ],
      stageElements: [{ id: "st", type: "stage", x: 0, y: 0, width: 200, height: 50, label: "Sahne" }],
      dimensions: { width: 1040, height: 960 },
    });
    expect(layout.tables.map((t) => [t.label, t.capacity, t.isLoca])).toEqual([
      ["1", 8, false],
      ["M2", 1, false],
      ["L1", 12, true],
    ]);
    expect(layout.decor).toMatchObject({ width: 1040, height: 960, elements: [{ kind: "stage", label: "Sahne" }] });
  });

  it("tanınmayan biçim boş yerleşim döner", () => {
    expect(parseTemplateLayout({ foo: 1 }).tables).toEqual([]);
    expect(parseTemplateLayout(null).decor.elements).toEqual([]);
  });
});
