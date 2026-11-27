import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { ForbiddenError } from "@/features/auth/errors";
import { payOrder } from "@/features/ticketing/orders-service";
import { getOrderDetail, getOrdersOverview } from "@/features/ticketing/queries";
import { managerActor, memberActor, noAccessActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createPaidOrder, createPendingHold, expireOrder } from "../../helpers/ticketing";
import { saleEvent } from "./fixtures";

const buyer = { firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.com" };

describe("iç sipariş okuma", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("liste: ödenmiş ve süresi dolmamış tutmalar; doluluk ve toplamlar", async () => {
    const {
      event,
      tables: [a1, b1],
    } = await saleEvent({ tables: [{ label: "A1" }, { label: "B1" }] });
    const actor = await persistActor(db, managerActor("entertainment"));
    await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 3 }] });
    await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    const stale = await createPendingHold(db, { eventId: event.id, items: [{ tableId: b1!.id, quantity: 1 }] });
    await expireOrder(db, stale.orderId);

    const view = await getOrdersOverview(db, actor, event.id);
    expect(view.eventName).toBe(event.name);
    expect(view.orders.map((o) => o.status)).toEqual(["pending", "paid"]);
    expect(view.orders[1]).toMatchObject({
      buyerName: "Ayşe Yılmaz",
      buyerEmail: "ayse@example.com",
      seatCount: 3,
      tableLabels: ["A1"],
      total: "4500.00",
      isDemo: true,
    });
    expect(view.orders[0]).toMatchObject({ seatCount: 2, buyerName: null, pnr: null });
    expect(view.occupancy).toEqual([
      { tableId: a1!.id, label: "A1", category: "standard", seats: 8, held: 2, issued: 3 },
      { tableId: b1!.id, label: "B1", category: "standard", seats: 8, held: 0, issued: 0 },
    ]);
    expect(view.totals).toEqual({ issued: 3, revenue: "4500.00", demoIssued: 0, demoRevenue: "0.00" });
  });

  it("olmayan etkinlik not_found", async () => {
    const actor = await persistActor(db, managerActor("entertainment"));
    await expect(getOrdersOverview(db, actor, "00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({
      code: "not_found",
      message: "Etkinlik bulunamadı",
    });
  });

  it("ayrıntı: biletler QR yükleriyle, ödeme denemeleri sırayla", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const actor = await persistActor(db, managerActor("entertainment"));
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 3 }] });
    const pending = await getOrderDetail(db, actor, { eventId: event.id, orderId: hold.orderId });
    expect(pending.tickets).toHaveLength(3);
    expect(pending.tickets.every((t) => t.status === "held" && t.qrPayload === null)).toBe(true);
    expect(pending.attempts).toEqual([]);

    const base = { buyer, acceptTerms: true } as const;
    await expect(
      payOrder(db, hold.orderId, { ...base, payment: { provider: "demo", action: "decline" } }),
    ).rejects.toThrow();
    await payOrder(db, hold.orderId, { ...base, payment: { provider: "demo", action: "approve" } });

    const detail = await getOrderDetail(db, actor, { eventId: event.id, orderId: hold.orderId });
    expect(detail.attempts.map((a) => a.outcome)).toEqual(["declined", "approved"]);
    expect(detail).toMatchObject({ status: "paid", buyerPhone: null, seatCount: 3, isDemo: true });
    expect(detail.tickets).toHaveLength(3);
    expect(detail.tickets.every((t) => t.status === "issued" && t.qrPayload !== null && t.tableLabel === "A1")).toBe(true);
    expect(detail.tickets[0]).toMatchObject({ category: "standard", unitPrice: "1500.00", checkedInAt: null });
  });

  it("başka etkinliğin siparişi bulunamaz", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const other = await saleEvent();
    const actor = await persistActor(db, managerActor("entertainment"));
    const order = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 1 }] });
    await expect(getOrderDetail(db, actor, { eventId: other.event.id, orderId: order.orderId })).rejects.toMatchObject({
      code: "not_found",
      message: "Sipariş bulunamadı",
    });
  });

  it("ticketing:view izni olmayan göremez; F&B ve Casino yöneticisi göremez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const order = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 1 }] });
    for (const actor of [noAccessActor(), managerActor("fnb"), managerActor("casino")]) {
      const persisted = await persistActor(db, actor);
      await expect(getOrdersOverview(db, persisted, event.id)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getOrderDetail(db, persisted, { eventId: event.id, orderId: order.orderId })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    }
    const viewer = await persistActor(db, memberActor("entertainment", { ticketing: "v---" }));
    expect((await getOrdersOverview(db, viewer, event.id)).orders).toHaveLength(1);
  });

  it("sipariş ayrıntısı bilet sandalye numarasını taşır ve masa → sandalye sırasındadır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const actor = await persistActor(db, managerActor("entertainment"));
    const paid = await createPaidOrder(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 2, seatNos: [6, 5] }],
    });
    const detail = await getOrderDetail(db, actor, { eventId: event.id, orderId: paid.orderId });
    expect(detail.tickets.map((t) => t.seatNo)).toEqual([5, 6]);
  });

  it("masa bazlı kipte, locada ve süresi dolmuş bilette seatNo null", async () => {
    const actor = await persistActor(db, managerActor("entertainment"));

    const tableMode = await saleEvent({ settings: { saleMode: "table" } });
    const tableOrder = await createPaidOrder(db, {
      eventId: tableMode.event.id,
      items: [{ tableId: tableMode.tables[0]!.id, quantity: 8 }],
    });
    const tableDetail = await getOrderDetail(db, actor, { eventId: tableMode.event.id, orderId: tableOrder.orderId });
    expect(tableDetail.tickets.every((t) => t.seatNo === null)).toBe(true);

    const locaMode = await saleEvent({ tables: [{ isLoca: true, capacity: 6 }], settings: { locaOnline: true } });
    const locaOrder = await createPaidOrder(db, {
      eventId: locaMode.event.id,
      items: [{ tableId: locaMode.tables[0]!.id, quantity: 6 }],
    });
    const locaDetail = await getOrderDetail(db, actor, { eventId: locaMode.event.id, orderId: locaOrder.orderId });
    expect(locaDetail.tickets.every((t) => t.seatNo === null)).toBe(true);

    const expMode = await saleEvent();
    const expHold = await createPendingHold(db, {
      eventId: expMode.event.id,
      items: [{ tableId: expMode.tables[0]!.id, quantity: 2, seatNos: [3, 4] }],
    });
    await expireOrder(db, expHold.orderId);
    const expDetail = await getOrderDetail(db, actor, { eventId: expMode.event.id, orderId: expHold.orderId });
    expect(expDetail.tickets[0]?.seatNo).toBeNull();
  });
});
