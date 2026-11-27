import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as routeGet } from "@/app/api/sales/v1/images/[kind]/[file]/route";
import { db } from "@/db/client";
import { artists, eventSiteContent, events } from "@/db/schema";
import { createSalesImageHandler, type SalesImageDeps } from "@/features/sales-api/images";
import { truncateAll } from "../../helpers/db";
import { bodyOf, req, TEST_SECRET } from "../sales-api/fixtures";
import { saleEvent } from "../ticketing/fixtures";
import { WEBM_BYTES } from "../../helpers/webm";

const ID = "abcdef00-0000-4000-8000-000000000001";
const COVER = "event/00000000-0000-4000-8000-000000000011.webp";
const HERO = "event/00000000-0000-4000-8000-000000000012.webp";
const COVER2 = "event/00000000-0000-4000-8000-000000000013.webp";
const ORPHAN = "event/00000000-0000-4000-8000-000000000014.webp";
const MISSING = "event/00000000-0000-4000-8000-000000000099.webp";
const ARTIST = "artist/00000000-0000-4000-8000-000000000021.webp";
const ARTIST2 = "artist/00000000-0000-4000-8000-000000000022.webp";
const LOGO = `logo/${ID}.webp`;
const HERO_VIDEO = "event/00000000-0000-4000-8000-000000000015.webm";

let tmpRoot = "";

const handler = (o: Partial<SalesImageDeps> = {}) =>
  createSalesImageHandler({ db, secret: TEST_SECRET, root: tmpRoot, ...o });

const get = (h: ReturnType<typeof handler>, p: string, auth?: string | null) => {
  const [kind = "", file = ""] = p.split("/");
  return h(req("GET", `/api/sales/v1/images/${p}`, { auth }), kind, file);
};

async function attachImages(
  eventId: string,
  o: { cover?: string; hero?: string; artist?: string; artistName?: string } = {},
) {
  let artistId: string | null = null;
  if (o.artist) {
    const [row] = await db
      .insert(artists)
      .values({
        name: o.artistName ?? "Sanatçı",
        nameKey: (o.artistName ?? "sanatci").toLowerCase(),
        image: o.artist,
      })
      .returning();
    artistId = row!.id;
  }
  await db
    .update(events)
    .set({ coverImage: o.cover ?? null, artistId })
    .where(eq(events.id, eventId));
  if (o.hero) {
    await db.insert(eventSiteContent).values({ eventId, heroImage: o.hero });
  }
}

