import { beforeEach, describe, expect, it } from "vitest";
import { LOOKUP_FAILED, lookupFlow } from "@/features/ticket/lookup";
import { formatPnr } from "@/features/ticket/pnr";
import { createCoreClient, type CoreClient } from "@/lib/core/client";
import type { EventDetail } from "@/lib/core/contract";
import { createFakeCore, type FakeCore } from "../../helpers/fake-core";

const ctx = { clientIp: "203.0.113.7" };
let fake: FakeCore;
let core: CoreClient;
let ev: EventDetail;
let pnr: string;
let orderToken: string;
let lastBody: unknown;
let fetchImpl: (request: Request) => Promise<Response>;

beforeEach(async () => {
  fake = createFakeCore();
  fetchImpl = async (request) => {
    if (request.url.endsWith("/orders/lookup")) lastBody = await request.clone().json();
    return fake.handle(request);
  };
  core = createCoreClient({ baseUrl: "http://core.test", secret: fake.secret, fetch: (i, init) => fetchImpl(new Request(i, init)) });
  ev = fake.addEvent();
  const table = ev.plan.tables.find((t) => t.label === "A1")!;
  const hold = await core.createHold({ eventId: ev.id, items: [{ tableId: table.id, quantity: 2 }], clientKey: crypto.randomUUID() }, ctx);
  const paid = await core.payOrder(
    hold.orderToken,
    { buyer: { firstName: "Ayşe", lastName: "Kaya", email: "ayse@example.com" }, acceptTerms: true, payment: { provider: "demo", action: "approve" } },
    ctx,
  );
  pnr = paid.pnr!;
  orderToken = paid.orderToken;
});

describe("lookupFlow", () => {
  it("doğru PNR ve soyadla belirteç döner (tireli, küçük harf de olur)", async () => {
    expect(await lookupFlow(core, { pnr: formatPnr(pnr).toLowerCase(), lastName: "kaya" }, ctx)).toEqual({
      ok: true,
      data: { orderToken },
    });
  });

  it("yanlış soyad ile bilinmeyen PNR birebir aynı sonucu verir", async () => {
    const wrongName = await lookupFlow(core, { pnr, lastName: "Demir" }, ctx);
    const unknown = await lookupFlow(core, { pnr: "ZZZZ9999", lastName: "Kaya" }, ctx);
    expect(wrongName).toEqual({ ok: false, code: "order_not_found", message: LOOKUP_FAILED });
    expect(LOOKUP_FAILED).toBe("PNR ya da soyad hatalı.");
    expect(unknown).toEqual(wrongName);
  });

  it("boş alanlar çekirdeğe gitmez", async () => {
    const before = fake.requests.length;
    const result = await lookupFlow(core, { pnr: " ", lastName: "" }, ctx);
    expect(result).toMatchObject({ ok: false, code: "invalid", fieldErrors: { pnr: "PNR gerekli", lastName: "Soyad gerekli" } });
    expect(fake.requests.length).toBe(before);
  });

  it("hız sınırı süreyle iletilir", async () => {
    fetchImpl = async () =>
      new Response(JSON.stringify({ error: { code: "rate_limited", message: "x" } }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "600" },
      });
    expect(await lookupFlow(core, { pnr, lastName: "Kaya" }, ctx)).toEqual({
      ok: false,
      code: "rate_limited",
      message: "Çok fazla deneme yapıldı. 10 dakika sonra tekrar deneyin.",
      retryAfterSeconds: 600,
    });
  });

  it("PNR çekirdeğe boşluksuz, tiresiz ve büyük harfle gider", async () => {
    await lookupFlow(core, { pnr: ` ${formatPnr(pnr).toLowerCase()} `, lastName: "Kaya" }, ctx);
    const body = lastBody;
    expect(body).toEqual({ pnr, lastName: "Kaya" });
  });

  it("arama güvenilir IP'yi iletir", async () => {
    await lookupFlow(core, { pnr, lastName: "Kaya" }, { clientIp: "203.0.113.9" });
    expect(fake.requests.at(-1)?.clientIp).toBe("203.0.113.9");
  });
});
