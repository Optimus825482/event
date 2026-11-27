import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { orders, tickets } from "@/db/schema";
import { getSeatOccupancy } from "@/features/ticketing/occupancy";
import {
  createHold,
  expireStaleHolds,
  getOrderView,
  releaseHold,
  SalesError,
  sweepExpiredHolds,
} from "@/features/ticketing/orders-service";
import { truncateAll } from "../../helpers/db";
import { createPendingHold, expireOrder } from "../../helpers/ticketing";
import { watchEvents } from "../realtime/emitted";
import { activeTickets, caughtSales, saleEvent, salesCodes, settle } from "./fixtures";

// Eşzamanlı testlerden önce havuz ısıtılır: soğuk havuzda bağlantılar sırayla açıldığından işlemler
// örtüşmez ve test kilitsiz/atomiksiz kodu da yeşil gösterebilir.
async function warmPool(): Promise<void> {
  await Promise.all(Array.from({ length: 16 }, () => db.execute(sql`select pg_sleep(0.05)`)));
}

async function orderRow(orderId: string) {
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
  return row;
}

async function ticketsOf(orderId: string) {
  return db.select().from(tickets).where(eq(tickets.orderId, orderId));
}

const twoTables = () =>
  saleEvent({ tables: [{ label: "A1" }, { label: "B1" }], settings: { blockSingleLeftover: false } });

