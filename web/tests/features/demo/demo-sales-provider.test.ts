import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventTables, events, orders, paymentAttempts } from "@/db/schema";
import { setSalesDemoEnabled } from "@/features/demo/service";
import { getSaleEventDetail, listSaleEvents } from "@/features/sales-api/catalog";
import {
  errorBodySchema,
  eventDetailSchema,
  eventsResponseSchema,
  orderResponseSchema,
} from "@/features/sales-api/contract";
import { getSiteContentView } from "@/features/sales-site/content-service";
import { getSalesSiteOverview } from "@/features/sales-site/overview";
import { createHold, payOrder } from "@/features/ticketing/orders-service";
import { demoProvider } from "@/features/ticketing/payment/demo";
import { providerForEvent, resolveProvider } from "@/features/ticketing/payment/registry";
import { adminActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { bodyOf, makeApi, req } from "../sales-api/fixtures";
import { caughtSales, saleEvent } from "../ticketing/fixtures";
import { oneConcert, tmpUploadRoot } from "./fixtures";

const O = "/api/sales/v1/orders";
const buyer = { firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.com" };
const payBody = { buyer, acceptTerms: true, payment: { provider: "demo", action: "approve" } };

describe("etkinlik bazında ödeme sağlayıcısı", () => {
  it("demo etkinlik PAYMENT_PROVIDER kapalıyken de demo sağlayıcıya çözülür", () => {
    expect(providerForEvent({ isDemo: true }, resolveProvider("disabled"))).toBe(demoProvider);
    expect(providerForEvent({ isDemo: true }, null)).toBe(demoProvider);
  });

  it("gerçek etkinlik genel sağlayıcıya bağlı kalır", () => {
    expect(providerForEvent({ isDemo: false }, resolveProvider("disabled"))).toBeNull();
    expect(providerForEvent({ isDemo: false }, resolveProvider("demo"))).toBe(demoProvider);
  });
});

describe("sağlayıcı kapalıyken demo satış", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  async function setupDemo() {
    const admin = await persistActor(db, adminActor());
    const real = await saleEvent();
    await setSalesDemoEnabled(db, admin, { enabled: true }, { uploadRoot: await tmpUploadRoot(), concerts: oneConcert() });
    const [demo] = await db.select().from(events).where(eq(events.isDemo, true));
    const [m78] = await db.select().from(eventTables).where(eq(eventTables.label, "M-78"));
    return { admin, real, demo: demo!, m78: m78! };
  }

  it("katalogda demo etkinlik open, gerçek etkinlik closed", async () => {
    const { admin, real, demo } = await setupDemo();
    const off = { provider: null, now: new Date() };

    const list = await listSaleEvents(db, off);
    expect(list.map((e) => [e.id, e.saleState])).toEqual([[demo.id, "open"]]);
    const detail = await getSaleEventDetail(db, demo.id, off);
    expect(detail?.sale.state).toBe("open");
    expect(detail?.sale.demo).toBe(true);

    await setSalesDemoEnabled(db, admin, { enabled: false });
    const realList = await listSaleEvents(db, off);
    expect(realList.map((e) => [e.id, e.saleState])).toEqual([[real.event.id, "closed"]]);
    const realDetail = await getSaleEventDetail(db, real.event.id, off);
    expect(realDetail?.sale.state).toBe("closed");
    expect(realDetail?.sale.demo).toBe(false);
  });

  it("demo etkinlikte tutma ve demo ödeme başarılı; sipariş demo işaretli", async () => {
    const { demo, m78 } = await setupDemo();
    const hold = await createHold(
      db,
      { eventId: demo.id, clientKey: randomUUID(), items: [{ tableId: m78.id, quantity: 2 }] },
      { provider: null },
    );
    expect(hold.status).toBe("pending");
    expect(hold.isDemo).toBe(true);

    const paid = await payOrder(db, hold.orderId, payBody as never, { provider: null });
    expect(paid.status).toBe("paid");
    expect(paid.isDemo).toBe(true);
    const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.orderId, hold.orderId));
    expect(attempt).toMatchObject({ provider: "demo", isDemo: true, outcome: "approved" });
  });

  it("gerçek etkinlikte tutma reddi değişmedi: sales_closed", async () => {
    const { admin, real } = await setupDemo();
    await setSalesDemoEnabled(db, admin, { enabled: false });
    const err = await caughtSales(
      createHold(
        db,
        { eventId: real.event.id, clientKey: randomUUID(), items: [{ tableId: real.tables[0]!.id, quantity: 2 }] },
        { provider: null },
      ),
    );
    expect(err.salesCode).toBe("sales_closed");
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  it("satış API'si: demo etkinlik listelenir, tutulur, ödenir ve DEMO ibaresi döner", async () => {
    const { demo, m78 } = await setupDemo();
    const api = makeApi({ provider: () => null });

    const list = eventsResponseSchema.parse(await bodyOf(await api.listEvents(req("GET", "/api/sales/v1/events"))));
    expect(list.events.map((e) => [e.id, e.saleState])).toEqual([[demo.id, "open"]]);
    const detail = eventDetailSchema.parse(
      await bodyOf(await api.getEvent(req("GET", `/api/sales/v1/events/${demo.id}`), demo.id)),
    );
    expect(detail.sale).toMatchObject({ state: "open", demo: true });

    const created = await api.createOrder(
      req("POST", O, { body: { eventId: demo.id, items: [{ tableId: m78.id, quantity: 2 }], clientKey: randomUUID() } }),
    );
    expect(created.status).toBe(201);
    const hold = orderResponseSchema.parse(await bodyOf(created));
    expect(hold.demoNotice).toBe("DEMO - gerçek ödeme alınmadı");

    const paid = orderResponseSchema.parse(
      await bodyOf(await api.payOrder(req("POST", `${O}/${hold.orderToken}/pay`, { body: payBody }), hold.orderToken)),
    );
    expect(paid).toMatchObject({ status: "paid", isDemo: true, demoNotice: "DEMO - gerçek ödeme alınmadı" });
  });

  it("satış API'si: gerçek etkinlikte tutma 409 sales_closed (değişmedi)", async () => {
    const { admin, real } = await setupDemo();
    await setSalesDemoEnabled(db, admin, { enabled: false });
    const api = makeApi({ provider: () => null });
    const res = await api.createOrder(
      req("POST", O, {
        body: { eventId: real.event.id, items: [{ tableId: real.tables[0]!.id, quantity: 2 }], clientKey: randomUUID() },
      }),
    );
    expect(errorBodySchema.parse(await res.json()).error.code).toBe("sales_closed");
  });

  it("yönetim görünümü: sağlayıcı kapalıyken demo etkinlik sitede açık görünür", async () => {
    const { admin, demo } = await setupDemo();
    const ctx = { now: new Date(), providerActive: false };
    const { rows } = await getSalesSiteOverview(db, admin, ctx);
    expect(rows.find((r) => r.eventId === demo.id)?.siteState).toBe("open");
    const view = await getSiteContentView(db, admin, demo.id, ctx);
    expect(view.siteState).toBe("open");
  });
});
