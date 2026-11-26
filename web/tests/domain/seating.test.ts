import { describe, expect, it } from "vitest";
import {
  ALLOCATION_LABELS,
  effectiveSellable,
  SALE_CATEGORIES,
  SALE_CATEGORY_LABELS,
  TABLE_ALLOCATIONS,
} from "@/domain/seating";

describe("masa satış sözlükleri", () => {
  it("sözlükler ve etiketler sabittir", () => {
    expect(SALE_CATEGORIES).toEqual(["standard", "premium", "vip"]);
    expect(SALE_CATEGORY_LABELS).toEqual({ standard: "Standart", premium: "Premium", vip: "VIP" });
    expect(TABLE_ALLOCATIONS).toEqual(["pending", "casino", "online", "closed"]);
    expect(ALLOCATION_LABELS).toEqual({ pending: "Beklemede", casino: "Casino", online: "Online satış", closed: "Kapalı" });
  });

  it.each([
    [8, null, 8],
    [8, 5, 5],
    [8, 8, 8],
  ] as const)("effectiveSellable(%i, %s) = %i", (capacity, sellableSeats, n) =>
    expect(effectiveSellable({ capacity, sellableSeats })).toBe(n),
  );
});
