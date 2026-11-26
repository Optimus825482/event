import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { orders, paymentAttempts } from "@/db/schema";
import { verifyQrToken } from "@/features/reservations/qr-token";
import { getOrderView, payOrder, releaseHold } from "@/features/ticketing/orders-service";
import type { PaymentProvider } from "@/features/ticketing/payment/provider";
import { truncateAll } from "../../helpers/db";
import { setFinalPrices } from "../../helpers/seating";
import { createPaidOrder, createPendingHold, expireOrder } from "../../helpers/ticketing";
import { watchEvents } from "../realtime/emitted";
import { activeTickets, caughtSales, saleEvent } from "./fixtures";

const buyer = { firstName: "Ayşe", lastName: "Yılmaz", email: " Ayse@Example.com " };
const approve = { buyer, acceptTerms: true as const, payment: { provider: "demo" as const, action: "approve" as const } };
const decline = { ...approve, payment: { provider: "demo" as const, action: "decline" as const } };

function spyProvider(over: Partial<PaymentProvider> = {}) {
  const start = vi.fn<PaymentProvider["start"]>(async () => ({ outcome: "approved", providerRef: `spy-${randomUUID()}` }));
  const provider: PaymentProvider = { id: "demo", isDemo: true, start, ...over };
  return { provider, start };
}

