import { beforeEach, describe, expect, it } from "vitest";
import { demoNoticeFor } from "@/features/checkout/demo";
import { payFlow, releaseFlow } from "@/features/checkout/flows";
import { createCoreClient, type CoreClient } from "@/lib/core/client";
import type { EventDetail } from "@/lib/core/contract";
import { CoreError } from "@/lib/core/errors";
import { createFakeCore, type FakeCore } from "../../helpers/fake-core";

const ctx = { clientIp: "203.0.113.7" };
const form = { firstName: " Ayşe ", lastName: "Kaya", email: "ayse@example.com", phone: "", acceptTerms: true };
let fake: FakeCore;
let core: CoreClient;
let ev: EventDetail;
let sent: unknown[];

const tableId = (label: string) => ev.plan.tables.find((t) => t.label === label)!.id;
async function pendingOrder(label = "A1", quantity = 2): Promise<string> {
  const order = await core.createHold({ eventId: ev.id, items: [{ tableId: tableId(label), quantity }], clientKey: crypto.randomUUID() }, ctx);
  return order.orderToken;
}

beforeEach(() => {
  fake = createFakeCore();
  sent = [];
  core = createCoreClient({
    baseUrl: "http://core.test",
    secret: fake.secret,
    fetch: async (input, init) => {
      const request = new Request(input, init);
      if (request.method === "POST" && request.url.endsWith("/pay")) sent.push(await request.clone().json());
      return fake.handle(request);
    },
  });
  ev = fake.addEvent();
});

describe("payFlow", () => {
  it("onaylanan ödeme paid döner; ad kırpılır, boş telefon gönderilmez", async () => {
    const token = await pendingOrder();
    expect(await payFlow(core, token, form, "approve", ctx)).toEqual({ ok: true, data: { status: "paid" } });
    expect(sent).toEqual([
      {
        buyer: { firstName: "Ayşe", lastName: "Kaya", email: "ayse@example.com" },
        acceptTerms: true,
        payment: { provider: "demo", action: "approve" },
      },
    ]);
  });

  it("onay kutusu işaretsizse çekirdeğe gidilmez", async () => {
    const token = await pendingOrder();
    const before = fake.requests.length;
    const res = await payFlow(core, token, { ...form, acceptTerms: false }, "approve", ctx);
    expect(res).toMatchObject({ ok: false, code: "invalid", fieldErrors: { acceptTerms: "Devam etmek için metinleri onaylamalısınız" } });
    expect(fake.requests.length).toBe(before);
  });

  it("alan hataları Türkçe döner", async () => {
    const token = await pendingOrder();
    const res = await payFlow(core, token, { ...form, email: "x", firstName: "" }, "approve", ctx);
    expect(res).toMatchObject({ ok: false, code: "invalid", fieldErrors: { firstName: "Ad gerekli", email: "Geçerli bir e-posta girin" } });
  });

  it("uzun alanlar Türkçe hata verir", async () => {
    const token = await pendingOrder();
    const res = await payFlow(core, token, { ...form, lastName: "k".repeat(101), phone: "5".repeat(31) }, "approve", ctx);
    expect(res).toMatchObject({
      ok: false,
      fieldErrors: { lastName: "Soyad en fazla 100 karakter olabilir", phone: "Telefon en fazla 30 karakter olabilir" },
    });
  });

  it("dolu telefon kırpılarak çekirdeğe gider", async () => {
    const token = await pendingOrder();
    await payFlow(core, token, { ...form, phone: " 0533 111 22 33 " }, "approve", ctx);
    expect(sent[0]).toMatchObject({ buyer: { phone: "0533 111 22 33" } });
  });

  it("kart alanı taşıyan gövde reddedilir", async () => {
    const token = await pendingOrder();
    const before = fake.requests.length;
    const res = await payFlow(core, token, { ...form, cardNumber: "4111111111111111" }, "approve", ctx);
    expect(res).toMatchObject({ ok: false, code: "invalid" });
    expect(fake.requests.length).toBe(before);
  });

  it("reddedilen ödeme sonrası sipariş bekler ve yeniden ödenebilir", async () => {
    const token = await pendingOrder();
    expect(await payFlow(core, token, form, "decline", ctx)).toEqual({
      ok: false,
      code: "payment_declined",
      message: "Ödeme reddedildi. Süreniz dolana kadar yeniden deneyebilirsiniz.",
    });
    expect((await core.getOrder(token)).status).toBe("pending");
    expect(await payFlow(core, token, form, "approve", ctx)).toEqual({ ok: true, data: { status: "paid" } });
  });

  it("çift ödeme isteği tek PNR üretir", async () => {
    const token = await pendingOrder();
    const [a, b] = await Promise.all([payFlow(core, token, form, "approve", ctx), payFlow(core, token, form, "approve", ctx)]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    const order = await core.getOrder(token);
    expect(order.pnr).toEqual(expect.any(String));
    expect((await core.getOrder(token)).pnr).toBe(order.pnr);
  });

  it("süresi dolan sipariş ödenemez", async () => {
    const token = await pendingOrder();
    fake.expireOrder(token);
    expect(await payFlow(core, token, form, "approve", ctx)).toMatchObject({ ok: false, code: "hold_expired" });
  });

  it("çekirdeğin invalid yanıtındaki alan hataları alan adlarıyla eşlenir", async () => {
    const stub = {
      payOrder: () => Promise.reject(new CoreError("invalid", 400, { fieldErrors: { "buyer.email": ["Geçersiz"], bilinmeyen: ["x"] } })),
    };
    const res = await payFlow(stub, "tok.enxxxxxxxxxxxxxxxxxx", form, "approve", ctx);
    expect(res).toMatchObject({ ok: false, code: "invalid", fieldErrors: { email: "Geçerli bir e-posta girin" } });
    expect(res).not.toHaveProperty("fieldErrors.bilinmeyen");
  });
});

describe("releaseFlow", () => {
  it("bırakma sandalyeleri geri verir; ödenmiş sipariş bırakılamaz", async () => {
    const token = await pendingOrder("A2", 3);
    expect(fake.free(ev.id, tableId("A2"))).toBe(5);
    expect(await releaseFlow(core, token, ctx)).toEqual({ ok: true, data: null });
    expect(fake.free(ev.id, tableId("A2"))).toBe(8);

    const paid = await pendingOrder("A3", 2);
    await payFlow(core, paid, form, "approve", ctx);
    expect(await releaseFlow(core, paid, ctx)).toMatchObject({ ok: false, code: "already_paid" });
  });
});

describe("demoNoticeFor", () => {
  it("demoNotice yoksa etkinlik demo ise sabit metin", () => {
    expect(demoNoticeFor({ demoNotice: null, isDemo: false }, true)).toBe("DEMO - gerçek ödeme alınmadı");
    expect(demoNoticeFor({ demoNotice: null, isDemo: false }, false)).toBeNull();
    expect(demoNoticeFor({ demoNotice: "DEMO - gerçek ödeme alınmadı", isDemo: true }, false)).toBe("DEMO - gerçek ödeme alınmadı");
  });
});
