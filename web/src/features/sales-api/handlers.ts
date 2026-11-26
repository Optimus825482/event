import { after } from "next/server";
import { db, type Db } from "@/db/client";
import { env } from "@/env";
import { isUuid } from "@/lib/identifiers";
import { logError } from "@/lib/log";
import type { AsyncRateLimiter } from "@/lib/rate-limit";
import { sendOrderEmail } from "@/features/ticketing/eticket-mail";
import { signOrderToken, verifyOrderToken } from "@/features/ticketing/order-token";
import {
  createHoldWithOutcome,
  findOrderByPnr,
  getOrderView,
  payOrder,
  releaseHold,
  type OrderView,
} from "@/features/ticketing/orders-service";
import { parsePnr } from "@/features/ticketing/pnr";
import type { PaymentProvider } from "@/features/ticketing/payment/provider";
import { activeProvider } from "@/features/ticketing/payment/registry";
import { checkSalesAuth, salesClientIp } from "./auth";
import { computeAvailability, getSaleEventDetail, listSaleEvents } from "./catalog";
import {
  createOrderBodySchema,
  DEMO_NOTICE,
  lookupBodySchema,
  payOrderBodySchema,
  type Availability,
  type OrderResponse,
} from "./contract";
import { createFlightCache } from "./flight-cache";
import { readJsonBody, salesFailure, salesJson, toSalesResponse } from "./http";
import { createSalesLimiters, type SalesRateScope } from "./rate-limits";

export type SalesDeps = {
  db: Db;
  secret: string | undefined;
  provider: () => PaymentProvider | null;
  now: () => number;
  limiters: Record<SalesRateScope, AsyncRateLimiter>;
  /** Yanıttan sonra iş erteler (varsayılan: Next.js `after`). */
  defer: (task: () => Promise<void>) => void;
  sendEmail: (orderId: string) => Promise<unknown>;
};

export type SalesReadHandlers = {
  listEvents(request: Request): Promise<Response>;
  getEvent(request: Request, eventId: string): Promise<Response>;
  getAvailability(request: Request, eventId: string): Promise<Response>;
};

export type SalesHandlers = SalesReadHandlers & {
  createOrder(request: Request): Promise<Response>;
  getOrder(request: Request, orderToken: string): Promise<Response>;
  payOrder(request: Request, orderToken: string): Promise<Response>;
  cancelOrder(request: Request, orderToken: string): Promise<Response>;
  lookupOrder(request: Request): Promise<Response>;
};

/** Sipariş yanıtı: alıcı bilgisi içermez. */
export function toOrderResponse(order: OrderView, provider: PaymentProvider | null): OrderResponse {
  const demo = order.isDemo || (order.status === "pending" && provider?.isDemo === true);
  return { ...order, orderToken: signOrderToken(order.orderId), demoNotice: demo ? DEMO_NOTICE : null };
}

const PRIVATE_CACHE = { "cache-control": "private, max-age=30" };

export function createSalesHandlers(deps: SalesDeps): SalesHandlers {
  const availabilityCache = createFlightCache<Availability | null>({ ttlMs: 2000, now: deps.now });

  async function guarded(request: Request, run: () => Promise<Response>): Promise<Response> {
    const auth = checkSalesAuth(request.headers, deps.secret);
    if (!auth.ok) return salesFailure(auth.code);
    try {
      return await run();
    } catch (error) {
      return toSalesResponse(error);
    }
  }

  async function limited(scope: SalesRateScope, key: string): Promise<Response | null> {
    const decision = await deps.limiters[scope].check(key);
    if (decision.allowed) return null;
    return salesFailure("rate_limited", { headers: { "retry-after": String(decision.retryAfterSeconds) } });
  }

  const orderIdOf = (token: string): string | null => verifyOrderToken(token)?.orderId ?? null;

  return {
    createOrder: (request) =>
      guarded(request, async () => {
        const denied = await limited("sales_hold", salesClientIp(request.headers));
        if (denied) return denied;
        const body = await readJsonBody(request, createOrderBodySchema);
        if (!body.ok) return body.response;
        const provider = deps.provider();
        const { order, created } = await createHoldWithOutcome(deps.db, body.data, { provider });
        return salesJson(created ? 201 : 200, toOrderResponse(order, provider));
      }),
    getOrder: (request, orderToken) =>
      guarded(request, async () => {
        const orderId = orderIdOf(orderToken);
        const order = orderId ? await getOrderView(deps.db, orderId) : null;
        return order ? salesJson(200, toOrderResponse(order, deps.provider())) : salesFailure("order_not_found");
      }),
    payOrder: (request, orderToken) =>
      guarded(request, async () => {
        const denied = await limited("sales_pay", salesClientIp(request.headers));
        if (denied) return denied;
        const body = await readJsonBody(request, payOrderBodySchema);
        if (!body.ok) return body.response;
        const orderId = orderIdOf(orderToken);
        if (!orderId) return salesFailure("order_not_found");
        const provider = deps.provider();
        const order = await payOrder(deps.db, orderId, body.data, {
          provider,
          onPaid: (id) =>
            deps.defer(async () => {
              try {
                await deps.sendEmail(id);
              } catch (error) {
                logError("sales-api.eticket", error);
              }
            }),
        });
        return salesJson(200, toOrderResponse(order, provider));
      }),
    cancelOrder: (request, orderToken) =>
      guarded(request, async () => {
        const orderId = orderIdOf(orderToken);
        if (!orderId) return salesFailure("order_not_found");
        await releaseHold(deps.db, orderId);
        return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
      }),
    lookupOrder: (request) =>
      guarded(request, async () => {
        const denied = await limited("sales_lookup_ip", salesClientIp(request.headers));
        if (denied) return denied;
        const body = await readJsonBody(request, lookupBodySchema);
        if (!body.ok) return body.response;
        const pnr = parsePnr(body.data.pnr);
        if (pnr === null) return salesFailure("order_not_found");
        const deniedPnr = await limited("sales_lookup_pnr", pnr);
        if (deniedPnr) return deniedPnr;
        const found = await findOrderByPnr(deps.db, { pnr, lastName: body.data.lastName });
        return found ? salesJson(200, { orderToken: signOrderToken(found.orderId) }) : salesFailure("order_not_found");
      }),
    listEvents: (request) =>
      guarded(request, async () => {
        const events = await listSaleEvents(deps.db, { provider: deps.provider(), now: new Date(deps.now()) });
        return salesJson(200, { events }, PRIVATE_CACHE);
      }),
    getEvent: (request, eventId) =>
      guarded(request, async () => {
        if (!isUuid(eventId)) return salesFailure("event_not_found");
        const detail = await getSaleEventDetail(deps.db, eventId, {
          provider: deps.provider(),
          now: new Date(deps.now()),
        });
        return detail ? salesJson(200, detail, PRIVATE_CACHE) : salesFailure("event_not_found");
      }),
    getAvailability: (request, eventId) =>
      guarded(request, async () => {
        if (!isUuid(eventId)) return salesFailure("event_not_found");
        const availability = await availabilityCache.get(eventId, () => computeAvailability(deps.db, eventId, new Date(deps.now())));
        return availability ? salesJson(200, availability) : salesFailure("event_not_found");
      }),
  };
}

export const salesHandlers = createSalesHandlers({
  db,
  secret: env.SALES_API_SECRET,
  provider: activeProvider,
  now: Date.now,
  limiters: createSalesLimiters(db),
  defer: (task) => after(task),
  sendEmail: (orderId) => sendOrderEmail(db, orderId),
});