describe("tutma süresi dolumu, bırakma ve doluluk", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("süresi dolan tutma yeni tutmayı engellemez; eski sipariş ve biletleri expired olur", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const old = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 8 }] });
    await expireOrder(db, old.orderId);
    const fresh = await createHold(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 8 }],
      clientKey: randomUUID(),
    });
    expect(fresh.status).toBe("pending");
    expect(await activeTickets(a1!.id)).toHaveLength(8);
    const oldTickets = await ticketsOf(old.orderId);
    expect(oldTickets).toHaveLength(8);
    expect(oldTickets.every((t) => t.status === "expired" && t.seatSlotId === null)).toBe(true);
    expect((await orderRow(old.orderId))?.status).toBe("expired");
  });

  it("süpürülmemiş olsa da süresi dolan sipariş 'expired' okunur ve doluluğa sayılmaz", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ settings: { blockSingleLeftover: false } });
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 3 }] });
    await expireOrder(db, hold.orderId);
    const view = await getOrderView(db, hold.orderId);
    expect(view?.status).toBe("expired");
    expect((await orderRow(hold.orderId))?.status).toBe("pending");
    expect((await getSeatOccupancy(db, event.id)).get(a1!.id)).toBeUndefined();
  });

  it("doluluk: tutulan ve satılan ayrı sayılır, boş masa haritada yoktur", async () => {
    const {
      event,
      tables: [a1, b1],
    } = await twoTables();
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 3 }] });
    let occupancy = await getSeatOccupancy(db, event.id);
    expect(occupancy).toEqual(new Map([[a1!.id, { held: 3, issued: 0 }]]));
    expect(occupancy.has(b1!.id)).toBe(false);

    // İki bileti `issued` yap (ödeme akışı sonraki görevde): sayılar ayrışır.
    const [first, second] = await ticketsOf(hold.orderId);
    await db.execute(
      sql`update tickets set status = 'issued', qr_token = ${"qr-" + randomUUID()} where id = ${first!.id}`,
    );
    await db.execute(
      sql`update tickets set status = 'issued', qr_token = ${"qr-" + randomUUID()} where id = ${second!.id}`,
    );
    occupancy = await getSeatOccupancy(db, event.id);
    expect(occupancy).toEqual(new Map([[a1!.id, { held: 1, issued: 2 }]]));
  });

  it("doluluk yalnızca verilen etkinliğin masalarını döner", async () => {
    const one = await saleEvent({ settings: { blockSingleLeftover: false } });
    const two = await saleEvent({ settings: { blockSingleLeftover: false } });
    await createPendingHold(db, { eventId: one.event.id, items: [{ tableId: one.tables[0]!.id, quantity: 2 }] });
    await createPendingHold(db, { eventId: two.event.id, items: [{ tableId: two.tables[0]!.id, quantity: 4 }] });
    expect(await getSeatOccupancy(db, one.event.id)).toEqual(new Map([[one.tables[0]!.id, { held: 2, issued: 0 }]]));
  });

  it("expireStaleHolds kapsamı: yalnızca verilen masalara dokunan siparişler", async () => {
    const {
      event,
      tables: [a1, b1],
    } = await twoTables();
    const onA = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    const onB = await createPendingHold(db, { eventId: event.id, items: [{ tableId: b1!.id, quantity: 2 }] });
    await expireOrder(db, onA.orderId);
    await expireOrder(db, onB.orderId);
    expect(await expireStaleHolds(db, { eventId: event.id, tableIds: [a1!.id] })).toBe(1);
    expect((await orderRow(onA.orderId))?.status).toBe("expired");
    expect((await orderRow(onB.orderId))?.status).toBe("pending");
    expect(await activeTickets(b1!.id)).toHaveLength(2);
  });

  it("expireStaleHolds etkinlik kapsamı başka etkinliğe dokunmaz; kapsamsız çağrı hepsini süpürür", async () => {
    const one = await saleEvent({ settings: { blockSingleLeftover: false } });
    const two = await saleEvent({ settings: { blockSingleLeftover: false } });
    const h1 = await createPendingHold(db, { eventId: one.event.id, items: [{ tableId: one.tables[0]!.id, quantity: 2 }] });
    const h2 = await createPendingHold(db, { eventId: two.event.id, items: [{ tableId: two.tables[0]!.id, quantity: 2 }] });
    await expireOrder(db, h1.orderId);
    await expireOrder(db, h2.orderId);
    expect(await expireStaleHolds(db, { eventId: one.event.id })).toBe(1);
    expect((await orderRow(h2.orderId))?.status).toBe("pending");
    expect(await expireStaleHolds(db)).toBe(1);
    expect((await orderRow(h2.orderId))?.status).toBe("expired");
    expect(await expireStaleHolds(db)).toBe(0);
  });

  it("iki masaya yayılan süresi dolmuş sipariş bütünüyle süpürülür", async () => {
    const {
      event,
      tables: [a1, b1],
    } = await twoTables();
    const hold = await createPendingHold(db, {
      eventId: event.id,
      items: [
        { tableId: a1!.id, quantity: 2 },
        { tableId: b1!.id, quantity: 2 },
      ],
    });
    await expireOrder(db, hold.orderId);
    const watcher = await watchEvents(event.id);
    try {
      await watcher.discardSetup();
      expect(await expireStaleHolds(db, { eventId: event.id, tableIds: [a1!.id] })).toBe(1);
      const all = await ticketsOf(hold.orderId);
      expect(all).toHaveLength(4);
      expect(all.every((t) => t.status === "expired" && t.seatSlotId === null)).toBe(true);
      expect(await activeTickets(b1!.id)).toHaveLength(0);
      await watcher.settled();
      expect(watcher.events()).toContainEqual({ type: "seats.changed", id: a1!.id });
      expect(watcher.events()).toContainEqual({ type: "seats.changed", id: b1!.id });
    } finally {
      watcher.stop();
    }
  });

  it("süresi dolmamış tutma süpürülmez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ settings: { blockSingleLeftover: false } });
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 3 }] });
    expect(await expireStaleHolds(db)).toBe(0);
    expect(await activeTickets(a1!.id)).toHaveLength(3);
    expect((await orderRow(hold.orderId))?.status).toBe("pending");
  });

  it("bırakma: yuvalar hemen boşalır, sipariş expired, seats.changed yayılır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 8 }] });
    const watcher = await watchEvents(event.id);
    try {
      await watcher.discardSetup();
      await releaseHold(db, hold.orderId);
      expect(await activeTickets(a1!.id)).toHaveLength(0);
      expect((await ticketsOf(hold.orderId)).every((t) => t.status === "expired" && t.seatSlotId === null)).toBe(true);
      expect((await orderRow(hold.orderId))?.status).toBe("expired");
      expect((await getOrderView(db, hold.orderId))?.status).toBe("expired");
      await watcher.settled();
      expect(watcher.events()).toContainEqual({ type: "seats.changed", id: a1!.id });
    } finally {
      watcher.stop();
    }
    const fresh = await createHold(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 8 }],
      clientKey: randomUUID(),
    });
    expect(fresh.status).toBe("pending");
  });

  it("bırakma idempotenttir; olmayan sipariş order_not_found", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ settings: { blockSingleLeftover: false } });
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    await releaseHold(db, hold.orderId);
    await expect(releaseHold(db, hold.orderId)).resolves.toBeUndefined();
    expect((await orderRow(hold.orderId))?.status).toBe("expired");
    expect((await caughtSales(releaseHold(db, randomUUID()))).salesCode).toBe("order_not_found");
  });

  it("ödenmiş sipariş bırakılamaz: already_paid, biletler etkin kalır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ settings: { blockSingleLeftover: false } });
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    // Ödeme akışı sonraki görevde: satırı doğrudan `paid` yap.
    await db.execute(sql`update tickets set status = 'issued', qr_token = 'qr-' || id::text where order_id = ${hold.orderId}`);
    await db.execute(
      sql`update orders set status = 'paid', pnr = ${"P" + randomUUID().slice(0, 8)}, paid_at = now(), buyer_last_name_key = 'x',
        buyer_email = 'x@example.com', terms_accepted_at = now(), payment_provider = 'demo' where id = ${hold.orderId}`,
    );
    expect((await caughtSales(releaseHold(db, hold.orderId))).salesCode).toBe("already_paid");
    expect(await activeTickets(a1!.id)).toHaveLength(2);
  });

  it("süresi dolmuş ama süpürülmemiş tutma bırakılabilir", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent({ settings: { blockSingleLeftover: false } });
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    await expireOrder(db, hold.orderId);
    await releaseHold(db, hold.orderId);
    expect((await orderRow(hold.orderId))?.status).toBe("expired");
    expect(await activeTickets(a1!.id)).toHaveLength(0);
  });
});

