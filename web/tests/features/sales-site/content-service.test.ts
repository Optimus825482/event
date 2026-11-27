import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { artists, eventSiteContent, events } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { getSiteContentView, saveSiteContent } from "@/features/sales-site/content-service";
import { DomainError } from "@/lib/action";
import { managerActor, memberActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createEvent } from "../../helpers/factories";
import { saleEvent } from "../ticketing/fixtures";

const HERO = "event/00000000-0000-4000-8000-000000000012.webp";
const ARTIST_IMG = "artist/00000000-0000-4000-8000-000000000021.webp";
const MISSING_ID = "00000000-0000-4000-8000-000000000999";

const ent = managerActor("entertainment");
const ctx = { now: new Date(), providerActive: true };

describe("sales-site content-service", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("satır yokken tüm içerik alanları null, görsel durumu eksik, sitede değil", async () => {
    const event = await createEvent(db);
    const view = await getSiteContentView(db, ent, event.id, ctx);
    expect(view).toMatchObject({
      eventId: event.id,
      eventName: event.name,
      isDemo: false,
      siteState: null,
      saleMode: "seat",
      coverImage: null,
      heroImage: null,
      artist: null,
      summary: null,
      doorsOpenAt: null,
      ageLimit: null,
      dressCode: null,
      sightlineSet: null,
      images: { status: "missing", missing: ["cover", "hero"] },
    });
  });

  it("kaydedilen içerik okunur; ikinci kayıt günceller, satır tek kalır", async () => {
    const event = await createEvent(db);
    const doors = new Date(event.startsAt.getTime() - 90 * 60_000);
    await saveSiteContent(db, ent, {
      eventId: event.id,
      summary: "Gala",
      doorsOpenAt: doors,
      ageLimit: "18+",
      dressCode: "Şık",
      sightlineSet: "diamond",
    });

    const view = await getSiteContentView(db, ent, event.id, ctx);
    expect(view.summary).toBe("Gala");
    expect(view.doorsOpenAt).toBe(doors.toISOString());
    expect(view.ageLimit).toBe("18+");
    expect(view.dressCode).toBe("Şık");
    expect(view.sightlineSet).toBe("diamond");

    await saveSiteContent(db, ent, {
      eventId: event.id,
      summary: "Yeni",
      doorsOpenAt: null,
      ageLimit: null,
      dressCode: null,
      sightlineSet: null,
    });
    const rows = await db.select().from(eventSiteContent).where(eq(eventSiteContent.eventId, event.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.summary).toBe("Yeni");
  });

  it("metin kaydı hero görselini silmez", async () => {
    const event = await createEvent(db);
    await db.insert(eventSiteContent).values({ eventId: event.id, heroImage: HERO });
    await saveSiteContent(db, ent, {
      eventId: event.id,
      summary: "Gala",
      doorsOpenAt: null,
      ageLimit: null,
      dressCode: null,
      sightlineSet: null,
    });
    const [row] = await db.select().from(eventSiteContent).where(eq(eventSiteContent.eventId, event.id));
    expect(row!.heroImage).toBe(HERO);
    expect(row!.summary).toBe("Gala");
  });

  it("kapı saati etkinlik başlangıcından sonra olamaz", async () => {
    const event = await createEvent(db);
    const afterStart = new Date(event.startsAt.getTime() + 60_000);
    await expect(
      saveSiteContent(db, ent, {
        eventId: event.id,
        summary: null,
        doorsOpenAt: afterStart,
        ageLimit: null,
        dressCode: null,
        sightlineSet: null,
      }),
    ).rejects.toMatchObject({ code: "invalid", message: "Kapı saati etkinlik başlangıcından sonra olamaz" });
  });

  it("sanatçıya bağlı etkinlikte sanatçı adı ve görseli gelir", async () => {
    const [artist] = await db
      .insert(artists)
      .values({ name: "Ajda", nameKey: "ajda", image: ARTIST_IMG })
      .returning();
    const event = await createEvent(db);
    await db.update(events).set({ artistId: artist!.id }).where(eq(events.id, event.id));

    const view = await getSiteContentView(db, ent, event.id, ctx);
    expect(view.artist).toEqual({ id: artist!.id, name: "Ajda", image: ARTIST_IMG });
  });

  it("satıştaki etkinlikte site durumu open, satış şekli ayardan gelir", async () => {
    const { event } = await saleEvent({ settings: { saleMode: "table" } });
    const view = await getSiteContentView(db, ent, event.id, ctx);
    expect(view.siteState).toBe("open");
    expect(view.saleMode).toBe("table");
  });

  it("F&B yöneticisi okur ama kaydedemez; Casino üyesi (events yok) okuyamaz", async () => {
    const event = await createEvent(db);
    const fnb = managerActor("fnb");
    const casino = memberActor("casino", { check_in: "vc--" });

    await expect(getSiteContentView(db, fnb, event.id, ctx)).resolves.toMatchObject({ eventId: event.id });
    await expect(
      saveSiteContent(db, fnb, {
        eventId: event.id,
        summary: "X",
        doorsOpenAt: null,
        ageLimit: null,
        dressCode: null,
        sightlineSet: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getSiteContentView(db, casino, event.id, ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("olmayan etkinlik not_found", async () => {
    await expect(getSiteContentView(db, ent, MISSING_ID, ctx)).rejects.toSatisfy(
      (e: unknown) => e instanceof DomainError && e.code === "not_found",
    );
    await expect(
      saveSiteContent(db, ent, {
        eventId: MISSING_ID,
        summary: null,
        doorsOpenAt: null,
        ageLimit: null,
        dressCode: null,
        sightlineSet: null,
      }),
    ).rejects.toSatisfy((e: unknown) => e instanceof DomainError && e.code === "not_found");
  });
});
