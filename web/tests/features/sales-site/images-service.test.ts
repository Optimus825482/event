import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { artists, eventSiteContent, events } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import { saveSiteContent } from "@/features/sales-site/content-service";
import { removeSiteImage, replaceSiteImage } from "@/features/sales-site/images-service";
import { DomainError } from "@/lib/action";
import { managerActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createEvent } from "../../helpers/factories";
import { WEBM_BYTES } from "../../helpers/webm";

const ent = managerActor("entertainment");
const fnb = managerActor("fnb");

let tmpRoot = "";
let pngBytes: Buffer;

function exists(rel: string): boolean {
  return existsSync(path.join(tmpRoot, rel));
}

function makePngFile(name = "gorsel.png"): File {
  return new File([new Uint8Array(pngBytes)], name, { type: "image/png" });
}

function makeWebmFile(name = "tanitim.webm"): File {
  return new File([new Uint8Array(WEBM_BYTES)], name, { type: "video/webm" });
}

describe("sales-site images-service", () => {
  beforeAll(async () => {
    tmpRoot = mkdtempSync(path.join(os.tmpdir(), "sales-site-img-"));
    pngBytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#c9a227" } }).png().toBuffer();
  });

  afterAll(() => {
    if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await truncateAll();
    for (const dir of ["event", "artist"]) {
      rmSync(path.join(tmpRoot, dir), { recursive: true, force: true });
    }
  });

  it("kapak yüklenir: event/<uuid>.webp yazılır, sütun dolar", async () => {
    const event = await createEvent(db);
    const res = await replaceSiteImage(db, ent, { eventId: event.id, slot: "cover" }, makePngFile(), tmpRoot);
    expect(res.slot).toBe("cover");
    expect(res.path).toMatch(/^event\/[0-9a-f-]{36}\.webp$/);
    expect(exists(res.path)).toBe(true);
    const [row] = await db.select().from(events).where(eq(events.id, event.id));
    expect(row!.coverImage).toBe(res.path);
  });

  it("kapak değişince eski dosya silinir", async () => {
    const event = await createEvent(db);
    const first = await replaceSiteImage(db, ent, { eventId: event.id, slot: "cover" }, makePngFile(), tmpRoot);
    const second = await replaceSiteImage(db, ent, { eventId: event.id, slot: "cover" }, makePngFile(), tmpRoot);
    expect(exists(first.path)).toBe(false);
    expect(exists(second.path)).toBe(true);
  });

  it("hero yükleme satır yokken satırı yaratır, varken metin alanlarını korur", async () => {
    const event1 = await createEvent(db);
    const r1 = await replaceSiteImage(db, ent, { eventId: event1.id, slot: "hero" }, makePngFile(), tmpRoot);
    const [s1] = await db.select().from(eventSiteContent).where(eq(eventSiteContent.eventId, event1.id));
    expect(s1!.heroImage).toBe(r1.path);

    const event2 = await createEvent(db);
    await saveSiteContent(db, ent, {
      eventId: event2.id,
      summary: "Gala",
      doorsOpenAt: null,
      ageLimit: null,
      dressCode: null,
      sightlineSet: null,
    });
    const r2 = await replaceSiteImage(db, ent, { eventId: event2.id, slot: "hero" }, makePngFile(), tmpRoot);
    const [s2] = await db.select().from(eventSiteContent).where(eq(eventSiteContent.eventId, event2.id));
    expect(s2!.summary).toBe("Gala");
    expect(s2!.heroImage).toBe(r2.path);
  });

  it("hero WebM video kabul eder: event/<uuid>.webm olduğu gibi yazılır, sütun dolar", async () => {
    const event = await createEvent(db);
    const res = await replaceSiteImage(db, ent, { eventId: event.id, slot: "hero" }, makeWebmFile(), tmpRoot);
    expect(res.path).toMatch(/^event\/[0-9a-f-]{36}\.webm$/);
    expect(exists(res.path)).toBe(true);
    const [row] = await db.select().from(eventSiteContent).where(eq(eventSiteContent.eventId, event.id));
    expect(row!.heroImage).toBe(res.path);
  });

  it("hero videosu görselle değiştirilince ve kaldırılınca eski dosya silinir", async () => {
    const event = await createEvent(db);
    const video = await replaceSiteImage(db, ent, { eventId: event.id, slot: "hero" }, makeWebmFile(), tmpRoot);
    const image = await replaceSiteImage(db, ent, { eventId: event.id, slot: "hero" }, makePngFile(), tmpRoot);
    expect(exists(video.path)).toBe(false);
    expect(exists(image.path)).toBe(true);

    const video2 = await replaceSiteImage(db, ent, { eventId: event.id, slot: "hero" }, makeWebmFile(), tmpRoot);
    expect(exists(image.path)).toBe(false);
    await removeSiteImage(db, ent, { eventId: event.id, slot: "hero" }, tmpRoot);
    expect(exists(video2.path)).toBe(false);
  });

  it.each(["cover", "artist"] as const)("%s alanı WebM kabul etmez", async (slot) => {
    const [artist] = await db.insert(artists).values({ name: "Sezen", nameKey: "sezen" }).returning();
    const event = await createEvent(db);
    await db.update(events).set({ artistId: artist!.id }).where(eq(events.id, event.id));
    await expect(replaceSiteImage(db, ent, { eventId: event.id, slot }, makeWebmFile(), tmpRoot)).rejects.toMatchObject({
      code: "invalid",
      message: "Yalnızca JPG, PNG veya WebP görüntüleri yüklenebilir",
    });
  });

  it("hero alanında görüntü ya da WebM olmayan dosya videoyu da anan iletiyle reddedilir", async () => {
    const event = await createEvent(db);
    const bad = new File(["metin"], "a.webm", { type: "video/webm" });
    await expect(replaceSiteImage(db, ent, { eventId: event.id, slot: "hero" }, bad, tmpRoot)).rejects.toMatchObject({
      code: "invalid",
      message: "Yalnızca JPG, PNG, WebP görüntüsü veya WebM video yüklenebilir",
    });
  });

  it("sanatçı görseli artist/ altına yazılır ve sanatçı kaydına işlenir", async () => {
    const [artist] = await db.insert(artists).values({ name: "Tarkan", nameKey: "tarkan" }).returning();
    const event = await createEvent(db);
    await db.update(events).set({ artistId: artist!.id }).where(eq(events.id, event.id));

    const res = await replaceSiteImage(db, ent, { eventId: event.id, slot: "artist" }, makePngFile(), tmpRoot);
    expect(res.path).toMatch(/^artist\/[0-9a-f-]{36}\.webp$/);
    expect(exists(res.path)).toBe(true);
    const [updated] = await db.select().from(artists).where(eq(artists.id, artist!.id));
    expect(updated!.image).toBe(res.path);
  });

  it("sanatçıya bağlı olmayan etkinlikte sanatçı görseli reddedilir ve dosya yazılmaz", async () => {
    const event = await createEvent(db);
    await expect(
      replaceSiteImage(db, ent, { eventId: event.id, slot: "artist" }, makePngFile(), tmpRoot),
    ).rejects.toSatisfy((e: unknown) => e instanceof DomainError && e.code === "conflict");
    const artistDir = path.join(tmpRoot, "artist");
    expect(existsSync(artistDir) ? readdirSync(artistDir) : []).toHaveLength(0);
  });

  it("görüntü olmayan dosya invalid ile reddedilir", async () => {
    const event = await createEvent(db);
    const bad = new File(["metin"], "a.png", { type: "image/png" });
    await expect(replaceSiteImage(db, ent, { eventId: event.id, slot: "cover" }, bad, tmpRoot)).rejects.toMatchObject({
      code: "invalid",
      message: "Yalnızca JPG, PNG veya WebP görüntüleri yüklenebilir",
    });
  });

  it("başka satırın da kullandığı eski dosya silinmez", async () => {
    const shared = "event/00000000-0000-4000-8000-000000000055.webp";
    mkdirSync(path.join(tmpRoot, "event"), { recursive: true });
    writeFileSync(path.join(tmpRoot, shared), pngBytes);

    const e1 = await createEvent(db);
    const e2 = await createEvent(db);
    await db.update(events).set({ coverImage: shared }).where(eq(events.id, e1.id));
    await db.update(events).set({ coverImage: shared }).where(eq(events.id, e2.id));

    await replaceSiteImage(db, ent, { eventId: e1.id, slot: "cover" }, makePngFile(), tmpRoot);
    expect(exists(shared)).toBe(true);
  });

  it("veritabanı yazımı başarısız olursa yeni dosya geri alınır", async () => {
    const event = await createEvent(db);
    const failingDb = {
      select: db.select.bind(db),
      update: () => {
        throw new Error("db boom");
      },
    } as unknown as typeof db;

    await expect(
      replaceSiteImage(failingDb, ent, { eventId: event.id, slot: "cover" }, makePngFile(), tmpRoot),
    ).rejects.toThrow("db boom");
    const eventDir = path.join(tmpRoot, "event");
    expect(existsSync(eventDir) ? readdirSync(eventDir) : []).toHaveLength(0);
  });

  it("kaldırma sütunu boşaltır ve dosyayı siler; boş yuvada sessizce geçer", async () => {
    const event = await createEvent(db);
    const uploaded = await replaceSiteImage(db, ent, { eventId: event.id, slot: "cover" }, makePngFile(), tmpRoot);
    expect(exists(uploaded.path)).toBe(true);

    await removeSiteImage(db, ent, { eventId: event.id, slot: "cover" }, tmpRoot);
    const [row] = await db.select().from(events).where(eq(events.id, event.id));
    expect(row!.coverImage).toBeNull();
    expect(exists(uploaded.path)).toBe(false);

    await expect(removeSiteImage(db, ent, { eventId: event.id, slot: "cover" }, tmpRoot)).resolves.toEqual({
      slot: "cover",
    });
  });

  it("events:edit olmayan aktör yükleyemez ve kaldıramaz", async () => {
    const event = await createEvent(db);
    await expect(
      replaceSiteImage(db, fnb, { eventId: event.id, slot: "cover" }, makePngFile(), tmpRoot),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(removeSiteImage(db, fnb, { eventId: event.id, slot: "cover" }, tmpRoot)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const eventDir = path.join(tmpRoot, "event");
    expect(existsSync(eventDir) ? readdirSync(eventDir) : []).toHaveLength(0);
  });
});
