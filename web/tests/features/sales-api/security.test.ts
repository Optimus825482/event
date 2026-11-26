import { randomUUID } from "node:crypto";
import { count } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { db } from "@/db/client";
import { orders, paymentAttempts } from "@/db/schema";
import { errorBodySchema, orderResponseSchema } from "@/features/sales-api/contract";
import type { SalesRateScope } from "@/features/sales-api/rate-limits";
import { formatPnr, parsePnr } from "@/features/ticketing/pnr";
import { createRateLimiter, type AsyncRateLimiter } from "@/lib/rate-limit";
import { truncateAll } from "../../helpers/db";
import { activeTickets, saleEvent } from "../ticketing/fixtures";
import { bodyOf, countingLimiter, denyLimiter, makeApi, req, TEST_SECRET } from "./fixtures";

type ErrorBody = z.infer<typeof errorBodySchema>;

const O = "/api/sales/v1/orders";
const buyer = { firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.com", phone: "05321112233" };
const payBody = { buyer, acceptTerms: true, payment: { provider: "demo", action: "approve" } };

async function setup() {
  const {
    event,
    tables: [a1],
  } = await saleEvent();
  const api = makeApi();
  const create = async (a: ReturnType<typeof makeApi> = api) =>
    orderResponseSchema.parse(
      await (
        await a.createOrder(
          req("POST", O, { body: { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }], clientKey: randomUUID() } }),
        )
      ).json(),
    );
  return { event, table: a1!, api, create };
}

async function orderCount(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(orders);
  return row!.n;
}

