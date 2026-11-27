import { readFile } from "node:fs/promises";
import path from "node:path";
import { asc, count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
  artists,
  eventSaleSettings,
  eventSeatPrices,
  eventSiteContent,
  eventStageTransitions,
  eventTables,
  events,
  notifications,
  servicePoints,
  tableSeatSlots,
  tableTypes,
  venueTemplates,
} from "@/db/schema";
import { artistNameKey } from "@/features/artists/name-key";
import { DEMO_CONCERTS } from "@/features/demo/concerts";
import { DIAMOND_CANVAS, diamondUnits } from "@/features/demo/diamond-plan";
import { seedDemoData } from "@/features/demo/seed";
import { checkPreconditions } from "@/features/planning/preconditions";
import { IMAGE_PATH_PATTERN } from "@/features/sales-api/contract";
import { dateToZonedWallClock } from "@/lib/time-zone";
import { truncateAll } from "../../helpers/db";
import { filesUnder, oneConcert, seedOnce } from "./fixtures";

describe("demo tohumlama servisi", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("etkinlik doğrudan satışta ve yayında, demo işaretli yazılır", async () => {
    const { admin, eventIds } = await seedOnce({
      concerts: oneConcert(),
      now: new Date("2026-11-27T10:00:00Z"),
    });
    expect(eventIds).toHaveLength(1);
    const [ev] = await db.select().from(events).where(eq(events.id, eventIds[0]!));
    expect(ev).toBeDefined();
    expect(ev!.isDemo).toBe(true);
    expect(ev!.status).toBe("published");
    expect(ev!.planningStage).toBe("on_sale");
    expect(ev!.stageChangedAt).not.toBeNull();
    expect(ev!.eventType).toBe("Konser");
    expect(ev!.name).toBe("Levent Yüksel · Aralık Galası");
    expect(ev!.organizerId).toBe(admin.id);
    expect(ev!.reservationEnabled).toBe(false);
    expect(dateToZonedWallClock(ev!.startsAt)).toBe("2026-12-12T22:00");
    expect(ev!.coverImage).toMatch(IMAGE_PATH_PATTERN);
    expect(ev!.coverImage).toMatch(/^event\//);
  });

  it("salon planı: 173 masa, hepsi online, etiketler ve kategoriler plan verisiyle aynı", async () => {
    const { eventIds } = await seedOnce({ concerts: oneConcert() });
    const eventId = eventIds[0]!;
    const [ev] = await db.select().from(events).where(eq(events.id, eventId));
    const tables = await db.select().from(eventTables).where(eq(eventTables.eventId, eventId));

    expect(tables).toHaveLength(173);
    expect(tables.every((t) => t.allocation === "online")).toBe(true);
    expect(tables.every((t) => t.capacity === 12)).toBe(true);
    expect(tables.filter((t) => t.isLoca)).toHaveLength(12);
    expect(new Set(tables.map((t) => t.label))).toEqual(new Set(diamondUnits().map((u) => u.label)));

    const byLabel = new Map(tables.map((t) => [t.label, t]));
    expect(byLabel.get("M-78")!.saleCategory).toBe("vip");
    expect(byLabel.get("M-1")!.saleCategory).toBe("premium");
    expect(byLabel.get("M-161")!.saleCategory).toBe("standard");
    expect(ev!.totalCapacity).toBe(2076);
    expect((ev!.layoutDecor as { width: number }).width).toBe(DIAMOND_CANVAS.width);
  });

  it("her masada 12 numaralı yuva vardır", async () => {
    const { eventIds } = await seedOnce({ concerts: oneConcert() });
    const eventId = eventIds[0]!;
    const [{ value: slotCount }] = await db
      .select({ value: count() })
      .from(tableSeatSlots)
      .where(eq(tableSeatSlots.eventId, eventId));
    expect(Number(slotCount)).toBe(2076);

    const [m1] = await db
      .select()
      .from(eventTables)
      .where(eq(eventTables.label, "M-1"));
    const m1Slots = await db
      .select({ seatNo: tableSeatSlots.seatNo })
      .from(tableSeatSlots)
      .where(eq(tableSeatSlots.tableId, m1!.id))
      .orderBy(asc(tableSeatSlots.seatNo));
    expect(m1Slots.map((s) => s.seatNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("fiyatlar, satış ayarları ve site içeriği yazılır", async () => {
    const { eventIds } = await seedOnce({
      concerts: oneConcert(),
      now: new Date("2026-11-27T10:00:00Z"),
    });
    const eventId = eventIds[0]!;

    const prices = await db.select().from(eventSeatPrices).where(eq(eventSeatPrices.eventId, eventId));
    const priceMap = Object.fromEntries(prices.map((p) => [p.category, p.finalPrice]));
    expect(priceMap).toEqual({
      standard: "7500.00",
      premium: "13875.00",
      vip: "21000.00",
    });

    const [settings] = await db.select().from(eventSaleSettings).where(eq(eventSaleSettings.eventId, eventId));
    expect(settings).toMatchObject({
      saleMode: "seat",
      sharedTables: true,
      locaOnline: true,
      blockSingleLeftover: true,
      holdMinutes: 10,
      maxSeatsPerOrder: 12,
      currency: "TRY",
      saleStartsAt: null,
    });

    const [site] = await db.select().from(eventSiteContent).where(eq(eventSiteContent.eventId, eventId));
    expect(site).toBeDefined();
    expect(site!.sightlineSet).toBe("diamond");
    expect(site!.ageLimit).toBe("18+");
    expect(site!.dressCode).toBe("Şık");
    expect(site!.summary).toBeTruthy();
    expect(site!.heroImage).toMatch(IMAGE_PATH_PATTERN);
    expect(site!.heroImage).toMatch(/^event\//);
    expect(dateToZonedWallClock(site!.doorsOpenAt!)).toBe("2026-12-12T20:00");
  });

  it("satışa açma önkoşulları sağlanır", async () => {
    const { eventIds } = await seedOnce({ concerts: oneConcert() });
    const [ev] = await db.select().from(events).where(eq(events.id, eventIds[0]!));
    expect(await checkPreconditions(db, ev!, "priced")).toEqual([]);
    expect(await checkPreconditions(db, ev!, "on_sale")).toEqual([]);
  });

  it("bildirim, aşama geçmişi, salon şablonu, servis noktası ve masa tipi üretmez", async () => {
    const [{ value: beforeTemplates }] = await db.select({ value: count() }).from(venueTemplates);
    const [{ value: beforeTypes }] = await db.select({ value: count() }).from(tableTypes);

    await seedOnce({ concerts: oneConcert() });

    const [{ value: notifCount }] = await db.select({ value: count() }).from(notifications);
    const [{ value: transCount }] = await db.select({ value: count() }).from(eventStageTransitions);
    const [{ value: spCount }] = await db.select({ value: count() }).from(servicePoints);
    const [{ value: afterTemplates }] = await db.select({ value: count() }).from(venueTemplates);
    const [{ value: afterTypes }] = await db.select({ value: count() }).from(tableTypes);

    expect(Number(notifCount)).toBe(0);
    expect(Number(transCount)).toBe(0);
    expect(Number(spCount)).toBe(0);
    expect(afterTemplates).toBe(beforeTemplates);
    expect(afterTypes).toBe(beforeTypes);
  });

  it("görseller normal yükleme yolundan geçer", async () => {
    const { ctx } = await seedOnce({ concerts: oneConcert() });
    const files = await filesUnder(ctx.uploadRoot);
    expect(files).toHaveLength(3);
    expect(files.filter((f) => f.startsWith("event/"))).toHaveLength(2);
    expect(files.filter((f) => f.startsWith("artist/"))).toHaveLength(1);
    expect([...ctx.written].sort()).toEqual(files);

    for (const rel of files) {
      expect(rel).toMatch(IMAGE_PATH_PATTERN);
      const buf = await readFile(path.join(ctx.uploadRoot, rel));
      expect(buf.subarray(0, 4).toString("latin1")).toBe("RIFF");
      expect(buf.subarray(8, 12).toString("latin1")).toBe("WEBP");
    }
  });

  it("sanatçı yoksa demo işaretli oluşturulur", async () => {
    const { eventIds } = await seedOnce({ concerts: oneConcert() });
    const [ev] = await db.select().from(events).where(eq(events.id, eventIds[0]!));
    const [artist] = await db.select().from(artists).where(eq(artists.id, ev!.artistId!));
    expect(artist).toBeDefined();
    expect(artist!.name).toBe("Levent Yüksel");
    expect(artist!.nameKey).toBe(artistNameKey("Levent Yüksel"));
    expect(artist!.isDemo).toBe(true);
    expect(artist!.image).toMatch(/^artist\//);
    expect(ev!.artistName).toBe("Levent Yüksel");
  });

  it("aynı ad anahtarlı sanatçı varsa o kullanılır; dolu görseline ve demo işaretine dokunulmaz", async () => {
    const existingImg = "artist/00000000-0000-4000-8000-0000000000a1.webp";
    const [existing] = await db
      .insert(artists)
      .values({
        name: "LEVENT  yüksel",
        nameKey: artistNameKey("Levent Yüksel"),
        image: existingImg,
        isActive: false,
      })
      .returning();

    const { ctx, eventIds } = await seedOnce({ concerts: oneConcert() });
    const allArtists = await db.select().from(artists);
    expect(allArtists).toHaveLength(1);
    expect(allArtists[0]!.image).toBe(existingImg);
    expect(allArtists[0]!.isDemo).toBe(false);

    const [ev] = await db.select().from(events).where(eq(events.id, eventIds[0]!));
    expect(ev!.artistId).toBe(existing!.id);
    const files = await filesUnder(ctx.uploadRoot);
    expect(files.filter((f) => f.startsWith("artist/"))).toHaveLength(0);
  });

  it("var olan sanatçının görseli boşsa doldurulur, demo işareti açılmaz", async () => {
    await db.insert(artists).values({
      name: "Levent Yüksel",
      nameKey: artistNameKey("Levent Yüksel"),
      image: null,
    });

    await seedOnce({ concerts: oneConcert() });
    const [artist] = await db.select().from(artists);
    expect(artist!.image).toMatch(/^artist\//);
    expect(artist!.isDemo).toBe(false);
  });

  it("demo etkinlik varken ikinci çağrı hiçbir şey eklemez", async () => {
    const { admin, ctx } = await seedOnce({ concerts: oneConcert() });
    const beforeFiles = await filesUnder(ctx.uploadRoot);

    const second = await db.transaction((tx) => seedDemoData(tx, admin, ctx));
    expect(second).toEqual({ seeded: false, eventIds: [] });

    const [{ value: evCount }] = await db.select({ value: count() }).from(events);
    const [{ value: tblCount }] = await db.select({ value: count() }).from(eventTables);
    const [{ value: artCount }] = await db.select({ value: count() }).from(artists);
    expect(Number(evCount)).toBe(1);
    expect(Number(tblCount)).toBe(173);
    expect(Number(artCount)).toBe(1);
    expect(await filesUnder(ctx.uploadRoot)).toEqual(beforeFiles);
  });

  it("tam küme: beş etkinlik, beş sanatçı, on beş görsel", async () => {
    const { ctx } = await seedOnce();
    const demoEvents = await db
      .select()
      .from(events)
      .where(eq(events.isDemo, true))
      .orderBy(asc(events.startsAt));
    const [{ value: tblCount }] = await db.select({ value: count() }).from(eventTables);

    expect(demoEvents).toHaveLength(5);
    expect(demoEvents.map((e) => e.name)).toEqual(DEMO_CONCERTS.map((c) => c.name));
    expect(Number(tblCount)).toBe(865);
    expect(ctx.written).toHaveLength(15);
  });
});
