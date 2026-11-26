import { randomUUID } from "node:crypto";
import { count } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { db } from "@/db/client";
import { paymentAttempts } from "@/db/schema";
import { signQrToken } from "@/features/reservations/qr-token";
import {
  errorBodySchema,
  lookupResponseSchema,
  orderResponseSchema,
} from "@/features/sales-api/contract";
import { verifyOrderToken, signOrderToken } from "@/features/ticketing/order-token";
import { formatPnr } from "@/features/ticketing/pnr";
import { truncateAll } from "../../helpers/db";
import { createTable } from "../../helpers/factories";
import { expireOrder } from "../../helpers/ticketing";
import { activeTickets, saleEvent } from "../ticketing/fixtures";
import { bodyOf, makeApi, req } from "./fixtures";
import { setStage } from "../../helpers/planning";

type ErrorBody = z.infer<typeof errorBodySchema>;

const buyer = { firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.com" };
const payBody = (action: "approve" | "decline") => ({
  buyer,
  acceptTerms: true,
  payment: { provider: "demo", action },
});
const ORDERS = "/api/sales/v1/orders";

async function hold(api: ReturnType<typeof makeApi>, eventId: string, tableId: string, quantity = 2) {
  const res = await api.createOrder(
    req("POST", ORDERS, { body: { eventId, items: [{ tableId, quantity }], clientKey: randomUUID() } }),
  );
  expect(res.status).toBe(201);
  return orderResponseSchema.parse(await res.json());
}

async function pay(api: ReturnType<typeof makeApi>, token: string, action: "approve" | "decline" = "approve") {
  return api.payOrder(req("POST", `${ORDERS}/${token}/pay`, { body: payBody(action) }), token);
}

async function errorCode(res: Response): Promise<string> {
  return errorBodySchema.parse(await res.json()).error.code;
}

describe("satış API sipariş uçları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("tutma 201, aynı clientKey 200; yanıt sözleşme şemasına uyar ve DEMO ibaresi taşır", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const a = makeApi();
    const body = { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }], clientKey: randomUUID() };
    const first = await a.createOrder(req("POST", ORDERS, { body }));
    expect(first.status).toBe(201);
    const order = orderResponseSchema.parse(await first.json());
    expect(order).toMatchObject({
      status: "pending",
      total: "3000.00",
      pnr: null,
      tickets: [],
      demoNotice: "DEMO - gerçek ödeme alınmadı",
    });
    expect(verifyOrderToken(order.orderToken)).toEqual({ orderId: order.orderId });
    const again = await a.createOrder(req("POST", ORDERS, { body }));
    expect(again.status).toBe(200);
    expect(orderResponseSchema.parse(await again.json()).orderId).toBe(order.orderId);
  });

  it("büyük harfli kimliklerle yineleme aynı siparişi bulur", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const a = makeApi();
    const clientKey = randomUUID();
    const body = { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }], clientKey };
    const first = await a.createOrder(req("POST", ORDERS, { body }));
    expect(first.status).toBe(201);
    const order = orderResponseSchema.parse(await first.json());
    const upper = {
      eventId: event.id.toUpperCase(),
      items: [{ tableId: a1!.id.toUpperCase(), quantity: 2 }],
      clientKey: clientKey.toUpperCase(),
    };
    const again = await a.createOrder(req("POST", ORDERS, { body: upper }));
    expect(again.status).toBe(200);
    const replay = orderResponseSchema.parse(await again.json());
    expect(replay.orderId).toBe(order.orderId);
    expect(replay.eventId).toBe(event.id);
  });

  it("kural hataları koduyla ve ayrıntısıyla döner", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const a = makeApi();
    const create = (eventId: string, tableId: string, quantity: number) =>
      a.createOrder(
        req("POST", ORDERS, { body: { eventId, items: [{ tableId, quantity }], clientKey: randomUUID() } }),
      );

    const single = await create(event.id, a1!.id, 7);
    expect(single.status).toBe(409);
    expect(errorBodySchema.parse(await single.json()).error).toMatchObject({
      code: "leaves_single_seat",
      details: { tableId: a1!.id },
    });

    await hold(a, event.id, a1!.id, 6);
    const full = await create(event.id, a1!.id, 3);
    expect(full.status).toBe(409);
    expect(errorBodySchema.parse(await full.json()).error).toMatchObject({
      code: "seats_unavailable",
      details: { tableId: a1!.id, free: 2 },
    });

    const casino = await createTable(db, event.id, { label: "C1", allocation: "casino" });
    const notSellable = await create(event.id, casino.id, 1);
    expect(notSellable.status).toBe(409);
    expect(await errorCode(notSellable)).toBe("table_not_sellable");

    const missing = await create(randomUUID(), a1!.id, 2);
    expect(missing.status).toBe(404);
    expect(await errorCode(missing)).toBe("event_not_found");

    await setStage(db, event.id, "sales_closed");
    const closed = await create(event.id, a1!.id, 2);
    expect(closed.status).toBe(409);
    expect(await errorCode(closed)).toBe("sales_closed");
  });

  it("sipariş okunur; geçersiz ya da başkasının imzasıyla belirteç 404", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const a = makeApi();
    const order = await hold(a, event.id, a1!.id);
    const ok = await a.getOrder(req("GET", `${ORDERS}/x`), order.orderToken);
    expect(ok.status).toBe(200);
    expect(orderResponseSchema.parse(await ok.json()).orderId).toBe(order.orderId);
    for (const token of ["çöp", signQrToken(order.orderId), signOrderToken(randomUUID())]) {
      const res = await a.getOrder(req("GET", `${ORDERS}/x`), token);
      expect(res.status).toBe(404);
      expect(await errorCode(res)).toBe("order_not_found");
    }
  });

  it("ödeme: 200 paid, PNR ve QR; e-posta yanıttan sonra bir kez ertelenir", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const a = makeApi();
    const order = await hold(a, event.id, a1!.id);
    const res = await pay(a, order.orderToken);
    expect(res.status).toBe(200);
    const paid = orderResponseSchema.parse(await res.json());
    expect(paid.status).toBe("paid");
    expect(paid.isDemo).toBe(true);
    expect(paid.demoNotice).not.toBeNull();
    expect(paid.tickets).toHaveLength(2);
    expect(paid.pnr).toHaveLength(8);
    expect(a.sendEmail).not.toHaveBeenCalled();
    await a.runDeferred();
    expect(a.sendEmail).toHaveBeenCalledTimes(1);
    expect(a.sendEmail).toHaveBeenCalledWith(order.orderId);

    const again = await pay(a, order.orderToken);
    expect(again.status).toBe(200);
    expect(orderResponseSchema.parse(await again.json()).pnr).toBe(paid.pnr);
    await a.runDeferred();
    expect(a.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("e-posta gönderimi başarısız olsa da ödeme yanıtı 200'dür", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const a = makeApi({ sendEmail: async () => Promise.reject(new Error("smtp kapalı")) });
    const order = await hold(a, event.id, a1!.id);
    expect((await pay(a, order.orderToken)).status).toBe(200);
    await expect(a.runDeferred()).resolves.toBeUndefined();
  });

  it("reddet 402 payment_declined; sipariş bekler ve yeniden ödenebilir", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const a = makeApi();
    const order = await hold(a, event.id, a1!.id);
    const declined = await pay(a, order.orderToken, "decline");
    expect(declined.status).toBe(402);
    expect(await errorCode(declined)).toBe("payment_declined");
    const read = await a.getOrder(req("GET", `${ORDERS}/x`), order.orderToken);
    expect(orderResponseSchema.parse(await read.json()).status).toBe("pending");
    expect((await pay(a, order.orderToken)).status).toBe(200);
  });

  it("süresi dolmuş sipariş 409 hold_expired; okuma 'expired' gösterir", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const a = makeApi();
    const order = await hold(a, event.id, a1!.id);
    await expireOrder(db, order.orderId);
    const res = await pay(a, order.orderToken);
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe("hold_expired");
    const read = orderResponseSchema.parse(
      await (await a.getOrder(req("GET", `${ORDERS}/x`), order.orderToken)).json(),
    );
    expect(read.status).toBe("expired");
    expect(read.tickets).toEqual([]);
  });

  it("sağlayıcı kapalıyken ödeme 503 payments_disabled; sipariş değişmez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const order = await hold(makeApi(), event.id, a1!.id);
    const off = makeApi({ provider: () => null });
    const res = await pay(off, order.orderToken);
    expect(res.status).toBe(503);
    expect(await errorCode(res)).toBe("payments_disabled");
    const [attempts] = await db.select({ n: count() }).from(paymentAttempts);
    expect(attempts!.n).toBe(0);
    const read = orderResponseSchema.parse(
      await (await off.getOrder(req("GET", `${ORDERS}/x`), order.orderToken)).json(),
    );
    expect(read.status).toBe("pending");
    expect(read.demoNotice).toBeNull();
  });

  it("bırakma 204; ikinci bırakma 204; ödenmiş sipariş 409 already_paid", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const a = makeApi();
    const order = await hold(a, event.id, a1!.id);
    const del = (token: string) => a.cancelOrder(req("DELETE", `${ORDERS}/x`), token);
    const first = await del(order.orderToken);
    expect(first.status).toBe(204);
    expect(await first.text()).toBe("");
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(await activeTickets(a1!.id)).toHaveLength(0);
    expect((await del(order.orderToken)).status).toBe(204);

    const second = await hold(a, event.id, a1!.id);
    await pay(a, second.orderToken);
    const res = await del(second.orderToken);
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe("already_paid");
  });

  it("arama: PNR + soyad → belirteç; yanlış soyad, olmayan PNR ve bozuk PNR aynı 404", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const a = makeApi();
    const order = await hold(a, event.id, a1!.id);
    const paid = orderResponseSchema.parse(await (await pay(a, order.orderToken)).json());
    const lookup = (body: unknown) => a.lookupOrder(req("POST", `${ORDERS}/lookup`, { body }));

    const ok = await lookup({ pnr: formatPnr(paid.pnr!), lastName: "yilmaz" });
    expect(ok.status).toBe(200);
    const { orderToken } = lookupResponseSchema.parse(await ok.json());
    expect(verifyOrderToken(orderToken)).toEqual({ orderId: order.orderId });

    const texts: string[] = [];
    for (const body of [
      { pnr: paid.pnr, lastName: "Kaya" },
      { pnr: "ABCD2345", lastName: "Yılmaz" },
      { pnr: "123", lastName: "Yılmaz" },
    ]) {
      const res = await lookup(body);
      expect(res.status).toBe(404);
      texts.push(await res.text());
    }
    expect(new Set(texts).size).toBe(1);
    expect(JSON.parse(texts[0]!)).toMatchObject({ error: { code: "order_not_found" } });
  });

  it("rota dosyaları yalnızca beklenen yöntemleri dışa aktarır", async () => {
    const create = await import("@/app/api/sales/v1/orders/route");
    const lookup = await import("@/app/api/sales/v1/orders/lookup/route");
    const one = await import("@/app/api/sales/v1/orders/[orderToken]/route");
    const payRoute = await import("@/app/api/sales/v1/orders/[orderToken]/pay/route");
    expect(Object.keys(create).sort()).toEqual(["POST", "dynamic", "runtime"]);
    expect(Object.keys(lookup).sort()).toEqual(["POST", "dynamic", "runtime"]);
    expect(Object.keys(one).sort()).toEqual(["DELETE", "GET", "dynamic", "runtime"]);
    expect(Object.keys(payRoute).sort()).toEqual(["POST", "dynamic", "runtime"]);
    // Sır tanımsız ortamda her rota 503 sales_api_disabled döner (işleyiciye bağlıdır).
    const ctx = { params: Promise.resolve({ orderToken: "x" }) };
    const responses = [
      await create.POST(new Request("http://localhost/x", { method: "POST" })),
      await lookup.POST(new Request("http://localhost/x", { method: "POST" })),
      await one.GET(new Request("http://localhost/x"), ctx),
      await one.DELETE(new Request("http://localhost/x", { method: "DELETE" }), ctx),
      await payRoute.POST(new Request("http://localhost/x", { method: "POST" }), ctx),
    ];
    for (const res of responses) {
      expect(res.status).toBe(503);
      expect((await bodyOf<ErrorBody>(res)).error.code).toBe("sales_api_disabled");
    }
  });
});
