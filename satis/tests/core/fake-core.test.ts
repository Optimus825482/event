import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Availability, EventDetail, OrderResponse } from "@/lib/core/contract";
import { createFakeCore, type FakeCore } from "../helpers/fake-core";

const API = "/api/sales/v1";
const BUYER = { firstName: "Ayşe", lastName: "ılgaz", email: "ayse@example.test" };
const payBody = (action: "approve" | "decline", acceptTerms = true) => ({
  buyer: BUYER,
  acceptTerms,
  payment: { provider: "demo", action },
});

let fake: FakeCore;
let event: EventDetail;

const call = (
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = { authorization: `Bearer ${fake.secret}` },
) =>
  fake.handle(
    new Request(`http://core.test${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

const tableId = (label: string) => event.plan.tables.find((t) => t.label === label)!.id;
const hold = (label: string, quantity: number, clientKey: string = randomUUID()) =>
  call("POST", `${API}/orders`, { eventId: event.id, items: [{ tableId: tableId(label), quantity }], clientKey });

beforeEach(() => {
  fake = createFakeCore();
  event = fake.addEvent();
});

describe("sahte çekirdek", () => {
  it("sırsız istek 401 unauthorized döner", async () => {
    const res = await call("GET", `${API}/events`, undefined, {});
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("liste ve ayrıntı: masalar sözleşme alanlarını taşır, satılamaz masada kategori ve sandalye null", async () => {
    const list = await (await call("GET", `${API}/events`)).json();
    expect(list.events).toHaveLength(1);
    expect(list.events[0]).toMatchObject({ id: event.id, saleState: "open", minPrice: "1500.00", currency: "TRY" });
    const detail = (await (await call("GET", `${API}/events/${event.id}`)).json()) as EventDetail;
    const c1 = detail.plan.tables.find((t) => t.label === "C1")!;
    expect(c1).toMatchObject({ sellable: false, category: null, seats: null });
    expect(detail.plan.canvas).toEqual({ width: 1200, height: 800 });
    expect(detail.sale).toMatchObject({ holdMinutes: 10, maxSeatsPerOrder: 12, blockSingleLeftover: true, demo: true });
  });

  it("doluluk yalnızca satılabilir masaları verir", async () => {
    const av = (await (await call("GET", `${API}/events/${event.id}/availability`)).json()) as Availability;
    expect(av.tables).toHaveLength(12);
    expect(av.tables.map((t) => t.id)).not.toContain(tableId("C1"));
    expect(av.tables.find((t) => t.id === tableId("A1"))?.free).toBe(8);
  });

  it("tutma 201 döner ve doluluğu düşürür", async () => {
    const res = await hold("A1", 3);
    expect(res.status).toBe(201);
    const order = (await res.json()) as OrderResponse;
    expect(order.status).toBe("pending");
    expect(order.items[0]).toMatchObject({ tableLabel: "A1", quantity: 3, unitPrice: "1500.00" });
    expect(order.total).toBe("4500.00");
    expect(fake.free(event.id, tableId("A1"))).toBe(5);
  });

  it("aynı clientKey aynı siparişi 200 ile döndürür", async () => {
    const key = randomUUID();
    const first = (await (await hold("A1", 3, key)).json()) as OrderResponse;
    const second = await hold("A1", 3, key);
    expect(second.status).toBe(200);
    expect(((await second.json()) as OrderResponse).orderToken).toBe(first.orderToken);
    expect(fake.free(event.id, tableId("A1"))).toBe(5);
  });

  it("yetersiz sandalye: seats_unavailable ve kalan sayı", async () => {
    fake.holdAs(event.id, tableId("A2"), 6);
    const res = await hold("A2", 3);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("seats_unavailable");
    expect(body.error.details).toEqual({ tableId: tableId("A2"), free: 2 });
  });

  it("tek sandalye bırakan adet reddedilir, masanın tamamı serbesttir", async () => {
    const res = await hold("A3", 7);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("leaves_single_seat");
    expect((await hold("A3", 8)).status).toBe(201);
  });

  it("loca yalnızca bütün alınır", async () => {
    const res = await hold("L1", 2);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("whole_table_required");
    expect(body.error.details).toEqual({ tableId: tableId("L1"), seats: 6 });
    expect((await hold("L1", 6)).status).toBe(201);
  });

  it("satış kapalıyken tutma 409 sales_closed", async () => {
    const closed = fake.addEvent({ saleState: "closed" });
    const res = await call("POST", `${API}/orders`, {
      eventId: closed.id,
      items: [{ tableId: closed.plan.tables[0]!.id, quantity: 2 }],
      clientKey: randomUUID(),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("sales_closed");
  });

  it("süresi dolan tutma sandalyeyi bırakır ve ödenemez", async () => {
    const order = (await (await hold("A1", 3)).json()) as OrderResponse;
    fake.advance(10 * 60_000 + 1000);
    const read = (await (await call("GET", `${API}/orders/${order.orderToken}`)).json()) as OrderResponse;
    expect(read.status).toBe("expired");
    expect(fake.free(event.id, tableId("A1"))).toBe(8);
    const res = await call("POST", `${API}/orders/${order.orderToken}/pay`, payBody("approve"));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("hold_expired");
  });

  it("ödeme: reddet 402 ve sipariş bekler; onay PNR ve kişi başı bilet üretir; tekrar aynı sonucu verir", async () => {
    const order = (await (await hold("A1", 3)).json()) as OrderResponse;
    const path = `${API}/orders/${order.orderToken}`;
    const declined = await call("POST", `${path}/pay`, payBody("decline"));
    expect(declined.status).toBe(402);
    expect((await declined.json()).error.code).toBe("payment_declined");
    expect(((await (await call("GET", path)).json()) as OrderResponse).status).toBe("pending");

    const paid = (await (await call("POST", `${path}/pay`, payBody("approve"))).json()) as OrderResponse;
    expect(paid.status).toBe("paid");
    expect(paid.pnr).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    expect(paid.tickets).toHaveLength(3);
    expect(paid.isDemo).toBe(true);
    expect(paid.demoNotice).toBe("DEMO - gerçek ödeme alınmadı");

    const again = (await (await call("POST", `${path}/pay`, payBody("approve"))).json()) as OrderResponse;
    expect(again.pnr).toBe(paid.pnr);
  });

  it("onay kutusu olmadan ödeme 400 invalid", async () => {
    const order = (await (await hold("A1", 2)).json()) as OrderResponse;
    const res = await call("POST", `${API}/orders/${order.orderToken}/pay`, payBody("approve", false));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid");
    expect(body.error.details.fieldErrors.acceptTerms).toBeDefined();
  });

  it("bırakma: bekleyen 204 ve sandalyeler döner; ödenmiş 409 already_paid", async () => {
    const pending = (await (await hold("A1", 3)).json()) as OrderResponse;
    expect((await call("DELETE", `${API}/orders/${pending.orderToken}`)).status).toBe(204);
    expect(fake.free(event.id, tableId("A1"))).toBe(8);

    const toPay = (await (await hold("A2", 2)).json()) as OrderResponse;
    await call("POST", `${API}/orders/${toPay.orderToken}/pay`, payBody("approve"));
    const res = await call("DELETE", `${API}/orders/${toPay.orderToken}`);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("already_paid");
  });

  it("PNR araması: doğru soyadla belirteç, yanlış soyad ve bilinmeyen PNR aynı 404", async () => {
    const order = (await (await hold("A1", 2)).json()) as OrderResponse;
    const paid = (await (
      await call("POST", `${API}/orders/${order.orderToken}/pay`, payBody("approve"))
    ).json()) as OrderResponse;
    const pnr = paid.pnr!;
    const spaced = `${pnr.slice(0, 4)}-${pnr.slice(4)}`.toLowerCase();

    const ok = await call("POST", `${API}/orders/lookup`, { pnr: spaced, lastName: "ılgaz" });
    expect(ok.status).toBe(200);
    expect((await ok.json()).orderToken).toBe(order.orderToken);

    const wrongName = await call("POST", `${API}/orders/lookup`, { pnr, lastName: "Yanlış" });
    const unknown = await call("POST", `${API}/orders/lookup`, { pnr: "ZZZZZZZZ", lastName: "ılgaz" });
    expect(wrongName.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await wrongName.json()).toEqual(await unknown.json());
  });

  it("yanıtlar alıcı bilgisi taşımaz", async () => {
    const order = (await (await hold("A1", 2)).json()) as OrderResponse;
    const res = await call("POST", `${API}/orders/${order.orderToken}/pay`, payBody("approve"));
    const text = JSON.stringify(await res.json()).toLowerCase();
    expect(text).not.toContain("ayse@example.test");
    expect(text).not.toContain("ılgaz");
  });

  it("istek günlüğü yöntemi, yolu ve X-Sales-Client-Ip başlığını kaydeder", async () => {
    await call("GET", `${API}/events`, undefined, {
      authorization: `Bearer ${fake.secret}`,
      "x-sales-client-ip": "203.0.113.7",
    });
    expect(fake.requests.at(-1)).toEqual({
      method: "GET",
      path: `${API}/events`,
      authorization: `Bearer ${fake.secret}`,
      clientIp: "203.0.113.7",
    });
  });

  it("failNext bir sonraki eşleşen isteği verilen durumla düşürür", async () => {
    fake.failNext(/\/events$/, 503);
    expect((await call("GET", `${API}/events`)).status).toBe(503);
    expect((await call("GET", `${API}/events`)).status).toBe(200);
  });

  it("belirteç ve sipariş kimliği çekirdekteki biçimdedir", async () => {
    const order = (await (await hold("A1", 2)).json()) as OrderResponse;
    expect(order.orderId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    const [head, signature, ...rest] = order.orderToken.split(".");
    expect(rest).toEqual([]);
    expect(Buffer.from(head!, "base64url").toString("utf8")).toBe(order.orderId);
    expect(Buffer.from(signature!, "base64url")).toHaveLength(32);
  });

  it("isDemo bekleyen siparişte false, ödenince sale.demo değeridir", async () => {
    const order = (await (await hold("A1", 2)).json()) as OrderResponse;
    expect(order.isDemo).toBe(false);
    const paid = (await (
      await call("POST", `${API}/orders/${order.orderToken}/pay`, payBody("approve"))
    ).json()) as OrderResponse;
    expect(paid.isDemo).toBe(true);
    const real = fake.addEvent({ demo: false });
    const hold2 = (await (
      await call("POST", `${API}/orders`, {
        eventId: real.id,
        items: [{ tableId: real.plan.tables[0]!.id, quantity: 2 }],
        clientKey: randomUUID(),
      })
    ).json()) as OrderResponse;
    const paid2 = (await (
      await call("POST", `${API}/orders/${hold2.orderToken}/pay`, payBody("approve"))
    ).json()) as OrderResponse;
    expect(paid2.isDemo).toBe(false);
    expect(paid2.demoNotice).toBeNull();
  });

  it("clientKey yinelemesi satış kapansa da aynı siparişi verir; başka etkinlikte invalid", async () => {
    const open = fake.addEvent({ saleState: "open" });
    const key = randomUUID();
    const body = { eventId: open.id, items: [{ tableId: open.plan.tables[0]!.id, quantity: 2 }], clientKey: key };
    const first = (await (await call("POST", `${API}/orders`, body)).json()) as OrderResponse;
    const other = fake.addEvent();
    const crossed = await call("POST", `${API}/orders`, { ...body, eventId: other.id });
    expect(crossed.status).toBe(400);
    expect((await crossed.json()).error.code).toBe("invalid");

    // Satış arada kapanır: sahte çekirdekte durum etkinlik ayrıntısından değiştirilir.
    open.sale.state = "closed";
    const again = await call("POST", `${API}/orders`, body);
    expect(again.status).toBe(200);
    expect(((await again.json()) as OrderResponse).orderToken).toBe(first.orderToken);
  });

  it("yinelenen masa kalemleri birleştirilir", async () => {
    const id = tableId("A4");
    const res = await call("POST", `${API}/orders`, {
      eventId: event.id,
      items: [
        { tableId: id, quantity: 2 },
        { tableId: id, quantity: 3 },
      ],
      clientKey: randomUUID(),
    });
    const order = (await res.json()) as OrderResponse;
    expect(order.items).toHaveLength(1);
    expect(order.items[0]?.quantity).toBe(5);
    expect(fake.free(event.id, id)).toBe(3);
  });

  it("fiyatı olmayan kategori price_missing verir (adet denetimlerinden sonra)", async () => {
    const noVip = fake.addEvent({ prices: { vip: undefined } });
    const vip = noVip.plan.tables.find((t) => t.label === "V1")!;
    const res = await call("POST", `${API}/orders`, {
      eventId: noVip.id,
      items: [{ tableId: vip.id, quantity: 2 }],
      clientKey: randomUUID(),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("price_missing");
  });

  it("listen: HTTP üzerinden aynı davranış ve denetim uçları", async () => {
    const server = await fake.listen(0);
    try {
      const headers = { authorization: `Bearer ${fake.secret}`, "content-type": "application/json" };
      expect((await fetch(`${server.url}${API}/events`, { headers })).status).toBe(200);

      const seeded = (await (
        await fetch(`${server.url}/__fake/events`, { method: "POST", body: JSON.stringify({ name: "Denetim" }) })
      ).json()) as EventDetail;
      const target = seeded.plan.tables[0]!.id;
      await fetch(`${server.url}/__fake/hold-as`, {
        method: "POST",
        body: JSON.stringify({ eventId: seeded.id, tableId: target, quantity: 3 }),
      });
      const av = (await (await fetch(`${server.url}${API}/events/${seeded.id}/availability`, { headers })).json()) as Availability;
      expect(av.tables.find((t) => t.id === target)?.free).toBe(5);

      const log = (await (await fetch(`${server.url}/__fake/requests`)).json()) as unknown[];
      expect(log.length).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  });
});
