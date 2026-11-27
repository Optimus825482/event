import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventSiteContent, eventTables, events, orders } from "@/db/schema";
import { DIAMOND_CANVAS } from "@/features/demo/diamond-plan";
import { setSalesDemoEnabled } from "@/features/demo/service";
import {
  computeAvailability,
  getSaleEventDetail,
  isListedImagePath,
  listSaleEvents,
} from "@/features/sales-api/catalog";
import { IMAGE_PATH_PATTERN, eventDetailSchema } from "@/features/sales-api/contract";
import {
  createHold,
  createHoldWithOutcome,
  findOrderByPnr,
  getOrderView,
  payOrder,
} from "@/features/ticketing/orders-service";
import { demoProvider } from "@/features/ticketing/payment/demo";
import { findTicketByQr } from "@/features/ticketing/tickets-read";
import { adminActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { caughtSales, saleEvent } from "../ticketing/fixtures";
import { oneConcert, tmpUploadRoot } from "./fixtures";

const ctx = () => ({ provider: demoProvider, now: new Date() });

describe("demo katalog süzgeci ve tutma reddi", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  async function setupRealAndDemo() {
    const admin = await persistActor(db, adminActor());
    const real = await saleEvent();
    const uploadRoot = await tmpUploadRoot();
    await setSalesDemoEnabled(db, admin, { enabled: true }, { uploadRoot, concerts: oneConcert() });
    const [demoEv] = await db.select().from(events).where(eq(events.isDemo, true));
    return { admin, real, demo: demoEv! };
  }

  it("anahtar kapalıyken yalnızca gerçek etkinlik listelenir ve açılır", async () => {
    const { admin, real, demo } = await setupRealAndDemo();
    await setSalesDemoEnabled(db, admin, { enabled: false });

    const list = await listSaleEvents(db, ctx());
    expect(list.map((e) => e.id)).toEqual([real.event.id]);
    expect(await getSaleEventDetail(db, demo.id, ctx())).toBeNull();
    expect(await computeAvailability(db, demo.id, new Date())).toBeNull();
    expect(await getSaleEventDetail(db, real.event.id, ctx())).not.toBeNull();

    const [site] = await db.select().from(eventSiteContent).where(eq(eventSiteContent.eventId, demo.id));
    expect(await isListedImagePath(db, demo.coverImage!)).toBe(false);
    expect(await isListedImagePath(db, site!.heroImage!)).toBe(false);
  });

  it("anahtar açıkken yalnızca demo etkinlik listelenir ve açılır", async () => {
    const { real, demo } = await setupRealAndDemo();

    const list = await listSaleEvents(db, ctx());
    expect(list.map((e) => e.id)).toEqual([demo.id]);
    expect(list[0]!.isDemo).toBe(true);
    expect(await getSaleEventDetail(db, real.event.id, ctx())).toBeNull();
    expect(await computeAvailability(db, real.event.id, new Date())).toBeNull();

    expect(await isListedImagePath(db, demo.coverImage!)).toBe(true);
  });

  it("ayar satırı hiç yokken gerçek etkinlikler görünür", async () => {
    const real = await saleEvent();
    const list = await listSaleEvents(db, ctx());
    expect(list.map((e) => e.id)).toEqual([real.event.id]);
  });

  it("demo etkinlik sitede eksiksiz görünür", async () => {
    const { demo } = await setupRealAndDemo();
    const detail = await getSaleEventDetail(db, demo.id, ctx());
    expect(detail).not.toBeNull();
    const parsed = eventDetailSchema.parse(detail);

    expect(parsed.sale.state).toBe("open");
    expect(parsed.sale.mode).toBe("seat");
    expect(parsed.site.sightlineSet).toBe("diamond");
    expect(parsed.coverImage).toMatch(IMAGE_PATH_PATTERN);
    expect(parsed.artistImage).toMatch(IMAGE_PATH_PATTERN);
    expect(parsed.site.heroImage).toMatch(IMAGE_PATH_PATTERN);
    expect(parsed.plan.tables).toHaveLength(173);
    const labels = parsed.plan.tables.map((t) => t.label);
    expect(labels).toContain("M-1");
    expect(labels).toContain("L-3A");
    expect(parsed.prices).toHaveLength(3);
    expect(parsed.minPrice).toBe("7500.00");
    expect(parsed.plan.canvas).toEqual({ width: DIAMOND_CANVAS.width, height: DIAMOND_CANVAS.height });

    const avail = await computeAvailability(db, demo.id, new Date());
    expect(avail).not.toBeNull();
    expect(avail!.tables).toHaveLength(173);
    expect(avail!.tables.every((t) => t.free === 12 && t.freeSeats.length === 12)).toBe(true);
  });

  it("demo etkinlikte seçilen sandalyeler tutulur ve sipariş demo işaretlenir", async () => {
    const { demo } = await setupRealAndDemo();
    const [m78] = await db
      .select()
      .from(eventTables)
      .where(eq(eventTables.label, "M-78"));

    const hold = await createHold(
      db,
      { eventId: demo.id, clientKey: randomUUID(), items: [{ tableId: m78!.id, quantity: 2, seatNos: [5, 6] }] },
      { provider: demoProvider },
    );
    expect(hold.status).toBe("pending");
    expect(hold.isDemo).toBe(true);

    const paid = await payOrder(
      db,
      hold.orderId,
      {
        buyer: { firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.com" },
        acceptTerms: true,
        payment: { provider: "demo", action: "approve" },
      },
      { provider: demoProvider },
    );
    expect(paid.tickets.map((t) => t.seatNo)).toEqual([5, 6]);
    expect(paid.isDemo).toBe(true);
  });

  it("gizli kümede yeni tutma event_not_found alır", async () => {
    const { admin, real, demo } = await setupRealAndDemo();

    const err1 = await caughtSales(
      createHold(
        db,
        { eventId: real.event.id, clientKey: randomUUID(), items: [{ tableId: real.tables[0]!.id, quantity: 2 }] },
        { provider: demoProvider },
      ),
    );
    expect(err1.salesCode).toBe("event_not_found");

    await setSalesDemoEnabled(db, admin, { enabled: false });
    const [m78] = await db.select().from(eventTables).where(eq(eventTables.label, "M-78"));
    const err2 = await caughtSales(
      createHold(
        db,
        { eventId: demo.id, clientKey: randomUUID(), items: [{ tableId: m78!.id, quantity: 2 }] },
        { provider: demoProvider },
      ),
    );
    expect(err2.salesCode).toBe("event_not_found");
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it("anahtar kapanınca bekleyen demo siparişi ödenir, yeni tutma reddedilir", async () => {
    const { admin, demo } = await setupRealAndDemo();
    const [m78] = await db.select().from(eventTables).where(eq(eventTables.label, "M-78"));

    const hold = await createHold(
      db,
      { eventId: demo.id, clientKey: randomUUID(), items: [{ tableId: m78!.id, quantity: 2 }] },
      { provider: demoProvider },
    );

    await setSalesDemoEnabled(db, admin, { enabled: false });

    const paid = await payOrder(
      db,
      hold.orderId,
      {
        buyer: { firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.com" },
        acceptTerms: true,
        payment: { provider: "demo", action: "approve" },
      },
      { provider: demoProvider },
    );
    expect(paid.status).toBe("paid");
    expect(paid.isDemo).toBe(true);

    const view = await getOrderView(db, hold.orderId);
    expect(view?.tickets).toHaveLength(2);
    expect(await findOrderByPnr(db, { pnr: paid.pnr!, lastName: "Yılmaz" })).not.toBeNull();

    const err = await caughtSales(
      createHold(
        db,
        { eventId: demo.id, clientKey: randomUUID(), items: [{ tableId: m78!.id, quantity: 2 }] },
        { provider: demoProvider },
      ),
    );
    expect(err.salesCode).toBe("event_not_found");
  });

  it("aynı clientKey yinelemesi anahtar değişse de aynı siparişi döner", async () => {
    const { admin, demo } = await setupRealAndDemo();
    const [m78] = await db.select().from(eventTables).where(eq(eventTables.label, "M-78"));
    const clientKey = randomUUID();

    const first = await createHoldWithOutcome(
      db,
      { eventId: demo.id, clientKey, items: [{ tableId: m78!.id, quantity: 2 }] },
      { provider: demoProvider },
    );
    expect(first.created).toBe(true);

    await setSalesDemoEnabled(db, admin, { enabled: false });

    const second = await createHoldWithOutcome(
      db,
      { eventId: demo.id, clientKey, items: [{ tableId: m78!.id, quantity: 2 }] },
      { provider: demoProvider },
    );
    expect(second.created).toBe(false);
    expect(second.order.orderId).toBe(first.order.orderId);
  });

  it("anahtar açılınca bekleyen gerçek siparişi ödenir", async () => {
    const { admin, real } = await setupRealAndDemo();
    await setSalesDemoEnabled(db, admin, { enabled: false });

    const hold = await createHold(
      db,
      { eventId: real.event.id, clientKey: randomUUID(), items: [{ tableId: real.tables[0]!.id, quantity: 2 }] },
      { provider: demoProvider },
    );

    await setSalesDemoEnabled(db, admin, { enabled: true });

    const paid = await payOrder(
      db,
      hold.orderId,
      {
        buyer: { firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.com" },
        acceptTerms: true,
        payment: { provider: "demo", action: "approve" },
      },
      { provider: demoProvider },
    );
    expect(paid.status).toBe("paid");
    expect(paid.isDemo).toBe(true);
    expect(real.event.isDemo).toBe(false);
  });

  it("demo etkinliğin bileti check-in'de okunur (anahtar kapalıyken de)", async () => {
    const { admin, demo } = await setupRealAndDemo();
    const [m78] = await db.select().from(eventTables).where(eq(eventTables.label, "M-78"));

    const hold = await createHold(
      db,
      { eventId: demo.id, clientKey: randomUUID(), items: [{ tableId: m78!.id, quantity: 1 }] },
      { provider: demoProvider },
    );
    const paid = await payOrder(
      db,
      hold.orderId,
      {
        buyer: { firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.com" },
        acceptTerms: true,
        payment: { provider: "demo", action: "approve" },
      },
      { provider: demoProvider },
    );

    await setSalesDemoEnabled(db, admin, { enabled: false });

    const found = await findTicketByQr(db, paid.tickets[0]!.qrPayload);
    expect(found).not.toBeNull();
    expect(found!.ticketId).toBe(paid.tickets[0]!.ticketId);
  });
});
