import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { createSalesLimiters, SALES_RATE_LIMITS } from "@/features/sales-api/rate-limits";
import { truncateAll } from "../../helpers/db";

describe("satış API hız sınırları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("sınırlar sözleşmedeki gibidir", () => {
    expect(SALES_RATE_LIMITS).toEqual({
      sales_hold: { limit: 6, windowMs: 600_000, onFailure: "open" },
      sales_pay: { limit: 10, windowMs: 600_000, onFailure: "open" },
      sales_lookup_ip: { limit: 5, windowMs: 600_000, onFailure: "closed" },
      sales_lookup_pnr: { limit: 10, windowMs: 3_600_000, onFailure: "closed" },
    });
  });

  it("arama sınırlayıcıları veritabanı hatasında kapalı, tutma ve ödeme açık kalır", async () => {
    const broken = createSalesLimiters({ execute: () => Promise.reject(new Error("x")) } as never);
    expect((await broken.sales_lookup_ip.check("k")).allowed).toBe(false);
    expect((await broken.sales_lookup_pnr.check("k")).allowed).toBe(false);
    expect((await broken.sales_hold.check("k")).allowed).toBe(true);
    expect((await broken.sales_pay.check("k")).allowed).toBe(true);
  });

  it("gerçek veritabanında tutma sınırı IP başına 6'dır ve kapsamlar karışmaz", async () => {
    const limiters = createSalesLimiters(db);
    for (let i = 0; i < 6; i += 1) expect((await limiters.sales_hold.check("ip")).allowed).toBe(true);
    expect((await limiters.sales_hold.check("ip")).allowed).toBe(false);
    expect((await limiters.sales_pay.check("ip")).allowed).toBe(true);
  });
});
