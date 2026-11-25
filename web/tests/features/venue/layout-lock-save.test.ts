import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { venueTemplates } from "@/db/schema";
import { listEventTables } from "@/features/events/service";
import type { TableInput } from "@/features/venue/schemas";
import { applyVenueTemplate, getVenueLayout, saveLayout, type EventTableRow } from "@/features/venue/service";
import { DomainError } from "@/lib/action";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import * as f from "../../helpers/factories";
import { setStage } from "../../helpers/planning";

const decor = { width: 1600, height: 900, elements: [] };

async function caught(promise: Promise<unknown>): Promise<DomainError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  return err as DomainError;
}

function toInput(t: EventTableRow): TableInput {
  return {
    id: t.id,
    label: t.label,
    capacity: t.capacity,
    tableTypeId: t.tableTypeId,
    x: t.x,
    y: t.y,
    rotation: t.rotation,
    isLoca: t.isLoca,
    isVip: t.isVip,
    isPinned: t.isPinned,
    size: t.size,
    floor: t.floor,
    sortNumber: t.sortNumber,
  };
}

/** A1 (6 kişilik onaylı rezervasyon) ve B1 (taahhütsüz). */
async function setup() {
  const actor = await persistActor(db, managerActor("fnb"));
  const event = await f.createEvent(db, { organizerId: actor.id });
  const saved = await saveLayout(db, actor, {
    eventId: event.id,
    tables: [
      { label: "A1", capacity: 8, x: 100, y: 100 },
      { label: "B1", capacity: 8, x: 200, y: 100 },
    ],
    decor,
  });
  const a1 = saved.tables.find((t) => t.label === "A1");
  const b1 = saved.tables.find((t) => t.label === "B1");
  if (!a1 || !b1) throw new Error("masa yok");
  const customer = await f.createCustomer(db);
  await f.createReservation(db, { eventId: event.id, tableId: a1.id, customerId: customer.id, guestCount: 6 });
  return { actor, event, a1, b1 };
}

describe("yerleşim kilidi (saveLayout / applyVenueTemplate / getVenueLayout)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("satıştayken rezerve masayı taşıma reddedilir; hiçbir değişiklik yazılmaz", async () => {
    const { actor, event, a1, b1 } = await setup();
    await setStage(db, event.id, "on_sale");

    const err = await caught(
      saveLayout(db, actor, {
        eventId: event.id,
        tables: [toInput({ ...a1, x: a1.x + 40 }), toInput({ ...b1, x: b1.x + 40 })],
        decor,
      }),
    );

    expect(err.code).toBe("conflict");
    expect(err.message).toBe(
      "Satış başladı; bileti satılmış, rezervasyonu yapılmış ya da Casino'ya ayrılmış masalar değiştirilemez: A1. Hiçbir değişiklik kaydedilmedi.",
    );
    const after = await listEventTables(db, event.id);
    expect(after.find((t) => t.id === a1.id)?.x).toBe(a1.x);
    expect(after.find((t) => t.id === b1.id)?.x).toBe(b1.x);
  });

  it("satıştayken taahhütsüz masa taşınır ve silinir", async () => {
    const { actor, event, a1, b1 } = await setup();
    await setStage(db, event.id, "on_sale");

    const moved = await saveLayout(db, actor, {
      eventId: event.id,
      tables: [toInput(a1), toInput({ ...b1, x: b1.x + 40 })],
      decor,
    });
    expect(moved.tables.find((t) => t.id === b1.id)?.x).toBe(b1.x + 40);

    const removed = await saveLayout(db, actor, { eventId: event.id, tables: [toInput(a1)], decor });
    expect(removed.tables.map((t) => t.label)).toEqual(["A1"]);
  });

  it("fiyatlandı aşamasında rezerve masa taşınabilir", async () => {
    const { actor, event, a1, b1 } = await setup();
    await setStage(db, event.id, "priced");

    const res = await saveLayout(db, actor, {
      eventId: event.id,
      tables: [toInput({ ...a1, x: a1.x + 40 }), toInput(b1)],
      decor,
    });
    expect(res.tables.find((t) => t.id === a1.id)?.x).toBe(a1.x + 40);
  });

  it("satıştayken rezerve masanın sabitlemesi değiştirilebilir", async () => {
    const { actor, event, a1, b1 } = await setup();
    await setStage(db, event.id, "on_sale");

    const res = await saveLayout(db, actor, {
      eventId: event.id,
      tables: [toInput({ ...a1, isPinned: true }), toInput(b1)],
      decor,
    });
    expect(res.tables.find((t) => t.id === a1.id)?.isPinned).toBe(true);
  });

  it("satış kapalıyken de kilit sürer", async () => {
    const { actor, event, a1, b1 } = await setup();
    await setStage(db, event.id, "sales_closed");

    const err = await caught(
      saveLayout(db, actor, {
        eventId: event.id,
        tables: [toInput({ ...a1, label: "A9" }), toInput(b1)],
        decor,
      }),
    );
    expect(err.code).toBe("conflict");
    expect(err.message).toContain("değiştirilemez: A1.");
    const after = await listEventTables(db, event.id);
    expect(after.map((t) => t.label)).toEqual(["A1", "B1"]);
  });

  it("satıştayken şablon uygulanamaz", async () => {
    const { actor, event } = await setup();
    await setStage(db, event.id, "on_sale");
    const [template] = await db
      .insert(venueTemplates)
      .values({
        name: "Salon A",
        layoutData: { version: 1, tables: [], decor },
        createdById: actor.id,
      })
      .returning();
    if (!template) throw new Error("şablon yok");

    const err = await caught(applyVenueTemplate(db, actor, { eventId: event.id, templateId: template.id }));
    expect(err.code).toBe("conflict");
    expect(err.message).toBe("Satış başladıktan sonra şablon uygulanamaz");
  });

  it("getVenueLayout kilit bilgisini döner", async () => {
    const { actor, event, a1 } = await setup();

    await setStage(db, event.id, "on_sale");
    const locked = await getVenueLayout(db, actor, event.id);
    expect(locked.layoutLocked).toBe(true);
    expect(locked.frozenTableIds).toEqual([a1.id]);

    await setStage(db, event.id, "priced");
    const open = await getVenueLayout(db, actor, event.id);
    expect(open.layoutLocked).toBe(false);
    expect(open.frozenTableIds).toEqual([]);
  });
});
