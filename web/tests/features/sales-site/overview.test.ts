import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { artists, eventSiteContent, events, systemSettings } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { getSalesSiteOverview } from "@/features/sales-site/overview";
import { managerActor, memberActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createEvent } from "../../helpers/factories";
import { createPaidOrder, createPendingHold, expireOrder } from "../../helpers/ticketing";
import { saleEvent } from "../ticketing/fixtures";

const NOW = new Date("2026-12-01T22:45:00.000Z"); // Kıbrıs: 2 Aralık 00:45
const ctx = { now: NOW, providerActive: true };
const ent = managerActor("entertainment");

const COVER = "event/00000000-0000-4000-8000-000000000011.webp";
const HERO = "event/00000000-0000-4000-8000-000000000012.webp";
const ARTIST_IMG = "artist/00000000-0000-4000-8000-000000000021.webp";

async function setPaidAt(orderId: string, iso: string) {
  await db.execute(sql`update orders set paid_at = ${iso}::timestamptz where id = ${orderId}`);
}

describe("sales-site overview", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("gerçek etkinlikte demo sağlayıcıyla ödenen sipariş gerçek satıra yazılır", async () => {
    const { event, tables } = await saleEvent();
    await createPaidOrder(db, { eventId: event.id, items: [{ tableId: tables[0]!.id, quantity: 2 }] });
    const { summary } = await getSalesSiteOverview(db, ent, { now: new Date(), providerActive: true });
    expect(summary).toEqual([
      {
        isDemo: false,
        currency: "TRY",
        todayTickets: 2,
        todayRevenue: "3000.00",
        totalTickets: 2,
        totalRevenue: "3000.00",
      },
    ]);
  });

  it("demo etkinliğin satışı ayrı satırdadır", async () => {
    const e1 = await saleEvent();
    await createPaidOrder(db, { eventId: e1.event.id, items: [{ tableId: e1.tables[0]!.id, quantity: 2 }] });

    const e2 = await saleEvent();
    await db.update(events).set({ isDemo: true }).where(eq(events.id, e2.event.id));
    await createPaidOrder(db, { eventId: e2.event.id, items: [{ tableId: e2.tables[0]!.id, quantity: 3 }] });

    const { summary } = await getSalesSiteOverview(db, ent, { now: new Date(), providerActive: true });
    expect(summary).toEqual([
      {
        isDemo: false,
        currency: "TRY",
        todayTickets: 2,
        todayRevenue: "3000.00",
        totalTickets: 2,
        totalRevenue: "3000.00",
      },
      {
        isDemo: true,
        currency: "TRY",
        todayTickets: 3,
        todayRevenue: "4500.00",
        totalTickets: 3,
        totalRevenue: "4500.00",
      },
    ]);
  });

  it("bugün Kıbrıs gününe göre sayılır", async () => {
    const { event, tables } = await saleEvent();
    const o1 = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: tables[0]!.id, quantity: 2 }] });
    const o2 = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: tables[0]!.id, quantity: 1 }] });
    await setPaidAt(o1.orderId, "2026-12-01T21:30:00.000Z"); // Kıbrıs 23:30 (dün)
    await setPaidAt(o2.orderId, "2026-12-01T22:30:00.000Z"); // Kıbrıs 00:30 (bugün)

    const { summary } = await getSalesSiteOverview(db, ent, ctx);
    expect(summary).toEqual([
      {
        isDemo: false,
        currency: "TRY",
        todayTickets: 1,
        todayRevenue: "1500.00",
        totalTickets: 3,
        totalRevenue: "4500.00",
      },
    ]);
  });

  it("farklı para birimleri toplanmaz", async () => {
    const e1 = await saleEvent();
    await createPaidOrder(db, { eventId: e1.event.id, items: [{ tableId: e1.tables[0]!.id, quantity: 1 }] });
    const e2 = await saleEvent({ settings: { currency: "EUR" } });
    await createPaidOrder(db, { eventId: e2.event.id, items: [{ tableId: e2.tables[0]!.id, quantity: 1 }] });

    const { summary } = await getSalesSiteOverview(db, ent, { now: new Date(), providerActive: true });
    expect(summary?.map((s) => s.currency)).toEqual(["EUR", "TRY"]);
  });

  it("ödenmemiş tutma ve süresi dolmuş bilet sayılmaz", async () => {
    const { event, tables } = await saleEvent();
    await createPendingHold(db, { eventId: event.id, items: [{ tableId: tables[0]!.id, quantity: 2 }] });
    const h2 = await createPendingHold(db, { eventId: event.id, items: [{ tableId: tables[0]!.id, quantity: 2 }] });
    await expireOrder(db, h2.orderId);

    const o = await getSalesSiteOverview(db, ent, ctx);
    expect(o.summary).toEqual([]);
    expect(o.rows[0]!.sold).toBe(0);
    expect(o.rows[0]!.occupancyPercent).toBe(0);
  });

  it("satır: site durumu, satılan, doluluk, satış şekli, görsel durumu", async () => {
    const { event, tables } = await saleEvent();
    await createPaidOrder(db, { eventId: event.id, items: [{ tableId: tables[0]!.id, quantity: 5 }] });

    const { rows } = await getSalesSiteOverview(db, ent, ctx);
    expect(rows[0]).toMatchObject({
      eventId: event.id,
      siteState: "open",
      sold: 5,
      occupancyPercent: 63,
      saleMode: "seat",
      isDemo: false,
      images: { status: "missing", missing: ["cover", "hero"] },
    });
  });

  it("taslak etkinlik 'sitede değil' ve doluluğu yok", async () => {
    const event = await createEvent(db);
    const { rows } = await getSalesSiteOverview(db, ent, ctx);
    expect(rows[0]).toMatchObject({
      eventId: event.id,
      siteState: null,
      sold: 0,
      occupancyPercent: null,
    });
  });

  it("kapak ve hero yüklüyse görsel durumu tam; sanatçıya bağlıysa sanatçı görseli de gerekir", async () => {
    const e1 = await createEvent(db);
    await db.update(events).set({ coverImage: COVER }).where(eq(events.id, e1.id));
    await db.insert(eventSiteContent).values({ eventId: e1.id, heroImage: HERO });

    const [artist] = await db.insert(artists).values({ name: "S1", nameKey: "s1" }).returning();
    const e2 = await createEvent(db);
    await db.update(events).set({ coverImage: COVER, artistId: artist!.id }).where(eq(events.id, e2.id));
    await db.insert(eventSiteContent).values({ eventId: e2.id, heroImage: HERO });

    let rows = (await getSalesSiteOverview(db, ent, ctx)).rows;
    expect(rows.find((r) => r.eventId === e1.id)?.images).toEqual({ status: "complete", missing: [] });
    expect(rows.find((r) => r.eventId === e2.id)?.images).toEqual({ status: "missing", missing: ["artist"] });

    await db.update(artists).set({ image: ARTIST_IMG }).where(eq(artists.id, artist!.id));
    rows = (await getSalesSiteOverview(db, ent, ctx)).rows;
    expect(rows.find((r) => r.eventId === e2.id)?.images).toEqual({ status: "complete", missing: [] });
  });

  it("demo anahtarı: satır yokken ve kapalıyken false, açıkken true", async () => {
    expect((await getSalesSiteOverview(db, ent, ctx)).demoEnabled).toBe(false);
    await db.insert(systemSettings).values({ salesDemoEnabled: true });
    expect((await getSalesSiteOverview(db, ent, ctx)).demoEnabled).toBe(true);
  });

  it("etkinlikler tarihe göre yeniden eskiye sıralanır", async () => {
    const older = await createEvent(db, { name: "Eski", startsAt: new Date("2026-10-01T18:00:00.000Z") });
    const newer = await createEvent(db, { name: "Yeni", startsAt: new Date("2026-12-15T18:00:00.000Z") });
    const { rows } = await getSalesSiteOverview(db, ent, ctx);
    expect(rows.map((r) => r.eventId)).toEqual([newer.id, older.id]);
  });

  it("F&B yöneticisi listeyi görür ama rakamları göremez", async () => {
    await saleEvent();
    const o = await getSalesSiteOverview(db, managerActor("fnb"), ctx);
    expect(o.canSeeSales).toBe(false);
    expect(o.summary).toBeNull();
    expect(o.rows.every((r) => r.sold === null && r.occupancyPercent === null)).toBe(true);
  });

  it("events:view olmayan aktör reddedilir", async () => {
    await expect(getSalesSiteOverview(db, memberActor("casino", { check_in: "vc--" }), ctx)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
