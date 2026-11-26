import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { orders, tickets } from "@/db/schema";
import { DomainError } from "@/lib/action";
import {
  createHold,
  createHoldWithOutcome,
  getOrderView,
  SalesError,
} from "@/features/ticketing/orders-service";
import { SALES_ACTOR } from "@/features/ticketing/internal";
import { truncateAll } from "../../helpers/db";
import { createTable } from "../../helpers/factories";
import { setStage } from "../../helpers/planning";
import { setFinalPrices } from "../../helpers/seating";
import { createPendingHold } from "../../helpers/ticketing";
import { watchEvents } from "../realtime/emitted";
import { activeTickets, caughtSales, saleEvent } from "./fixtures";

const key = () => randomUUID();

async function rowCounts() {
  return { orders: (await db.select().from(orders)).length, tickets: (await db.select().from(tickets)).length };
}

describe("tutma çekirdeği", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("satış aktörü hiçbir izni olmayan sabit kimliktir", () => {
    expect(SALES_ACTOR).toEqual({
      id: "00000000-0000-0000-0000-000000000000",
      username: "sales-api",
      role: "user",
      staffId: null,
      memberships: [],
      permissions: [],
    });
  });

  it("tutma: bekleyen sipariş, anlık fiyat, tam toplam, süre ayardan", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ settings: { holdMinutes: 7 } });
    const before = Date.now();
    const order = await createHold(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 3 }],
      clientKey: key(),
    });
    expect(order).toMatchObject({
      eventId: event.id,
      eventName: event.name,
      startsAt: event.startsAt.toISOString(),
      status: "pending",
      currency: "TRY",
      total: "4500.00",
      isDemo: false,
      pnr: null,
      tickets: [],
      items: [{ tableId: a1!.id, tableLabel: "A1", category: "standard", quantity: 3, unitPrice: "1500.00" }],
    });
    const ttl = new Date(order.holdExpiresAt).getTime() - before;
    expect(ttl).toBeGreaterThan(7 * 60_000 - 5_000);
    expect(ttl).toBeLessThan(7 * 60_000 + 5_000);
    const held = await activeTickets(a1!.id);
    expect(held).toHaveLength(3);
    expect(new Set(held.map((t) => t.seatSlotId)).size).toBe(3);
    expect(held.every((t) => t.status === "held" && t.qrToken === null && t.unitPrice === "1500.00")).toBe(true);
    expect(held.every((t) => t.eventId === event.id && t.orderId === order.orderId)).toBe(true);
  });

  it("iki masalı sipariş: kalemler etikete göre, toplam kuruşu kuruşuna", async () => {
    const {
      event,
      tables: [b1, a1],
    } = await saleEvent({
      tables: [
        { label: "B1", category: "vip" },
        { label: "A1", category: "standard" },
      ],
      prices: { standard: "1500.00", vip: "4000.50" },
    });
    const order = await createHold(db, {
      eventId: event.id,
      items: [
        { tableId: b1!.id, quantity: 1 },
        { tableId: a1!.id, quantity: 2 },
      ],
      clientKey: key(),
    });
    expect(order.total).toBe("7000.50");
    expect(order.items).toEqual([
      { tableId: a1!.id, tableLabel: "A1", category: "standard", quantity: 2, unitPrice: "1500.00" },
      { tableId: b1!.id, tableLabel: "B1", category: "vip", quantity: 1, unitPrice: "4000.50" },
    ]);
  });

  it("aynı masa iki kalemde gelirse adetler birleşir", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const order = await createHold(db, {
      eventId: event.id,
      items: [
        { tableId: a1!.id, quantity: 2 },
        { tableId: a1!.id, quantity: 1 },
      ],
      clientKey: key(),
    });
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ tableId: a1!.id, quantity: 3 });
    expect(order.total).toBe("4500.00");
    expect(await activeTickets(a1!.id)).toHaveLength(3);
  });

  it("fiyat sonradan değişse de tutulan siparişin birim fiyatı ve toplamı değişmez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const order = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 3 }] });
    await setFinalPrices(db, event.id, { standard: "9999.00" });
    const view = await getOrderView(db, order.orderId);
    expect(view?.total).toBe("4500.00");
    expect(view?.items[0]?.unitPrice).toBe("1500.00");
    const fresh = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 1 }] });
    expect(fresh.total).toBe("9999.00");
    expect(fresh.items[0]?.unitPrice).toBe("9999.00");
  });

  it("aynı clientKey aynı siparişi döndürür ve yeni bilet üretmez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const input = { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }], clientKey: key() };
    const first = await createHoldWithOutcome(db, input);
    const again = await createHoldWithOutcome(db, { ...input, items: [{ tableId: a1!.id, quantity: 5 }] });
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.order.orderId).toBe(first.order.orderId);
    expect(await activeTickets(a1!.id)).toHaveLength(2);
  });

  it("clientKey başka etkinliğin siparişine aitse invalid; sipariş sızmaz", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const other = await saleEvent();
    const clientKey = key();
    await createHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 1 }], clientKey });
    const err = await caughtSales(
      createHold(db, { eventId: other.event.id, items: [{ tableId: other.tables[0]!.id, quantity: 1 }], clientKey }),
    );
    expect(err.salesCode).toBe("invalid");
    expect(await activeTickets(other.tables[0]!.id)).toHaveLength(0);
  });

  it("satış kapandıktan sonra aynı anahtarla yineleme sales_closed değil aynı siparişi döner", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const input = { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }], clientKey: key() };
    const first = await createHoldWithOutcome(db, input);
    await setStage(db, event.id, "sales_closed");
    const again = await createHoldWithOutcome(db, input);
    expect(again.created).toBe(false);
    expect(again.order.orderId).toBe(first.order.orderId);
    const fresh = await caughtSales(createHold(db, { ...input, clientKey: key() }));
    expect(fresh.salesCode).toBe("sales_closed");
  });

  it("online olmayan ya da başka etkinliğin masası satılamaz", async () => {
    const { event } = await saleEvent();
    const { tables: [foreign] } = await saleEvent();
    const casino = await createTable(db, event.id, { label: "C1", allocation: "casino" });
    const pending = await createTable(db, event.id, { label: "P1", allocation: "pending" });
    const closed = await createTable(db, event.id, { label: "K1", allocation: "closed" });
    const before = await rowCounts();
    for (const tableId of [casino.id, pending.id, closed.id, foreign!.id, randomUUID()]) {
      const err = await caughtSales(createHold(db, { eventId: event.id, items: [{ tableId, quantity: 1 }], clientKey: key() }));
      expect(err.salesCode).toBe("table_not_sellable");
      expect(err.code).toBe("conflict");
      expect(err.details).toEqual({ tableId });
    }
    expect(await rowCounts()).toEqual(before);
    expect(before).toEqual({ orders: 0, tickets: 0 });
  });

  it("yeterli boş yuva yoksa seats_unavailable ve kalan sayı", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 6 }] });
    const err = await caughtSales(
      createHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 3 }], clientKey: key() }),
    );
    expect(err.salesCode).toBe("seats_unavailable");
    expect(err.details).toEqual({ tableId: a1!.id, free: 2 });
    expect(err.message).toBe("Seçilen masada yeterli boş sandalye yok");
    expect(await activeTickets(a1!.id)).toHaveLength(6);
  });

  it("kategorinin kesin fiyatı yoksa price_missing", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ prices: {} });
    const err = await caughtSales(
      createHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 1 }], clientKey: key() }),
    );
    expect(err.salesCode).toBe("price_missing");
    expect(await rowCounts()).toEqual({ orders: 0, tickets: 0 });
  });

  it("çok kalemli siparişte ikinci kalem başarısızsa hiçbir şey yazılmaz", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const casino = await createTable(db, event.id, { label: "C1", allocation: "casino" });
    const err = await caughtSales(
      createHold(db, {
        eventId: event.id,
        items: [
          { tableId: a1!.id, quantity: 2 },
          { tableId: casino.id, quantity: 1 },
        ],
        clientKey: key(),
      }),
    );
    expect(err.salesCode).toBe("table_not_sellable");
    expect(await rowCounts()).toEqual({ orders: 0, tickets: 0 });
  });

  it("olmayan etkinlik event_not_found; satışta olmayan etkinlik sales_closed", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const items = [{ tableId: a1!.id, quantity: 1 }];

    const missing = await caughtSales(createHold(db, { eventId: randomUUID(), items, clientKey: key() }));
    expect(missing.salesCode).toBe("event_not_found");
    expect(missing.code).toBe("not_found");
    expect(missing).toBeInstanceOf(DomainError);

    const noProvider = await caughtSales(
      createHold(db, { eventId: event.id, items, clientKey: key() }, { provider: null }),
    );
    expect(noProvider.salesCode).toBe("sales_closed");
    expect(noProvider.code).toBe("conflict");

    await setStage(db, event.id, "sales_closed");
    const closed = await caughtSales(createHold(db, { eventId: event.id, items, clientKey: key() }));
    expect(closed.salesCode).toBe("sales_closed");

    await setStage(db, event.id, "priced");
    const hidden = await caughtSales(createHold(db, { eventId: event.id, items, clientKey: key() }));
    expect(hidden.salesCode).toBe("event_not_found");
    expect(await rowCounts()).toEqual({ orders: 0, tickets: 0 });
  });

  it("tutma seats.changed yayar, masa kimliğiyle", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const watcher = await watchEvents(event.id);
    try {
      await watcher.discardSetup();
      await createHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 1 }], clientKey: key() });
      await watcher.settled();
      expect(watcher.events()).toContainEqual({ type: "seats.changed", id: a1!.id });
    } finally {
      watcher.stop();
    }
  });

  it("getOrderView olmayan sipariş için null", async () => {
    expect(await getOrderView(db, randomUUID())).toBeNull();
  });

  it("SalesError mesajı varsayılan olarak sözleşmeden gelir; invalid kodu invalid'dir", () => {
    expect(new SalesError("order_not_found").code).toBe("not_found");
    expect(new SalesError("invalid").code).toBe("invalid");
    expect(new SalesError("hold_expired").code).toBe("conflict");
    expect(new SalesError("price_missing").message).toBe("Bu masanın fiyatı henüz belirlenmedi");
    expect(new SalesError("price_missing", undefined, "özel").message).toBe("özel");
  });
});
