import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SALES_ERROR_CODES } from "@/lib/core/contract";

const read = (p: string) => readFileSync(resolve(import.meta.dirname, p), "utf8").replace(/\r\n/g, "\n");

describe("sözleşme kopyası", () => {
  it("contract.ts çekirdektekiyle birebir aynıdır", () =>
    expect(read("../../src/lib/core/contract.ts")).toBe(read("../../../web/src/features/sales-api/contract.ts")));

  it("contract.ts yalnızca zod içe aktarır", () => {
    const sources = [...read("../../src/lib/core/contract.ts").matchAll(/^\s*import[^"']*["']([^"']+)["']/gm)].map(
      (m) => m[1],
    );
    expect(sources.filter((s) => s !== "zod")).toEqual([]);
  });

  it("hata kodları sözleşmedeki 17 koddur", () =>
    expect([...SALES_ERROR_CODES].sort()).toEqual([
      "already_paid",
      "event_not_found",
      "hold_expired",
      "invalid",
      "leaves_single_seat",
      "limit_exceeded",
      "order_not_found",
      "payment_declined",
      "payments_disabled",
      "price_missing",
      "rate_limited",
      "sales_api_disabled",
      "sales_closed",
      "seats_unavailable",
      "table_not_sellable",
      "unauthorized",
      "whole_table_required",
    ]));
});
