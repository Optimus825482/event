import { and, count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
  artists,
  checkInEvents,
  eventArchives,
  eventSaleSettings,
  eventSeatPrices,
  eventSiteContent,
  eventTables,
  events,
  notifications,
  orders,
  paymentAttempts,
  systemSettings,
  tableSeatSlots,
  tickets,
} from "@/db/schema";
import { artistNameKey } from "@/features/artists/name-key";
import { checkInTicket } from "@/features/check-in/ticket-check-in";
import { purgeDemoData } from "@/features/demo/purge";
import { changeEventStatus } from "@/features/events/service";
import { insertArchive } from "../../helpers/archive";
import { truncateAll } from "../../helpers/db";
import { createEvent } from "../../helpers/factories";
import { createPaidOrder, createPendingHold, expireOrder } from "../../helpers/ticketing";
import { saleEvent } from "../ticketing/fixtures";
import { oneConcert, seedOnce } from "./fixtures";

describe("demo kalıcı silme", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("demo etkinliği masaları, yuvaları, fiyatları, ayarları ve site içeriğiyle siler", async () => {
    const { eventIds } = await seedOnce({ concerts: oneConcert() });
    const demoId = eventIds[0]!;

    const res = await db.transaction((tx) => purgeDemoData(tx));
    expect(res).toMatchObject({ events: 1, orders: 0 });
    expect(res.imagePaths).toHaveLength(3);

    const [demoCountRow] = await db.select({ value: count() }).from(events).where(eq(events.isDemo, true));
    const demoCount = demoCountRow?.value ?? 0;
    expect(Number(demoCount)).toBe(0);
    for (const table of [eventTables, tableSeatSlots, eventSeatPrices, eventSaleSettings, eventSiteContent]) {
      const [cRow] = await db.select({ value: count() }).from(table).where(eq(table.eventId, demoId));
    const c = cRow?.value ?? 0;
      expect(Number(c)).toBe(0);
    }
  });

  it("siparişi, bileti, ödeme denemesi, check-in kaydı ve arşivi olan demo etkinlik de silinir", async () => {
    const { admin, eventIds } = await seedOnce({ concerts: oneConcert() });
    await db.insert(systemSettings).values({ salesDemoEnabled: true });
    const demoId = eventIds[0]!;
    const [demoEvent] = await db.select().from(events).where(eq(events.id, demoId));
    // Loca masaları bütün satılır; iki koltukluk sipariş için açıkça loca olmayan `M-1` seçilir.
    const [m1] = await db
      .select()
      .from(eventTables)
      .where(and(eq(eventTables.eventId, demoId), eq(eventTables.label, "M-1")));

    const paid = await createPaidOrder(db, { eventId: demoId, items: [{ tableId: m1!.id, quantity: 2 }] });
    await createPendingHold(db, { eventId: demoId, items: [{ tableId: m1!.id, quantity: 1 }] });
    const exp = await createPendingHold(db, { eventId: demoId, items: [{ tableId: m1!.id, quantity: 1 }] });
    await expireOrder(db, exp.orderId);

    await db.transaction((tx) =>
      checkInTicket(tx, {
        ticketId: paid.tickets[0]!.ticketId,
        event: demoEvent!,
        actorId: admin.id,
        clientTimestamp: new Date(),
        gate: 1,
      }),
    );

    await changeEventStatus(db, admin, { id: demoId, status: "active" });
    await changeEventStatus(db, admin, { id: demoId, status: "completed" });
    await db.insert(notifications).values({
      createdById: admin.id,
      eventId: demoId,
      type: "planning_stage_advanced",
      title: "Demo bildirim",
      message: "Demo bildirim",
    });

    const res = await db.transaction((tx) => purgeDemoData(tx));
    expect(res).toMatchObject({ events: 1, orders: 3 });

    for (const table of [orders, tickets, eventArchives, notifications]) {
      const [cRow] = await db.select({ value: count() }).from(table).where(eq(table.eventId, demoId));
    const c = cRow?.value ?? 0;
      expect(Number(c)).toBe(0);
    }
    const [paCountRow] = await db.select({ value: count() }).from(paymentAttempts);
    const paCount = paCountRow?.value ?? 0;
    expect(Number(paCount)).toBe(0);
    const [checkInsRow] = await db.select({ value: count() }).from(checkInEvents);
    const checkIns = checkInsRow?.value ?? 0;
    expect(Number(checkIns)).toBe(0);
  });

  it("silme gerçek etkinliğe, siparişine, arşivine ve sanatçısına dokunmaz", async () => {
    await seedOnce({ concerts: oneConcert() });
    const real = await saleEvent();
    await createPaidOrder(db, { eventId: real.event.id, items: [{ tableId: real.tables[0]!.id, quantity: 2 }] });
    await insertArchive(db, { startsAt: new Date("2026-10-01T19:00:00Z") });
    const realArtistImg = "artist/00000000-0000-4000-8000-0000000000b1.webp";
    const [realArtist] = await db
      .insert(artists)
      .values({ name: "Gerçek Sanatçı", nameKey: artistNameKey("Gerçek Sanatçı"), image: realArtistImg })
      .returning();

    const realCover = "event/00000000-0000-4000-8000-0000000000c9.webp";
    await db.update(events).set({ coverImage: realCover }).where(eq(events.id, real.event.id));

    const res = await db.transaction((tx) => purgeDemoData(tx));
    expect(res.events).toBe(1);
    expect(res.imagePaths).not.toContain(realCover);
    expect(res.imagePaths).not.toContain(realArtistImg);

    const [realEvRow] = await db.select({ value: count() }).from(events).where(eq(events.isDemo, false));
    const realEv = realEvRow?.value ?? 0;
    const [realOrdRow] = await db.select({ value: count() }).from(orders);
    const realOrd = realOrdRow?.value ?? 0;
    const [realArchRow] = await db.select({ value: count() }).from(eventArchives);
    const realArch = realArchRow?.value ?? 0;
    const [keptArtist] = await db.select().from(artists).where(eq(artists.id, realArtist!.id));
    expect(Number(realEv)).toBe(2); // saleEvent + insertArchive
    expect(Number(realOrd)).toBe(1);
    expect(Number(realArch)).toBe(1);
    expect(keptArtist?.image).toBe(realArtistImg);
  });

  it("demo sanatçı bağlı gerçek etkinlik yoksa silinir ve görseli silinecekler listesine girer", async () => {
    const { eventIds } = await seedOnce({ concerts: oneConcert() });
    const [ev] = await db.select().from(events).where(eq(events.id, eventIds[0]!));
    const [site] = await db.select().from(eventSiteContent).where(eq(eventSiteContent.eventId, eventIds[0]!));
    const [art] = await db.select().from(artists).where(eq(artists.id, ev!.artistId!));

    const res = await db.transaction((tx) => purgeDemoData(tx));
    const [artCountRow] = await db.select({ value: count() }).from(artists);
    const artCount = artCountRow?.value ?? 0;
    expect(Number(artCount)).toBe(0);
    expect(new Set(res.imagePaths)).toEqual(new Set([ev!.coverImage!, site!.heroImage!, art!.image!]));
  });

  it("gerçek etkinliğe bağlanmış demo sanatçı kalır, demo işareti kapanır, görseli silinmez", async () => {
    const { eventIds } = await seedOnce({ concerts: oneConcert() });
    const [demoEv] = await db.select().from(events).where(eq(events.id, eventIds[0]!));
    const [site] = await db.select().from(eventSiteContent).where(eq(eventSiteContent.eventId, eventIds[0]!));
    const [demoArt] = await db.select().from(artists).where(eq(artists.id, demoEv!.artistId!));

    const realEv = await createEvent(db, { artistId: demoArt!.id, artistName: demoArt!.name });

    const res = await db.transaction((tx) => purgeDemoData(tx));
    const allArtists = await db.select().from(artists);
    expect(allArtists).toHaveLength(1);
    expect(allArtists[0]!.isDemo).toBe(false);
    expect(allArtists[0]!.image).toBe(demoArt!.image);
    expect(new Set(res.imagePaths)).toEqual(new Set([demoEv!.coverImage!, site!.heroImage!]));

    const [updatedReal] = await db.select().from(events).where(eq(events.id, realEv.id));
    expect(updatedReal!.artistId).toBe(demoArt!.id);
  });

  it("gerçek arşiv satırına bağlı demo sanatçı da kalır", async () => {
    const { eventIds } = await seedOnce({ concerts: oneConcert() });
    const [demoEv] = await db.select().from(events).where(eq(events.id, eventIds[0]!));
    await insertArchive(db, { startsAt: new Date("2026-10-01T19:00:00Z"), artistId: demoEv!.artistId });

    await db.transaction((tx) => purgeDemoData(tx));
    const [art] = await db.select().from(artists).where(eq(artists.id, demoEv!.artistId!));
    expect(art).toBeDefined();
    expect(art!.isDemo).toBe(false);
  });

  it("tohumdan önce var olan sanatçıya dokunulmaz (görseli tohum doldurmuş olsa da)", async () => {
    const [existing] = await db
      .insert(artists)
      .values({ name: "Levent Yüksel", nameKey: artistNameKey("Levent Yüksel"), image: null })
      .returning();

    await seedOnce({ concerts: oneConcert() });
    const [filled] = await db.select().from(artists).where(eq(artists.id, existing!.id));
    expect(filled!.image).toBeTruthy();

    const res = await db.transaction((tx) => purgeDemoData(tx));
    const [after] = await db.select().from(artists).where(eq(artists.id, existing!.id));
    expect(after!.image).toBe(filled!.image);
    expect(res.imagePaths).not.toContain(filled!.image!);
  });

  it("desene uymayan görsel yolu listeye girmez", async () => {
    const { eventIds } = await seedOnce({ concerts: oneConcert() });
    await db.update(events).set({ coverImage: "event/../x.webp" }).where(eq(events.id, eventIds[0]!));

    const res = await db.transaction((tx) => purgeDemoData(tx));
    expect(res.imagePaths).not.toContain("event/../x.webp");
  });

  it("hero WebM videosu silinecekler listesine girer; kapaktaki WebM girmez", async () => {
    const { eventIds } = await seedOnce({ concerts: oneConcert() });
    const id = eventIds[0]!;
    const video = "event/00000000-0000-4000-8000-0000000000e1.webm";
    const coverVideo = "event/00000000-0000-4000-8000-0000000000e2.webm";
    await db.update(events).set({ coverImage: coverVideo }).where(eq(events.id, id));
    await db
      .insert(eventSiteContent)
      .values({ eventId: id, heroImage: video })
      .onConflictDoUpdate({ target: eventSiteContent.eventId, set: { heroImage: video } });

    const res = await db.transaction((tx) => purgeDemoData(tx));
    expect(res.imagePaths).toContain(video);
    expect(res.imagePaths).not.toContain(coverVideo);
  });

  it("demo veri yokken sıfır döner", async () => {
    const res = await db.transaction((tx) => purgeDemoData(tx));
    expect(res).toEqual({ events: 0, orders: 0, imagePaths: [] });
  });
});
