import { beforeEach, describe, expect, it } from "vitest";
import { createCoreClient, type CoreClient, type HoldInput } from "@/lib/core/client";
import { CoreError } from "@/lib/core/errors";
import { createFakeCore, FAKE_IMAGES, type FakeCore } from "../helpers/fake-core";
import type { EventDetail } from "@/lib/core/contract";

const ctx = { clientIp: "203.0.113.7" };
let fake: FakeCore;
let client: CoreClient;
let ev: EventDetail;

const id = (label: string) => {
  const table = ev.plan.tables.find((t) => t.label === label);
  if (!table) throw new Error(`masa yok: ${label}`);
  return table.id;
};
const hold = (label: string, quantity: number): HoldInput => ({
  eventId: ev.id,
  items: [{ tableId: id(label), quantity }],
  clientKey: crypto.randomUUID(),
});

beforeEach(() => {
  fake = createFakeCore();
  client = createCoreClient({
    baseUrl: "http://core.test",
    secret: fake.secret,
    fetch: (input, init) => fake.handle(new Request(input, init)),
  });
  ev = fake.addEvent();
});

const withFetch = (fetchImpl: typeof fetch, timeoutMs?: number) =>
  createCoreClient({ baseUrl: "http://core.test", secret: fake.secret, fetch: fetchImpl, timeoutMs });

const payInput = (lastName: string) => ({
  buyer: { firstName: "Ada", lastName, email: "ada@example.test" },
  acceptTerms: true as const,
  payment: { provider: "demo" as const, action: "approve" as const },
});

