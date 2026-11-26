import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { orders, tickets } from "@/db/schema";
import { createHold, type HoldItem } from "@/features/ticketing/orders-service";
import { truncateAll } from "../../helpers/db";
import { setSaleSettings } from "../../helpers/seating";
import { activeTickets, caughtSales, saleEvent } from "./fixtures";

const hold = (eventId: string, items: HoldItem[]) => createHold(db, { eventId, items, clientKey: randomUUID() });

async function rowCounts() {
  return { orders: (await db.select().from(orders)).length, tickets: (await db.select().from(tickets)).length };
}

const DAY = 24 * 60 * 60 * 1000;

describe("satış kuralları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("tek kalan sandalye: 8'lik masada 7 reddedilir, 6 ve 8 kabul edilir", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const err = await caughtSales(hold(event.id, [{ tableId: a1!.id, quantity: 7 }]));
    expect(err.salesCode).toBe("leaves_single_seat");
    expect(err.details).toEqual({ tableId: a1!.id });
    expect(await activeTickets(a1!.id)).toHaveLength(0);
    await hold(event.id, [{ tableId: a1!.id, quantity: 6 }]);
    expect((await caughtSales(hold(event.id, [{ tableId: a1!.id, quantity: 1 }]))).salesCode).toBe(
      "leaves_single_seat",
    );
    await hold(event.id, [{ tableId: a1!.id, quantity: 2 }]);
    expect(await activeTickets(a1!.id)).toHaveLength(8);
  });

  it("tek kalan sandalye kuralı kapalıyken 7 alınır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ settings: { blockSingleLeftover: false } });
    await hold(event.id, [{ tableId: a1!.id, quantity: 7 }]);
    expect(await activeTickets(a1!.id)).toHaveLength(7);
  });

  it("masada zaten tek boş sandalye varsa o sandalye alınabilir", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ settings: { blockSingleLeftover: false } });
    await hold(event.id, [{ tableId: a1!.id, quantity: 7 }]);
    await setSaleSettings(db, event.id, { blockSingleLeftover: true });
    await hold(event.id, [{ tableId: a1!.id, quantity: 1 }]);
    expect(await activeTickets(a1!.id)).toHaveLength(8);
  });

  it("paylaşımlı masa kapalıyken kısmi alım whole_table_required; tamamı alınır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ settings: { sharedTables: false } });
    const err = await caughtSales(hold(event.id, [{ tableId: a1!.id, quantity: 3 }]));
    expect(err.salesCode).toBe("whole_table_required");
    expect(err.details).toEqual({ tableId: a1!.id, seats: 8 });
    await hold(event.id, [{ tableId: a1!.id, quantity: 8 }]);
    const second = await caughtSales(hold(event.id, [{ tableId: a1!.id, quantity: 8 }]));
    expect(second.salesCode).toBe("seats_unavailable");
    expect(second.details).toEqual({ tableId: a1!.id, free: 0 });
  });

  it("loca, paylaşımlı masa açık olsa da yalnızca bütün satılır", async () => {
    const {
      event,
      tables: [l1],
    } = await saleEvent({
      tables: [{ isLoca: true, capacity: 6 }],
      settings: { sharedTables: true, locaOnline: true },
    });
    const err = await caughtSales(hold(event.id, [{ tableId: l1!.id, quantity: 2 }]));
    expect(err.salesCode).toBe("whole_table_required");
    expect(err.details).toEqual({ tableId: l1!.id, seats: 6 });
    await hold(event.id, [{ tableId: l1!.id, quantity: 6 }]);
    expect(await activeTickets(l1!.id)).toHaveLength(6);
  });

  it("bütün masa, satılabilir sandalye sayısına göredir (kapasiteye değil)", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ tables: [{ capacity: 8, sellableSeats: 6 }], settings: { sharedTables: false } });
    const err = await caughtSales(hold(event.id, [{ tableId: a1!.id, quantity: 8 }]));
    expect(err.salesCode).toBe("whole_table_required");
    expect(err.details).toEqual({ tableId: a1!.id, seats: 6 });
    await hold(event.id, [{ tableId: a1!.id, quantity: 6 }]);
    expect(await activeTickets(a1!.id)).toHaveLength(6);
  });

  it("bütün satılan masada tek kalan sandalye kuralı devreye girmez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ settings: { sharedTables: false, blockSingleLeftover: true } });
    await hold(event.id, [{ tableId: a1!.id, quantity: 8 }]);
    expect(await activeTickets(a1!.id)).toHaveLength(8);
  });

  it("5'ten fazla masa limit_exceeded; 5 masa kabul", async () => {
    const { event, tables } = await saleEvent({
      tables: Array.from({ length: 6 }, () => ({})),
      settings: { blockSingleLeftover: false },
    });
    const items = tables.map((t) => ({ tableId: t.id, quantity: 1 }));
    const err = await caughtSales(hold(event.id, items));
    expect(err.salesCode).toBe("limit_exceeded");
    expect(err.details).toEqual({ maxTables: 5, maxSeats: 12 });
    const order = await hold(event.id, items.slice(0, 5));
    expect(order.items).toHaveLength(5);
  });

  it("sipariş başına azami adet aşılırsa limit_exceeded", async () => {
    const {
      event,
      tables: [a1, b1],
    } = await saleEvent({
      tables: [{ label: "A1" }, { label: "B1" }],
      settings: { maxSeatsPerOrder: 4 },
    });
    const err = await caughtSales(
      hold(event.id, [
        { tableId: a1!.id, quantity: 3 },
        { tableId: b1!.id, quantity: 2 },
      ]),
    );
    expect(err.salesCode).toBe("limit_exceeded");
    expect(err.details).toEqual({ maxTables: 5, maxSeats: 4 });
    await hold(event.id, [
      { tableId: a1!.id, quantity: 2 },
      { tableId: b1!.id, quantity: 2 },
    ]);
  });

  it("satış penceresi: başlamadıysa ve bittiyse sales_closed", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ settings: { saleStartsAt: new Date(Date.now() + DAY) } });
    const items = [{ tableId: a1!.id, quantity: 2 }];
    expect((await caughtSales(hold(event.id, items))).salesCode).toBe("sales_closed");
    await setSaleSettings(db, event.id, { saleStartsAt: null, saleEndsAt: new Date(Date.now() - DAY) });
    expect((await caughtSales(hold(event.id, items))).salesCode).toBe("sales_closed");
  });

  it("taslak ya da fiyatlandı aşamasındaki etkinlik event_not_found", async () => {
    const draft = await saleEvent({ status: "draft" });
    expect(
      (await caughtSales(hold(draft.event.id, [{ tableId: draft.tables[0]!.id, quantity: 2 }]))).salesCode,
    ).toBe("event_not_found");
    const priced = await saleEvent({ stage: "priced" });
    expect(
      (await caughtSales(hold(priced.event.id, [{ tableId: priced.tables[0]!.id, quantity: 2 }]))).salesCode,
    ).toBe("event_not_found");
  });

  it("ihlal sırası: sınır, masa kurallarından önce gelir", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ settings: { maxSeatsPerOrder: 4, sharedTables: false } });
    const err = await caughtSales(hold(event.id, [{ tableId: a1!.id, quantity: 5 }]));
    expect(err.salesCode).toBe("limit_exceeded");
  });

  it("reddedilen her istekte sipariş ve bilet tablosu değişmez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ settings: { maxSeatsPerOrder: 7 } });
    const before = await rowCounts();
    for (const quantity of [7, 8]) {
      await caughtSales(hold(event.id, [{ tableId: a1!.id, quantity }]));
    }
    const shared = await saleEvent({ settings: { sharedTables: false } });
    await caughtSales(hold(shared.event.id, [{ tableId: shared.tables[0]!.id, quantity: 3 }]));
    expect(await rowCounts()).toEqual(before);
    expect(before).toEqual({ orders: 0, tickets: 0 });
  });
});
