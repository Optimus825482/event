import { db, type Db } from "@/db/client";
import { env } from "@/env";
import { isUuid } from "@/lib/identifiers";
import type { PaymentProvider } from "@/features/ticketing/payment/provider";
import { activeProvider } from "@/features/ticketing/payment/registry";
import { checkSalesAuth } from "./auth";
import { computeAvailability, getSaleEventDetail, listSaleEvents } from "./catalog";
import type { Availability } from "./contract";
import { createFlightCache } from "./flight-cache";
import { salesFailure, salesJson, toSalesResponse } from "./http";

export type SalesDeps = {
  db: Db;
  secret: string | undefined;
  provider: () => PaymentProvider | null;
  now: () => number;
};

export type SalesReadHandlers = {
  listEvents(request: Request): Promise<Response>;
  getEvent(request: Request, eventId: string): Promise<Response>;
  getAvailability(request: Request, eventId: string): Promise<Response>;
};

const PRIVATE_CACHE = { "cache-control": "private, max-age=30" };

export function createSalesHandlers(deps: SalesDeps): SalesReadHandlers {
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

  return {
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
        const availability = await availabilityCache.get(eventId, () => computeAvailability(deps.db, eventId));
        return availability ? salesJson(200, availability) : salesFailure("event_not_found");
      }),
  };
}

export const salesHandlers = createSalesHandlers({
  db,
  secret: env.SALES_API_SECRET,
  provider: activeProvider,
  now: Date.now,
});