describe("ödeme", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("onay: sipariş paid, biletler issued, PNR ve kişi başı imzalı QR; demo işaretli", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 3 }] });
    const paid = await payOrder(db, hold.orderId, approve);
    expect(paid).toMatchObject({ orderId: hold.orderId, status: "paid", isDemo: true, total: "4500.00" });
    expect(paid.pnr).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    expect(paid.tickets).toHaveLength(3);
    expect(new Set(paid.tickets.map((t) => t.qrPayload)).size).toBe(3);
    for (const t of paid.tickets) {
      expect(verifyQrToken(t.qrPayload)).toEqual({ reservationId: t.ticketId });
      expect(t).toMatchObject({ tableId: a1!.id, tableLabel: "A1" });
    }
    const [row] = await db.select().from(orders).where(eq(orders.id, hold.orderId));
    expect(row).toMatchObject({
      status: "paid",
      buyerFirstName: "Ayşe",
      buyerLastName: "Yılmaz",
      buyerLastNameKey: "YILMAZ",
      buyerEmail: "ayse@example.com",
      paymentProvider: "demo",
      isDemo: true,
    });
    expect(row?.paidAt).toBeInstanceOf(Date);
    expect(row?.termsAcceptedAt).toBeInstanceOf(Date);
    const attempts = await db.select().from(paymentAttempts);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      orderId: hold.orderId,
      provider: "demo",
      outcome: "approved",
      amount: "4500.00",
      currency: "TRY",
      isDemo: true,
    });
    expect((await activeTickets(a1!.id)).every((t) => t.status === "issued")).toBe(true);
  });

  it("aynı ödeme isteği tekrarlanırsa aynı sonuç döner; yeni deneme ve yeni PNR yok, onPaid bir kez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    const onPaid = vi.fn();
    const first = await payOrder(db, hold.orderId, approve, { onPaid });
    const second = await payOrder(db, hold.orderId, decline, { onPaid });
    expect(second.pnr).toBe(first.pnr);
    expect(new Set(second.tickets.map((t) => t.qrPayload))).toEqual(new Set(first.tickets.map((t) => t.qrPayload)));
    expect(await db.select().from(paymentAttempts)).toHaveLength(1);
    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledWith(hold.orderId);
  });

  it("reddet: payment_declined; sipariş bekler, deneme kaydı kalır, sonra onaylanabilir", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    expect((await caughtSales(payOrder(db, hold.orderId, decline))).salesCode).toBe("payment_declined");
    expect((await getOrderView(db, hold.orderId))?.status).toBe("pending");
    expect((await activeTickets(a1!.id)).every((t) => t.status === "held" && t.qrToken === null)).toBe(true);
    expect((await db.select().from(paymentAttempts)).map((a) => a.outcome)).toEqual(["declined"]);
    expect((await payOrder(db, hold.orderId, approve)).status).toBe("paid");
    expect((await db.select().from(paymentAttempts)).map((a) => a.outcome).sort()).toEqual(["approved", "declined"]);
  });

  it("süresi dolmuş ya da bırakılmış sipariş ödenemez (hold_expired); deneme kaydı ve sağlayıcı çağrısı yok", async () => {
    const {
      event,
      tables: [a1, b1],
    } = await saleEvent({ tables: [{ label: "A1" }, { label: "B1" }], settings: { blockSingleLeftover: false } });
    const { provider, start } = spyProvider();
    const stale = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    await expireOrder(db, stale.orderId);
    expect((await caughtSales(payOrder(db, stale.orderId, approve, { provider }))).salesCode).toBe("hold_expired");
    const released = await createPendingHold(db, { eventId: event.id, items: [{ tableId: b1!.id, quantity: 2 }] });
    await releaseHold(db, released.orderId);
    expect((await caughtSales(payOrder(db, released.orderId, approve, { provider }))).salesCode).toBe("hold_expired");
    expect(start).toHaveBeenCalledTimes(0);
    expect(await db.select().from(paymentAttempts)).toHaveLength(0);
  });

  it("sağlayıcı kapalıyken payments_disabled; sipariş ve biletler değişmez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    expect((await caughtSales(payOrder(db, hold.orderId, approve, { provider: null }))).salesCode).toBe(
      "payments_disabled",
    );
    expect((await getOrderView(db, hold.orderId))?.status).toBe("pending");
    expect((await activeTickets(a1!.id)).every((t) => t.status === "held")).toBe(true);
    expect(await db.select().from(paymentAttempts)).toHaveLength(0);
  });

  it("is_demo sağlayıcıdan gelir, sabit yazılmaz", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const { provider } = spyProvider({ isDemo: false });
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    const paid = await payOrder(db, hold.orderId, approve, { provider });
    expect(paid.isDemo).toBe(false);
    const [row] = await db.select().from(orders).where(eq(orders.id, hold.orderId));
    expect(row?.isDemo).toBe(false);
    const [attempt] = await db.select().from(paymentAttempts);
    expect(attempt?.isDemo).toBe(false);
  });

  it("istekteki sağlayıcı etkin sağlayıcıyla eşleşmezse payments_disabled", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const { provider, start } = spyProvider({ id: "other" });
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    expect((await caughtSales(payOrder(db, hold.orderId, approve, { provider }))).salesCode).toBe("payments_disabled");
    expect(start).toHaveBeenCalledTimes(0);
    expect((await getOrderView(db, hold.orderId))?.status).toBe("pending");
  });

  it("ödenen tutar tutma anındaki toplamdır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 3 }] });
    await setFinalPrices(db, event.id, { standard: "9999.00" });
    const paid = await payOrder(db, hold.orderId, approve);
    expect(paid.total).toBe("4500.00");
    const [attempt] = await db.select().from(paymentAttempts);
    expect(attempt?.amount).toBe("4500.00");
  });

  it("PNR çakışırsa yeni kod denenir; beş çakışmada işlem geri alınır", async () => {
    const {
      event,
      tables: [a1, b1, c1],
    } = await saleEvent({
      tables: [{ label: "A1" }, { label: "B1" }, { label: "C1" }],
      settings: { blockSingleLeftover: false },
    });
    const existing = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    const taken = existing.pnr!;

    const codes = [taken, "ZZZZ2222"];
    const retry = await createPendingHold(db, { eventId: event.id, items: [{ tableId: b1!.id, quantity: 2 }] });
    const generatePnr = vi.fn(() => codes.shift()!);
    const paid = await payOrder(db, retry.orderId, approve, { generatePnr });
    expect(paid.pnr).toBe("ZZZZ2222");
    expect(generatePnr).toHaveBeenCalledTimes(2);

    const stuck = await createPendingHold(db, { eventId: event.id, items: [{ tableId: c1!.id, quantity: 2 }] });
    const always = vi.fn(() => taken);
    const error = await payOrder(db, stuck.orderId, approve, { generatePnr: always }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toHaveProperty("salesCode");
    expect(always).toHaveBeenCalledTimes(5);
    expect((await getOrderView(db, stuck.orderId))?.status).toBe("pending");
    expect(await db.select().from(paymentAttempts).where(eq(paymentAttempts.orderId, stuck.orderId))).toHaveLength(0);
    expect((await activeTickets(c1!.id)).every((t) => t.status === "held")).toBe(true);
  });

  it("geçersiz e-posta invalid; olmayan sipariş order_not_found", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    const bad = { ...approve, buyer: { ...buyer, email: "x" } };
    expect((await caughtSales(payOrder(db, hold.orderId, bad))).salesCode).toBe("invalid");
    expect((await caughtSales(payOrder(db, randomUUID(), approve))).salesCode).toBe("order_not_found");
    expect(await db.select().from(paymentAttempts)).toHaveLength(0);
  });

  it("ödeme order.paid ve seats.changed yayar", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    const watcher = await watchEvents(event.id);
    try {
      await watcher.discardSetup();
      await payOrder(db, hold.orderId, approve);
      await watcher.settled();
      expect(watcher.events()).toEqual(
        expect.arrayContaining([
          { type: "order.paid", id: hold.orderId },
          { type: "seats.changed", id: a1!.id },
        ]),
      );
    } finally {
      watcher.stop();
    }
  });

  it("onPaid hata fırlatsa da ödeme geçerlidir", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const paid = await payOrder(db, hold.orderId, approve, {
        onPaid: () => {
          throw new Error("smtp");
        },
      });
      expect(paid.status).toBe("paid");
      expect(spy.mock.calls.some(([chunk]) => String(chunk).includes('"scope":"ticketing.onPaid"'))).toBe(true);
      expect((await getOrderView(db, hold.orderId))?.status).toBe("paid");
    } finally {
      spy.mockRestore();
    }
  });
});
