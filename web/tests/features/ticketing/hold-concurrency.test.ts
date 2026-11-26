import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { orders } from "@/db/schema";
import { createHold, SalesError } from "@/features/ticketing/orders-service";
import { pgCodeOf } from "@/lib/pg-error";
import { truncateAll } from "../../helpers/db";
import { activeTickets, saleEvent, salesCodes, settle } from "./fixtures";

// Her çağrı `db` alır: `db.transaction` havuzdan kendi bağlantısını çeker. Havuz önceden ısıtılır: soğuk
// havuzda bağlantılar sırayla açıldığından işlemler örtüşmez ve test kilitsiz kodu da yeşil gösterebilir.
async function warmPool(): Promise<void> {
  await Promise.all(Array.from({ length: 16 }, () => db.execute(sql`select pg_sleep(0.05)`)));
}

describe("tutma eşzamanlılığı", () => {
  beforeEach(async () => {
    await truncateAll();
    await warmPool();
  });

  it("3 boş sandalyeli masaya 12 eşzamanlı tekli tutma: tam 3 başarı, etkin bilet 3, hepsi farklı yuvada", async () => {
    const {
      event,
      tables: [t],
    } = await saleEvent({ tables: [{ capacity: 3 }], settings: { blockSingleLeftover: false } });
    const { ok, failed } = await settle(
      Array.from(
        { length: 12 },
        () => () => createHold(db, { eventId: event.id, items: [{ tableId: t!.id, quantity: 1 }], clientKey: randomUUID() }),
      ),
    );
    expect(ok).toHaveLength(3);
    expect(salesCodes(failed)).toEqual(Array(9).fill("seats_unavailable"));
    const held = await activeTickets(t!.id);
    expect(held).toHaveLength(3);
    expect(new Set(held.map((x) => x.seatSlotId)).size).toBe(3);
    expect(await db.select().from(orders)).toHaveLength(3);
  });

  it("8 sandalyeli masaya 6 eşzamanlı üçlü tutma: tam 2 başarı, 6 bilet; kalan 2 sandalye satılmadı", async () => {
    const {
      event,
      tables: [t],
    } = await saleEvent({ settings: { blockSingleLeftover: false } });
    const { ok, failed } = await settle(
      Array.from(
        { length: 6 },
        () => () => createHold(db, { eventId: event.id, items: [{ tableId: t!.id, quantity: 3 }], clientKey: randomUUID() }),
      ),
    );
    expect(ok).toHaveLength(2);
    expect(salesCodes(failed)).toEqual(Array(4).fill("seats_unavailable"));
    const held = await activeTickets(t!.id);
    expect(held).toHaveLength(6);
    expect(new Set(held.map((x) => x.seatSlotId)).size).toBe(6);
    expect(await db.select().from(orders)).toHaveLength(2);
  });

  it("iki masayı ters sırayla isteyen 6 eşzamanlı tutma kilitlenmez", async () => {
    const {
      event,
      tables: [a, b],
    } = await saleEvent({ tables: [{ label: "A" }, { label: "B" }], settings: { blockSingleLeftover: false } });
    const ab = [
      { tableId: a!.id, quantity: 1 },
      { tableId: b!.id, quantity: 1 },
    ];
    const ba = [...ab].reverse();
    const { ok, failed } = await settle(
      [ab, ab, ab, ba, ba, ba].map(
        (items) => () => createHold(db, { eventId: event.id, items, clientKey: randomUUID() }),
      ),
    );
    expect(failed.map((f) => pgCodeOf(f.reason))).not.toContain("40P01");
    expect(failed.map((f) => (f.reason instanceof SalesError ? f.reason.salesCode : String(f.reason)))).toEqual([]);
    expect(ok).toHaveLength(6);
    expect(await activeTickets(a!.id)).toHaveLength(6);
    expect(await activeTickets(b!.id)).toHaveLength(6);
  });

  it("aynı clientKey ile 5 eşzamanlı istek: tek sipariş, tek bilet kümesi", async () => {
    const {
      event,
      tables: [t],
    } = await saleEvent();
    const input = { eventId: event.id, items: [{ tableId: t!.id, quantity: 2 }], clientKey: randomUUID() };
    const { ok, failed } = await settle(Array.from({ length: 5 }, () => () => createHold(db, input)));
    expect(failed).toEqual([]);
    expect(ok).toHaveLength(5);
    expect(new Set(ok.map((r) => r.value.orderId)).size).toBe(1);
    expect(await db.select().from(orders)).toHaveLength(1);
    expect(await activeTickets(t!.id)).toHaveLength(2);
  });

  it("aynı clientKey, masada yalnızca istenen kadar yer varken de yinelenen istek aynı siparişi döndürür", async () => {
    const {
      event,
      tables: [t],
    } = await saleEvent({ tables: [{ capacity: 2 }], settings: { blockSingleLeftover: false } });
    const input = { eventId: event.id, items: [{ tableId: t!.id, quantity: 2 }], clientKey: randomUUID() };
    const { ok, failed } = await settle(Array.from({ length: 5 }, () => () => createHold(db, input)));
    expect(failed).toEqual([]);
    expect(new Set(ok.map((r) => r.value.orderId)).size).toBe(1);
    expect(await activeTickets(t!.id)).toHaveLength(2);
  });
});
