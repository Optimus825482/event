import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { orders, paymentAttempts } from "@/db/schema";
import { createHold, expireStaleHolds, payOrder, type OrderView } from "@/features/ticketing/orders-service";
import type { PaymentProvider } from "@/features/ticketing/payment/provider";
import { truncateAll } from "../../helpers/db";
import { createPendingHold, expireOrder } from "../../helpers/ticketing";
import { activeTickets, saleEvent, salesCodes, settle } from "./fixtures";

// Havuz önceden ısıtılır: soğuk havuzda bağlantılar sırayla açıldığından işlemler örtüşmez ve test
// kilitsiz kodu da yeşil gösterebilir.
async function warmPool(): Promise<void> {
  await Promise.all(Array.from({ length: 16 }, () => db.execute(sql`select pg_sleep(0.05)`)));
}

const buyer = { firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.com" };
const approve = { buyer, acceptTerms: true as const, payment: { provider: "demo" as const, action: "approve" as const } };

describe("ödeme eşzamanlılığı", () => {
  beforeEach(async () => {
    await truncateAll();
    await warmPool();
  });

  it("aynı siparişe 5 eşzamanlı ödeme: tek approved denemesi, tek PNR, sağlayıcı bir kez çağrılır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 4 }] });
    // Gecikmeli sağlayıcı: kilitsiz kodda eşzamanlı çağrıların örtüşme penceresini genişletir.
    const start = vi.fn<PaymentProvider["start"]>(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { outcome: "approved", providerRef: `spy-${randomUUID()}` };
    });
    const provider: PaymentProvider = { id: "demo", isDemo: true, start };
    const onPaid = vi.fn();
    const { ok, failed } = await settle<OrderView>(
      Array.from({ length: 5 }, () => () => payOrder(db, hold.orderId, approve, { provider, onPaid })),
    );
    expect(failed).toHaveLength(0);
    expect(ok).toHaveLength(5);
    expect(new Set(ok.map((r) => r.value.pnr)).size).toBe(1);
    expect(ok[0]!.value.pnr).not.toBeNull();
    expect(await db.select().from(paymentAttempts)).toHaveLength(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledTimes(1);
    const issued = await activeTickets(a1!.id);
    expect(issued).toHaveLength(4);
    expect(issued.every((t) => t.status === "issued")).toBe(true);
  });

  it("süresi dolmuşu ödeme ile aynı yuvaları yeniden tutma yarışı: ikisi birden başarılı olamaz", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const old = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 8 }] });
    await expireOrder(db, old.orderId);
    const { ok, failed } = await settle<OrderView>([
      () => payOrder(db, old.orderId, approve),
      () => createHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 8 }], clientKey: randomUUID() }),
    ]);
    expect(salesCodes(failed)).toEqual(["hold_expired"]);
    expect(ok).toHaveLength(1);
    expect(ok[0]!.value.orderId).not.toBe(old.orderId);
    expect((await activeTickets(a1!.id)).every((t) => t.orderId !== old.orderId)).toBe(true);
    expect(await db.select().from(paymentAttempts)).toHaveLength(0);
  });

  it("süresi dolmamış siparişte ödeme ile süpürme yarışı: ödeme kazanır, biletler issued kalır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 8 }] });
    const { ok, failed } = await settle<unknown>([
      () => payOrder(db, hold.orderId, approve),
      () => expireStaleHolds(db),
    ]);
    expect(failed).toHaveLength(0);
    expect(ok).toHaveLength(2);
    const [row] = await db.select({ status: orders.status }).from(orders);
    expect(row?.status).toBe("paid");
    const issued = await activeTickets(a1!.id);
    expect(issued).toHaveLength(8);
    expect(issued.every((t) => t.status === "issued")).toBe(true);
  });
});