describe("süre dolumu ve bırakma eşzamanlılığı", () => {
  beforeEach(async () => {
    await truncateAll();
    await warmPool();
  });

  it("süresi dolmuş tutmanın yerine 5 eşzamanlı bütün-masa tutması: tam 1 başarı", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const old = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 8 }] });
    await expireOrder(db, old.orderId);
    const { ok, failed } = await settle(
      Array.from(
        { length: 5 },
        () => () =>
          createHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 8 }], clientKey: randomUUID() }),
      ),
    );
    expect(ok).toHaveLength(1);
    expect(salesCodes(failed)).toEqual(Array(4).fill("seats_unavailable"));
    const active = await activeTickets(a1!.id);
    expect(active).toHaveLength(8);
    expect(new Set(active.map((t) => t.orderId))).toEqual(new Set([ok[0]!.value.orderId]));
    expect((await orderRow(old.orderId))?.status).toBe("expired");
  });

  it("iki masaya yayılan süresi dolmuş siparişlerin ters sırayla eşzamanlı süpürülmesi kilitlenmez", async () => {
    const {
      event,
      tables: [a1, b1],
    } = await twoTables();
    const both = [
      { tableId: a1!.id, quantity: 1 },
      { tableId: b1!.id, quantity: 1 },
    ];
    const stale = [];
    for (let i = 0; i < 6; i++) stale.push(await createPendingHold(db, { eventId: event.id, items: both }));
    for (const h of stale) await expireOrder(db, h.orderId);
    const { ok, failed } = await settle(
      [a1!, b1!, a1!, b1!, a1!, b1!].map(
        (t) => () =>
          createHold(db, { eventId: event.id, items: [{ tableId: t.id, quantity: 1 }], clientKey: randomUUID() }),
      ),
    );
    expect(failed.map((f) => (f.reason instanceof SalesError ? f.reason.salesCode : String(f.reason)))).toEqual([]);
    expect(ok).toHaveLength(6);
    for (const h of stale) expect((await orderRow(h.orderId))?.status).toBe("expired");
    expect(await activeTickets(a1!.id)).toHaveLength(3);
    expect(await activeTickets(b1!.id)).toHaveLength(3);
  });

  it("farklı kapsamlarla eşzamanlı süpürmeler her siparişi tam bir kez sayar", async () => {
    const {
      event,
      tables: [a1, b1],
    } = await twoTables();
    const both = [
      { tableId: a1!.id, quantity: 1 },
      { tableId: b1!.id, quantity: 1 },
    ];
    const stale = [];
    for (let i = 0; i < 6; i++) stale.push(await createPendingHold(db, { eventId: event.id, items: both }));
    for (const h of stale) await expireOrder(db, h.orderId);
    const { ok, failed } = await settle(
      [[a1!.id], [b1!.id], [b1!.id, a1!.id], undefined, [a1!.id], [b1!.id], [a1!.id], [b1!.id], [a1!.id, b1!.id], undefined, [a1!.id], [b1!.id]].map(
        (tableIds) => () => expireStaleHolds(db, tableIds ? { eventId: event.id, tableIds } : { eventId: event.id }),
      ),
    );
    expect(failed.map((f) => String(f.reason))).toEqual([]);
    expect(ok.reduce((sum, r) => sum + r.value, 0)).toBe(6);
    expect(await activeTickets(a1!.id)).toHaveLength(0);
    expect(await activeTickets(b1!.id)).toHaveLength(0);
  });

  it("açık süpürme işlemi commit edilmeden ikinci süpürme bekler ve aynı siparişi yeniden saymaz", async () => {
    const {
      event,
      tables: [a1, b1],
    } = await twoTables();
    const hold = await createPendingHold(db, {
      eventId: event.id,
      items: [
        { tableId: a1!.id, quantity: 1 },
        { tableId: b1!.id, quantity: 1 },
      ],
    });
    await expireOrder(db, hold.orderId);
    let second: Promise<number> | null = null;
    let secondDone = false;
    await db.transaction(async (tx) => {
      expect(await expireStaleHolds(tx, { eventId: event.id, tableIds: [a1!.id] })).toBe(1);
      second = expireStaleHolds(db, { eventId: event.id, tableIds: [b1!.id] }).finally(() => {
        secondDone = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(secondDone).toBe(false);
    });
    expect(await second).toBe(0);
    expect((await ticketsOf(hold.orderId)).every((t) => t.status === "expired")).toBe(true);
  });

  it("bırakma ile eşzamanlı tutma: etkin bilet sayısı hiçbir anda kapasiteyi aşmaz", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const old = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 8 }] });
    const { ok, failed } = await settle<unknown>([
      () => releaseHold(db, old.orderId),
      ...Array.from(
        { length: 4 },
        () => () =>
          createHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 8 }], clientKey: randomUUID() }),
      ),
    ]);
    // Ham pg hatası yok: her başarısızlık `seats_unavailable`.
    expect(salesCodes(failed).every((c) => c === "seats_unavailable")).toBe(true);
    expect(ok.length + failed.length).toBe(5);
    const active = await activeTickets(a1!.id);
    expect(active.length).toBeLessThanOrEqual(8);
    expect(new Set(active.map((t) => t.orderId)).size).toBeLessThanOrEqual(1);
    expect(active.some((t) => t.orderId === old.orderId)).toBe(false);
    // Bırakmadan sonra başlayan tutma en çok bir tanedir; kazanan varsa masanın tamamını tutar.
    expect(ok.length - 1).toBeLessThanOrEqual(1);
    if (ok.length === 2) expect(active).toHaveLength(8);
  });
  it("kapsamsız süpürme: tüm masalardaki süresi dolan tutmalar expired olur, süresi dolmayan dokunulmaz", async () => {
    const {
      event,
      tables: [a1, b1],
    } = await twoTables();
    const staleA = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    const staleB = await createPendingHold(db, { eventId: event.id, items: [{ tableId: b1!.id, quantity: 2 }] });
    const live = await createPendingHold(db, { eventId: event.id, items: [{ tableId: b1!.id, quantity: 1 }] });
    await expireOrder(db, staleA.orderId);
    await expireOrder(db, staleB.orderId);
    expect(await sweepExpiredHolds(db)).toBe(2);
    expect((await orderRow(staleA.orderId))?.status).toBe("expired");
    expect((await orderRow(staleB.orderId))?.status).toBe("expired");
    expect((await ticketsOf(staleA.orderId)).every((t) => t.status === "expired" && t.seatSlotId === null)).toBe(true);
    expect((await orderRow(live.orderId))?.status).toBe("pending");
    expect(await sweepExpiredHolds(db)).toBe(0);
  });

  it("süpürme sınırlıdır: tek çağrıda en çok `limit` sipariş işlenir", async () => {
    const {
      event,
      tables: [a1],
    } = await twoTables();
    const holds = [];
    for (let i = 0; i < 3; i += 1) {
      holds.push(await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 1 }] }));
    }
    for (const h of holds) await expireOrder(db, h.orderId);
    expect(await sweepExpiredHolds(db, 2)).toBe(2);
    expect(await sweepExpiredHolds(db, 2)).toBe(1);
    expect(await sweepExpiredHolds(db, 2)).toBe(0);
  });

  it("süresi dolmuş (süpürülmemiş) tutmanın sandalyeleri seçilebilir; eski sipariş expired olur", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const old = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2, seatNos: [3, 4] }] });
    await expireOrder(db, old.orderId);
    const fresh = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2, seatNos: [3, 4] }] });
    expect(fresh.orderId).not.toBe(old.orderId);
    expect((await getOrderView(db, old.orderId))?.status).toBe("expired");
    const active = await activeTickets(a1!.id);
    expect(active).toHaveLength(2);
    expect(active.every((t) => t.orderId === fresh.orderId)).toBe(true);
  });

  it("süresi dolmamış tutmanın sandalyesi seçilemez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2, seatNos: [3, 4] }] });
    const err = await caughtSales(
      createHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2, seatNos: [3, 4] }], clientKey: randomUUID() }),
    );
    expect(err.salesCode).toBe("seats_unavailable");
    expect(err.details).toEqual({ tableId: a1!.id, free: 6 });
  });
});
