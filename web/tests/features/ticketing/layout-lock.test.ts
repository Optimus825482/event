import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventTables, tableSeatSlots } from "@/db/schema";
import { listEventTables } from "@/features/events/service";
import { loadCommitments, ticketCommitments } from "@/features/planning/layout-lock";
import { createPaidOrder, createPendingHold, expireOrder } from "../../helpers/ticketing";
import { setStage } from "../../helpers/planning";
import type { TableInput } from "@/features/venue/schemas";
import { saveLayout, type EventTableRow } from "@/features/venue/service";
import { DomainError } from "@/lib/action";
import { managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { saleEvent } from "./fixtures";

const decor = { width: 1600, height: 900, elements: [] };

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

async function caught(promise: Promise<unknown>): Promise<DomainError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  return err as DomainError;
}

async function slotCount(tableId: string): Promise<number> {
  const rows = await db
    .select({ id: tableSeatSlots.id })
    .from(tableSeatSlots)
    .where(eq(tableSeatSlots.tableId, tableId));
  return rows.length;
}

/**
 * A1 ve B1 farklı konumlarda, aşama hâlâ satışta (`on_sale`); F&B yöneticisi yerleşimi kaydeder.
 * Biletleme yalnız satışta çalışır (`saleStateOf` `sales_closed`ta `closed` döner); taahhütler bu
 * yüzden satışta kurulur, yerleşim denemeleri ise satış kapandıktan sonra yapılır.
 */
async function twoTables() {
  const sale = await saleEvent({ tables: [{ label: "A1" }, { label: "B1" }] });
  const [a1, b1] = sale.tables;
  if (!a1 || !b1) throw new Error("masa yok");
  await db.update(eventTables).set({ x: 100, y: 100 }).where(eq(eventTables.id, a1.id));
  await db.update(eventTables).set({ x: 300, y: 100 }).where(eq(eventTables.id, b1.id));
  const tables = await listEventTables(db, sale.event.id);
  const A1 = tables.find((t) => t.id === a1.id);
  const B1 = tables.find((t) => t.id === b1.id);
  if (!A1 || !B1) throw new Error("masa okunamadı");
  const actor = await persistActor(db, managerActor("fnb"));
  return { event: sale.event, a1: A1, b1: B1, actor };
}

describe("yerleşim kilidi: bilet kaynağı", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("bilet kaynağı: tutulan ve satılan biletler masayı taahhütlü yapar, koltuk sayısı toplamdır", async () => {
    const {
      event,
      tables: [a1, b1],
    } = await saleEvent({ tables: [{ label: "A1" }, { label: "B1" }] });
    await createPaidOrder(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 3 }],
    });
    await createPendingHold(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 2 }],
    });
    expect(await ticketCommitments(db, event.id)).toEqual([{ tableId: a1!.id, reason: "ticket", seats: 5 }]);
    const commitments = await loadCommitments(db, event.id);
    expect(commitments.get(a1!.id)).toMatchObject({
      reasons: ["ticket"],
      minCapacity: 5,
    });
    expect(commitments.has(b1!.id)).toBe(false);
  });

  it("süresi dolmuş tutma masayı dondurmaz", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 2 }],
    });
    await expireOrder(db, hold.orderId);
    expect(await ticketCommitments(db, event.id)).toEqual([]);
    expect((await loadCommitments(db, event.id)).has(a1!.id)).toBe(false);
  });

  it("satış kapalıyken biletli (tutulan dahil) masa taşınamaz; biletsiz online masa taşınır", async () => {
    const { event, a1, b1, actor } = await twoTables();
    await createPendingHold(db, {
      eventId: event.id,
      items: [{ tableId: a1.id, quantity: 2 }],
    });
    await setStage(db, event.id, "sales_closed");

    const err = await caught(
      saveLayout(db, actor, {
        eventId: event.id,
        tables: [toInput({ ...a1, x: a1.x + 40 }), toInput(b1)],
        decor,
      }),
    );
    expect(err.code).toBe("conflict");
    expect(err.message).toContain("A1");
    expect((await listEventTables(db, event.id)).find((t) => t.id === a1.id)?.x).toBe(a1.x);

    const moved = await saveLayout(db, actor, {
      eventId: event.id,
      tables: [toInput(a1), toInput({ ...b1, x: b1.x + 40 })],
      decor,
    });
    expect(moved.tables.find((t) => t.id === b1.id)?.x).toBe(b1.x + 40);
  });

  it("satış kapalıyken kapasite etkin bilet sayısının altına inemez", async () => {
    const { event, a1, b1, actor } = await twoTables();
    await createPaidOrder(db, {
      eventId: event.id,
      items: [{ tableId: a1.id, quantity: 3 }],
    });
    await createPendingHold(db, {
      eventId: event.id,
      items: [{ tableId: a1.id, quantity: 2 }],
    });
    await setStage(db, event.id, "sales_closed");

    const err = await caught(
      saveLayout(db, actor, {
        eventId: event.id,
        tables: [toInput({ ...a1, capacity: 4 }), toInput(b1)],
        decor,
      }),
    );
    expect(err.code).toBe("conflict");
    expect(err.message).toContain("A1");
    expect((await listEventTables(db, event.id)).find((t) => t.id === a1.id)?.capacity).toBe(8);
    expect(await slotCount(a1.id)).toBe(8);

    const saved = await saveLayout(db, actor, {
      eventId: event.id,
      tables: [toInput({ ...a1, capacity: 5 }), toInput(b1)],
      decor,
    });
    expect(saved.tables.find((t) => t.id === a1.id)?.capacity).toBe(5);
    expect(await slotCount(a1.id)).toBe(5);
  });
});
