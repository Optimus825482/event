import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCoreClient, type CoreClient } from "@/lib/core/client";
import { createFakeCore, FAKE_IMAGES, FAKE_WEBM_BYTES, type FakeCore } from "../helpers/fake-core";

let client: CoreClient;
let fake: FakeCore;

vi.mock("@/lib/core/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/core/client")>()),
  getCore: () => client,
}));

import { GET } from "@/app/api/gorsel/[kind]/[file]/route";

const call = (kind: string, file: string, headers?: HeadersInit) =>
  GET(new Request(`http://satis.test/api/gorsel/${kind}/${file}`, { headers }), {
    params: Promise.resolve({ kind, file }),
  });

const [coverKind, coverFile] = FAKE_IMAGES.cover.split("/") as [string, string];

describe("GET /api/gorsel/[kind]/[file]", () => {
  beforeEach(() => {
    fake = createFakeCore();
    client = createCoreClient({
      baseUrl: "http://core.test",
      secret: fake.secret,
      fetch: (i, init) => fake.handle(new Request(i, init)),
    });
    fake.addEvent({ coverImage: FAKE_IMAGES.cover });
  });

  it("tohumlanmış görseli önbellek başlıklarıyla verir", async () => {
    const res = await call(coverKind, coverFile);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("hero WebM videosunu video/webm türüyle ve bayt aralığı desteğiyle verir", async () => {
    fake.addEvent({ coverImage: FAKE_IMAGES.cover, site: { heroImage: FAKE_IMAGES.heroVideo } });
    const [kind, file] = FAKE_IMAGES.heroVideo.split("/") as [string, string];

    const full = await call(kind, file);
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("video/webm");
    expect(full.headers.get("accept-ranges")).toBe("bytes");
    expect(full.headers.get("cache-control")).toBe("public, max-age=300");
    expect(new Uint8Array(await full.arrayBuffer())).toEqual(FAKE_WEBM_BYTES);

    const part = await call(kind, file, { range: "bytes=0-3" });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 0-3/${FAKE_WEBM_BYTES.length}`);
    expect(part.headers.get("content-length")).toBe("4");
    expect([...new Uint8Array(await part.arrayBuffer())]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);

    const bad = await call(kind, file, { range: "bytes=999-" });
    expect(bad.status).toBe(416);
    expect(bad.headers.get("content-range")).toBe(`bytes */${FAKE_WEBM_BYTES.length}`);
  });

  it.each([
    ["artist", "00000000-0000-4000-8000-0000000000a1.webm"],
    ["logo", "00000000-0000-4000-8000-0000000000c1.webp"],
    ["event", "..%2Fx.webp"],
    ["event", "a.webp"],
    ["event", "00000000-0000-4000-8000-0000000000c1.png"],
    ["event", ""],
  ])("geçersiz yol %s/%s çekirdeğe gitmeden 404", async (kind, file) => {
    const before = fake.requests.length;
    const res = await call(kind, file);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fake.requests.length).toBe(before);
  });

  it("çekirdekte olmayan görsel 404 ve no-store", async () => {
    const res = await call("artist", "00000000-0000-4000-8000-00000000dead.webp");
    expect([res.status, await res.text(), res.headers.get("cache-control")]).toEqual([404, "", "no-store"]);
  });

  it("çekirdeğe ulaşılamazsa 404 döner (kart metne düşer), 5xx değil", async () => {
    client = createCoreClient({
      baseUrl: "http://core.test",
      secret: fake.secret,
      fetch: () => Promise.reject(new TypeError("ağ yok")),
    });
    expect((await call(coverKind, coverFile)).status).toBe(404);
  });

  it("hiçbir yanıt sırrı ya da çekirdek adresini taşımaz", async () => {
    for (const res of [await call(coverKind, coverFile), await call("event", "a.webp")]) {
      const dump = JSON.stringify([...res.headers]) + new TextDecoder().decode(await res.arrayBuffer());
      expect(dump).not.toContain(fake.secret);
      expect(dump).not.toContain("core.test");
    }
  });
});
