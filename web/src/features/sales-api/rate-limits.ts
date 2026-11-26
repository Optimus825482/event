import type { Db } from "@/db/client";
import { createPgRateLimiter, type AsyncRateLimiter } from "@/lib/rate-limit";

/**
 * Satış API'si hız sınırları. Arama uçları kaba kuvvete (PNR + soyad tahmini) açıktır: veritabanı
 * hatasında kapalı kalır. Tutma ve ödeme sınırları açık kalır: kısmi bir kesinti satışı durdurmasın.
 */
export const SALES_RATE_LIMITS = {
  sales_hold: { limit: 6, windowMs: 600_000, onFailure: "open" },
  sales_pay: { limit: 10, windowMs: 600_000, onFailure: "open" },
  sales_lookup_ip: { limit: 5, windowMs: 600_000, onFailure: "closed" },
  sales_lookup_pnr: { limit: 10, windowMs: 3_600_000, onFailure: "closed" },
} as const;

export type SalesRateScope = keyof typeof SALES_RATE_LIMITS;

export function createSalesLimiters(db: Pick<Db, "execute">): Record<SalesRateScope, AsyncRateLimiter> {
  const make = (scope: SalesRateScope) => createPgRateLimiter({ db, scope, ...SALES_RATE_LIMITS[scope] });
  return {
    sales_hold: make("sales_hold"),
    sales_pay: make("sales_pay"),
    sales_lookup_ip: make("sales_lookup_ip"),
    sales_lookup_pnr: make("sales_lookup_pnr"),
  };
}