describe("GET /api/sales/v1/images/{kind}/{file}", () => {
  beforeAll(async () => {
    tmpRoot = mkdtempSync(path.join(os.tmpdir(), "sales-img-"));
    const webp = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#d4af37" } }).webp().toBuffer();
    for (const dir of ["event", "artist", "logo"]) mkdirSync(path.join(tmpRoot, dir), { recursive: true });
    for (const rel of [COVER, HERO, COVER2, ORPHAN, ARTIST, ARTIST2, LOGO]) {
      writeFileSync(path.join(tmpRoot, rel), webp);
    }
    writeFileSync(path.join(tmpRoot, HERO_VIDEO), WEBM_BYTES);
  });

  afterAll(() => {
    if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it("sırsız istek 401, sır tanımsızken 503; veritabanına dokunmaz", async () => {
    const spyDb = new Proxy(db, {
      get() {
        throw new Error("veritabanına dokunuldu");
      },
    }) as typeof db;
    expect((await get(handler({ db: spyDb }), COVER, null)).status).toBe(401);
    expect((await get(handler({ db: spyDb }), COVER, "Bearer yanlis")).status).toBe(401);
    expect((await get(handler({ db: spyDb, secret: undefined }), COVER)).status).toBe(503);
  });

  it("satıştaki etkinliğin kapak, hero ve sanatçı görseli verilir", async () => {
    const { event } = await saleEvent();
    await attachImages(event.id, { cover: COVER, hero: HERO, artist: ARTIST, artistName: "Gala Sanatçı" });
    for (const p of [COVER, HERO, ARTIST]) {
      const res = await get(handler(), p);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/webp");
      expect(res.headers.get("cache-control")).toBe("private, max-age=300");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
    }
  });

  it("hero WebM videosu video/webm türüyle ve bayt aralığıyla verilir", async () => {
    const { event } = await saleEvent();
    await attachImages(event.id, { cover: COVER, hero: HERO_VIDEO });
    const full = await get(handler(), HERO_VIDEO);
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("video/webm");
    expect(full.headers.get("accept-ranges")).toBe("bytes");
    expect(full.headers.get("cache-control")).toBe("private, max-age=300");
    expect(Buffer.from(await full.arrayBuffer()).equals(WEBM_BYTES)).toBe(true);

    const [kind = "", file = ""] = HERO_VIDEO.split("/");
    const ranged = new Request(`http://localhost/api/sales/v1/images/${HERO_VIDEO}`, {
      headers: { authorization: `Bearer ${TEST_SECRET}`, range: "bytes=0-3" },
    });
    const part = await handler()(ranged, kind, file);
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 0-3/${WEBM_BYTES.length}`);
    expect([...new Uint8Array(await part.arrayBuffer())]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  });

  it("WebM yalnızca hero alanında geçerlidir: kapak sütunundaki WebM 404", async () => {
    const { event } = await saleEvent();
    await attachImages(event.id, { cover: HERO_VIDEO });
    const res = await get(handler(), HERO_VIDEO);
    expect(res.status).toBe(404);
  });

  it("satışı kapanmış yayımlanmış etkinliğin görseli de verilir", async () => {
    const { event } = await saleEvent({ stage: "sales_closed" });
    await attachImages(event.id, { cover: COVER2 });
    const res = await get(handler(), COVER2);
    expect(res.status).toBe(200);
  });

  it.each([
    ["taslak etkinlik", { status: "draft" }],
    ["satışa açılmamış aşama", { stage: "defined" }],
  ] as const)("%s görseli 404 event_not_found", async (_label, opts) => {
    const { event } = await saleEvent(opts);
    await attachImages(event.id, { cover: COVER, hero: HERO, artist: ARTIST, artistName: "Taslak Sanatçı" });
    for (const p of [COVER, HERO, ARTIST]) {
      const res = await get(handler(), p);
      expect(res.status).toBe(404);
      expect((await bodyOf<{ error: { code: string } }>(res)).error.code).toBe("event_not_found");
    }
  });

  it("hiçbir satıra bağlı olmayan dosya 404", async () => {
    const res = await get(handler(), ORPHAN);
    expect(res.status).toBe(404);
    expect((await bodyOf<{ error: { code: string } }>(res)).error.code).toBe("event_not_found");
  });

  it("görünür etkinliğe bağlı olmayan sanatçının görseli 404", async () => {
    const { event } = await saleEvent({ status: "draft" });
    await attachImages(event.id, { artist: ARTIST2, artistName: "Gizli Sanatçı" });
    const res = await get(handler(), ARTIST2);
    expect(res.status).toBe(404);
  });

  it("satır var ama dosya diskte yoksa 404", async () => {
    const { event } = await saleEvent();
    await attachImages(event.id, { cover: MISSING });
    const res = await get(handler(), MISSING);
    expect(res.status).toBe(404);
  });

  it.each([
    `logo/${ID}.webp`,
    `invitation/${ID}.webp`,
    "event/../x.webp",
    "event/a.webp",
    `event/${ID.toUpperCase()}.webp`,
    `event/${ID}.png`,
    `artist/${ID}.webm`,
    `event/${ID}.mkv`,
  ])("%s veritabanına gitmeden 404", async (p) => {
    const spyDb = new Proxy(db, {
      get() {
        throw new Error("veritabanına dokunuldu");
      },
    }) as typeof db;
    const res = await get(handler({ db: spyDb }), p);
    expect(res.status).toBe(404);
    expect((await bodyOf<{ error: { code: string } }>(res)).error.code).toBe("event_not_found");
  });

  it("rota dosyası işleyiciye bağlıdır", async () => {
    const res = await routeGet(req("GET", `/api/sales/v1/images/event/${ID}.webp`, { auth: null }), {
      params: Promise.resolve({ kind: "event", file: `${ID}.webp` }),
    });
    expect([401, 503]).toContain(res.status);
  });
});