describe("satış API güvenliği", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("sırsız ya da yanlış sırlı istek beş sipariş ucunda 401 alır; sayaç ve veritabanı değişmez", async () => {
    const counters = {
      sales_hold: countingLimiter(),
      sales_pay: countingLimiter(),
      sales_lookup_ip: countingLimiter(),
      sales_lookup_pnr: countingLimiter(),
    };
    const { event, table, create } = await setup();
    const pending = await create();
    const guarded = makeApi({ limiters: counters });
    const before = await orderCount();
    for (const auth of [null, "Bearer yanlis"]) {
      const responses = [
        await guarded.createOrder(
          req("POST", O, { auth, body: { eventId: event.id, items: [{ tableId: table.id, quantity: 2 }], clientKey: randomUUID() } }),
        ),
        await guarded.getOrder(req("GET", `${O}/x`, { auth }), pending.orderToken),
        await guarded.payOrder(req("POST", `${O}/x/pay`, { auth, body: payBody }), pending.orderToken),
        await guarded.cancelOrder(req("DELETE", `${O}/x`, { auth }), pending.orderToken),
        await guarded.lookupOrder(req("POST", `${O}/lookup`, { auth, body: { pnr: "ABCD2345", lastName: "Yılmaz" } })),
      ];
      for (const res of responses) {
        expect(res.status).toBe(401);
        expect((await bodyOf<ErrorBody>(res)).error.code).toBe("unauthorized");
      }
    }
    for (const c of Object.values(counters)) expect(c.keys).toEqual([]);
    expect(await orderCount()).toBe(before);
    expect(await activeTickets(table.id)).toHaveLength(2);
  });

  it("sunucuda sır tanımsızsa beş uç 503 sales_api_disabled", async () => {
    const { create } = await setup();
    const pending = await create();
    const api = makeApi({ secret: undefined });
    const responses = [
      await api.createOrder(req("POST", O, { body: {} })),
      await api.getOrder(req("GET", `${O}/x`), pending.orderToken),
      await api.payOrder(req("POST", `${O}/x/pay`, { body: payBody }), pending.orderToken),
      await api.cancelOrder(req("DELETE", `${O}/x`), pending.orderToken),
      await api.lookupOrder(req("POST", `${O}/lookup`, { body: {} })),
    ];
    for (const res of responses) {
      expect(res.status).toBe(503);
      expect((await bodyOf<ErrorBody>(res)).error.code).toBe("sales_api_disabled");
    }
  });

  it("hız sınırı anahtarı X-Sales-Client-Ip'tir; başlık yoksa ya da geçersizse unknown", async () => {
    const { event, table } = await setup();
    const hold = countingLimiter();
    const api = makeApi({ limiters: { ...limitersOf(), sales_hold: hold } });
    const body = () => ({ eventId: event.id, items: [{ tableId: table.id, quantity: 2 }], clientKey: randomUUID() });
    await api.createOrder(req("POST", O, { body: body(), ip: "203.0.113.7" }));
    await api.createOrder(req("POST", O, { body: body() }));
    await api.createOrder(req("POST", O, { body: body(), ip: "1.2.3.4, 5.6.7.8" }));
    expect(hold.keys).toEqual(["203.0.113.7", "unknown", "unknown"]);
  });

  it("sınır aşılınca 429 rate_limited ve Retry-After; servis çalışmaz", async () => {
    const { event, table, create } = await setup();
    const pending = await create();
    const before = await orderCount();
    const deny = denyLimiter(42);
    const api = makeApi({ limiters: { sales_hold: deny, sales_pay: deny, sales_lookup_ip: deny, sales_lookup_pnr: deny } });
    const responses = [
      await api.createOrder(
        req("POST", O, { body: { eventId: event.id, items: [{ tableId: table.id, quantity: 2 }], clientKey: randomUUID() } }),
      ),
      await api.payOrder(req("POST", `${O}/x/pay`, { body: payBody }), pending.orderToken),
      await api.lookupOrder(req("POST", `${O}/lookup`, { body: { pnr: "ABCD2345", lastName: "Yılmaz" } })),
    ];
    for (const res of responses) {
      expect(res.status).toBe(429);
      expect(res.headers.get("retry-after")).toBe("42");
      expect((await bodyOf<ErrorBody>(res)).error.code).toBe("rate_limited");
    }
    expect(await orderCount()).toBe(before);
    const [attempts] = await db.select({ n: count() }).from(paymentAttempts);
    expect(attempts!.n).toBe(0);
  });

  it("arama: IP sınırı gövdeden önce, PNR sınırı yalnızca biçimi geçerli PNR'da sayılır", async () => {
    const ip = countingLimiter();
    const pnr = countingLimiter();
    const api = makeApi({ limiters: { ...limitersOf(), sales_lookup_ip: ip, sales_lookup_pnr: pnr } });
    const lookup = (r: Request) => api.lookupOrder(r);
    await lookup(req("POST", `${O}/lookup`, { body: { pnr: formatPnr("ABCD2345"), lastName: "Yılmaz" } }));
    expect(ip.keys).toHaveLength(1);
    expect(pnr.keys).toEqual([parsePnr("ABCD2345")]);
    await lookup(req("POST", `${O}/lookup`, { body: { pnr: "123", lastName: "Yılmaz" } }));
    expect(ip.keys).toHaveLength(2);
    expect(pnr.keys).toHaveLength(1);
    const bad = await lookup(req("POST", `${O}/lookup`, { raw: "{" }));
    expect(bad.status).toBe(400);
    expect(ip.keys).toHaveLength(3);
    expect(pnr.keys).toHaveLength(1);
  });

  it("PNR başına sınır soyad denemesini keser", async () => {
    const { create, api } = await setup();
    const order = await create();
    const paid = orderResponseSchema.parse(
      await (await api.payOrder(req("POST", `${O}/x/pay`, { body: payBody }), order.orderToken)).json(),
    );
    const inner = createRateLimiter({ limit: 10, windowMs: 3_600_000 });
    const pnrLimiter: AsyncRateLimiter = { check: async (key) => inner.check(key) };
    const limited = makeApi({ limiters: { ...limitersOf(), sales_lookup_pnr: pnrLimiter } });
    const lookup = (lastName: string) =>
      limited.lookupOrder(req("POST", `${O}/lookup`, { body: { pnr: paid.pnr, lastName } }));
    for (let i = 0; i < 10; i += 1) expect((await lookup(`Yanlis${i}`)).status).toBe(404);
    expect((await lookup("Yılmaz")).status).toBe(429);
  });

  it("ödeme gövdesinde kart alanı 400 invalid; hiçbir şey yazılmaz", async () => {
    const { api, create } = await setup();
    const order = await create();
    const res = await api.payOrder(
      req("POST", `${O}/x/pay`, {
        body: { ...payBody, payment: { ...payBody.payment, cardNumber: "4111111111111111" } },
      }),
      order.orderToken,
    );
    expect(res.status).toBe(400);
    expect((await bodyOf<ErrorBody>(res)).error.code).toBe("invalid");
    const [attempts] = await db.select({ n: count() }).from(paymentAttempts);
    expect(attempts!.n).toBe(0);
    const read = orderResponseSchema.parse(await (await api.getOrder(req("GET", `${O}/x`), order.orderToken)).json());
    expect(read.status).toBe("pending");
  });

  it("16 KB'ı aşan ve JSON olmayan gövde 400 invalid", async () => {
    const { api } = await setup();
    for (const raw of [JSON.stringify({ pad: "x".repeat(17 * 1024) }), "x"]) {
      const res = await api.createOrder(req("POST", O, { raw }));
      expect(res.status).toBe(400);
      expect((await bodyOf<ErrorBody>(res)).error.code).toBe("invalid");
    }
  });

  it("hiçbir sipariş yanıtında alıcı bilgisi yoktur", async () => {
    const { api, create } = await setup();
    const order = await create();
    const payRes = await api.payOrder(req("POST", `${O}/x/pay`, { body: payBody }), order.orderToken);
    const paid = orderResponseSchema.parse(JSON.parse(await payRes.clone().text()));
    const getRes = await api.getOrder(req("GET", `${O}/x`), order.orderToken);
    const lookupRes = await api.lookupOrder(req("POST", `${O}/lookup`, { body: { pnr: paid.pnr, lastName: "Yılmaz" } }));
    expect(lookupRes.status).toBe(200);
    for (const res of [payRes, getRes, lookupRes]) {
      const text = await res.text();
      for (const needle of ["ayse@example.com", "Ayşe", "Yılmaz", "05321112233", "buyer"]) {
        expect(text).not.toContain(needle);
      }
    }
  });

  it("yanıtlar no-store taşır ve CORS başlığı içermez", async () => {
    const { event, table, api, create } = await setup();
    const order = await create();
    const responses = [
      await api.createOrder(
        req("POST", O, { body: { eventId: event.id, items: [{ tableId: table.id, quantity: 2 }], clientKey: randomUUID() } }),
      ),
      await api.createOrder(req("POST", O, { body: {} })),
      await api.getOrder(req("GET", `${O}/x`), order.orderToken),
      await api.getOrder(req("GET", `${O}/x`), "çöp"),
      await api.payOrder(req("POST", `${O}/x/pay`, { body: payBody }), order.orderToken),
      await api.payOrder(req("POST", `${O}/x/pay`, { body: {} }), order.orderToken),
      await api.cancelOrder(req("DELETE", `${O}/x`), order.orderToken),
      await api.cancelOrder(req("DELETE", `${O}/x`), "çöp"),
      await api.lookupOrder(req("POST", `${O}/lookup`, { body: { pnr: "ABCD2345", lastName: "Yılmaz" } })),
      await api.lookupOrder(req("POST", `${O}/lookup`, { auth: null, body: {} })),
    ];
    for (const res of responses) {
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  it("PNR tek başına sipariş vermez", async () => {
    const { api, create } = await setup();
    const order = await create();
    const paid = orderResponseSchema.parse(
      await (await api.payOrder(req("POST", `${O}/x/pay`, { body: payBody }), order.orderToken)).json(),
    );
    const res = await api.lookupOrder(req("POST", `${O}/lookup`, { body: { pnr: paid.pnr } }));
    expect(res.status).toBe(400);
    expect((await bodyOf<ErrorBody>(res)).error.code).toBe("invalid");
    expect((await api.getOrder(req("GET", `${O}/${paid.pnr}`), paid.pnr!)).status).toBe(404);
  });

  it("yanlış sırlı istek sır uzunluğu ipucu vermez (aynı 401 gövdesi)", async () => {
    const { api } = await setup();
    const a = await api.getOrder(req("GET", `${O}/x`, { auth: "Bearer a" }), "x");
    const b = await api.getOrder(req("GET", `${O}/x`, { auth: `Bearer ${TEST_SECRET}z` }), "x");
    expect(await a.text()).toBe(await b.text());
  });
});

function limitersOf(): Record<SalesRateScope, AsyncRateLimiter> {
  const allow: AsyncRateLimiter = { check: async () => ({ allowed: true }) };
  return { sales_hold: allow, sales_pay: allow, sales_lookup_ip: allow, sales_lookup_pnr: allow };
}