describe("çekirdek istemcisi", () => {
  it("her istek Bearer sırrını taşır", async () => {
    await client.listEvents();
    expect(fake.requests.at(-1)?.authorization).toBe(`Bearer ${fake.secret}`);
  });

  it("okuma isteklerinde X-Sales-Client-Ip gönderilmez", async () => {
    await client.listEvents();
    await client.getEvent(ev.id);
    await client.getAvailability(ev.id);
    expect(fake.requests.every((r) => r.clientIp === null)).toBe(true);
  });

  it("yazma isteği güvenilir IP'yi iletir; IP yoksa başlık hiç gönderilmez", async () => {
    await client.createHold(hold("A1", 2), { clientIp: "203.0.113.7" });
    expect(fake.requests.at(-1)?.clientIp).toBe("203.0.113.7");
    await client.createHold(hold("A2", 2), { clientIp: null });
    expect(fake.requests.at(-1)?.clientIp).toBeNull();
  });

  it("409 hata gövdesi kod ve ayrıntıyla CoreError olur", async () => {
    fake.holdAs(ev.id, id("A2"), 6);
    await expect(client.createHold(hold("A2", 3), ctx)).rejects.toMatchObject({
      code: "seats_unavailable",
      status: 409,
      details: { tableId: id("A2"), free: 2 },
    });
  });

  it("429 Retry-After saniyesini taşır", async () => {
    const c = withFetch(
      async () =>
        new Response(JSON.stringify({ error: { code: "rate_limited", message: "x" } }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": "120" },
        }),
    );
    await expect(c.createHold(hold("A1", 2), ctx)).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
      retryAfterSeconds: 120,
    });
  });

  it("ağ hatası core_unreachable olur", async () => {
    const c = withFetch(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(c.listEvents()).rejects.toMatchObject({ code: "core_unreachable", status: 0 });
  });

  it("JSON olmayan 500 core_unreachable olur", async () => {
    const c = withFetch(async () => new Response("<html>hata</html>", { status: 500 }));
    await expect(c.listEvents()).rejects.toMatchObject({ code: "core_unreachable", status: 500 });
  });

  it("sahte çekirdeğin 500 hatası CoreError olur", async () => {
    fake.failNext(/events/, 500);
    const error = await client.listEvents().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CoreError);
    expect(error).toMatchObject({ status: 500 });
  });

  it("bilinmeyen hata kodu core_unreachable olur", async () => {
    const c = withFetch(
      async () =>
        new Response(JSON.stringify({ error: { code: "yeni_kod", message: "x" } }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(c.listEvents()).rejects.toMatchObject({ code: "core_unreachable", status: 400 });
  });

  it("zaman aşımında core_unreachable ile reddeder", async () => {
    const c = withFetch(() => new Promise<Response>(() => {}), 20);
    await expect(c.listEvents()).rejects.toMatchObject({ code: "core_unreachable" });
  });

  it("başlık gelip gövdesi asılan yanıt core_unreachable olur", async () => {
    const hanging = new ReadableStream<Uint8Array>({ start() {} });
    const c = withFetch(async () => new Response(hanging, { status: 200 }), 30);
    await expect(c.listEvents()).rejects.toMatchObject({ code: "core_unreachable" });
  });

  it("yönlendirme izlenmez (redirect: error) ve 30x core_unreachable olur", async () => {
    let seen: RequestInit | undefined;
    const c = withFetch(async (_input, init) => {
      seen = init;
      return new Response(null, { status: 302, headers: { location: "http://baska.test/" } });
    });
    await expect(c.listEvents()).rejects.toMatchObject({ code: "core_unreachable", status: 302 });
    expect(seen?.redirect).toBe("error");
  });

  it("fetch yönlendirmede hata fırlatırsa core_unreachable olur", async () => {
    const c = withFetch(async () => {
      throw new TypeError("redirect mode is set to error");
    });
    await expect(c.getOrder("x")).rejects.toMatchObject({ code: "core_unreachable" });
  });

  it("gövdeye yalnızca bilinen alanlar gider", async () => {
    let captured: unknown;
    const c = withFetch(async (input, init) => {
      captured = JSON.parse(String(init?.body));
      return fake.handle(new Request(input, init));
    });
    const extra = { ...hold("A6", 2), fazla: "x" } as HoldInput;
    await c.createHold(extra, ctx).catch(() => undefined);
    expect(Object.keys(captured as object).sort()).toEqual(["clientKey", "eventId", "items"]);
  });

  it("sipariş belirteci yolda kodlanır", async () => {
    await client.getOrder("a/b.c").catch(() => undefined);
    expect(fake.requests.at(-1)?.path).toBe("/api/sales/v1/orders/a%2Fb.c");
  });

  it("bırakma 204'te değer döndürmez", async () => {
    const o = await client.createHold(hold("A3", 2), ctx);
    await expect(client.releaseOrder(o.orderToken, ctx)).resolves.toBeUndefined();
  });

  it("ödeme gövdesi yalnızca alıcı, onay ve demo eylemi taşır", async () => {
    const o = await client.createHold(hold("A4", 2), ctx);
    let captured: unknown;
    const c = withFetch(async (input, init) => {
      captured = JSON.parse(String(init?.body));
      return fake.handle(new Request(input, init));
    });
    await c.payOrder(o.orderToken, payInput("Test"), ctx);
    expect(Object.keys(captured as object).sort()).toEqual(["acceptTerms", "buyer", "payment"]);
    expect((captured as { payment: unknown }).payment).toEqual({ provider: "demo", action: "approve" });
  });

  it("sorgulama sipariş belirtecini döndürür", async () => {
    const o = await client.createHold(hold("A5", 2), ctx);
    const paid = await client.payOrder(o.orderToken, payInput("Yılmaz"), ctx);
    const found = await client.lookupOrder({ pnr: paid.pnr ?? "", lastName: "Yılmaz" }, ctx);
    expect(found.orderToken).toBe(o.orderToken);
  });

  it("tutma gövdesi seatNos'u yalnızca verildiğinde taşır", async () => {
    const bodies: unknown[] = [];
    const c = withFetch(async (input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return fake.handle(new Request(input, init));
    });
    await c.createHold(hold("A1", 2), ctx);
    await c.createHold(
      { eventId: ev.id, items: [{ tableId: id("A2"), quantity: 2, seatNos: [2, 5] }], clientKey: crypto.randomUUID() },
      ctx,
    );
    const firstItem = (bodies[0] as { items: Record<string, unknown>[] }).items[0]!;
    const secondItem = (bodies[1] as { items: Record<string, unknown>[] }).items[0]!;
    expect(Object.keys(firstItem).sort()).toEqual(["quantity", "tableId"]);
    expect(secondItem).toEqual({ tableId: id("A2"), quantity: 2, seatNos: [2, 5] });
  });

  it("getImage geçerli yolda baytları ve türü döner", async () => {
    fake.addEvent({ coverImage: FAKE_IMAGES.cover });
    const result = await client.getImage(FAKE_IMAGES.cover);
    expect(result.contentType).toBe("image/webp");
    expect(result.body.byteLength).toBeGreaterThan(0);
    const req = fake.requests.at(-1);
    expect(req?.path).toBe(`/api/sales/v1/images/${FAKE_IMAGES.cover}`);
    expect(req?.clientIp).toBeNull();
  });

  it("getImage hero WebM videosunda video/webm türünü döner", async () => {
    fake.addEvent({ site: { heroImage: FAKE_IMAGES.heroVideo } });
    const result = await client.getImage(FAKE_IMAGES.heroVideo);
    expect(result.contentType).toBe("video/webm");
    expect(result.body.byteLength).toBeGreaterThan(0);
  });

  it.each(["logo/x.webp", "event/../a.webp", "event/a.webp", "", "artist/00000000-0000-4000-8000-0000000000a1.webm"])(
    "getImage(%s) çekirdeğe gitmeden reddeder",
    async (badPath) => {
      const before = fake.requests.length;
      await expect(client.getImage(badPath)).rejects.toMatchObject({ code: "event_not_found", status: 404 });
      expect(fake.requests).toHaveLength(before);
    },
  );

  it("getImage 404'te event_not_found verir", async () => {
    await expect(client.getImage("event/00000000-0000-4000-8000-000000000099.webp")).rejects.toMatchObject({
      code: "event_not_found",
      status: 404,
    });
  });
});
