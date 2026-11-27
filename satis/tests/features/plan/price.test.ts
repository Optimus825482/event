import { describe, expect, it } from "vitest";
import { buildPlanModel } from "@/features/plan/model";
import { initialPicks, type PickState } from "@/features/plan/picks";
import { picksTotal, sumMoney } from "@/features/plan/price";
import type { EventDetail } from "@/lib/core/contract";

const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

const plan: EventDetail["plan"] = {
  canvas: { width: 1200, height: 800 },
  tables: [
    {
      id: "a1",
      label: "A1",
      x: 100,
      y: 100,
      rotation: 0,
      shape: "round",
      isLoca: false,
      sellable: true,
      category: "standard",
      capacity: 8,
      seats: 8,
      seatNos: seq(8),
      wholeOnly: false,
    },
    {
      id: "l1",
      label: "L1",
      x: 200,
      y: 100,
      rotation: 0,
      shape: "rectangle",
      isLoca: true,
      sellable: true,
      category: "vip",
      capacity: 6,
      seats: 6,
      seatNos: seq(6),
      wholeOnly: true,
    },
    {
      id: "p1",
      label: "P1",
      x: 300,
      y: 100,
      rotation: 0,
      shape: "round",
      isLoca: false,
      sellable: true,
      category: "premium",
      capacity: 8,
      seats: 8,
      seatNos: seq(8),
      wholeOnly: false,
    },
  ],
  decor: [],
  lines: [],
};

const prices: EventDetail["prices"] = [
  { category: "standard", label: "Standart", price: "1500.00" },
  { category: "vip", label: "VIP", price: "4000.00" },
];

const model = buildPlanModel(
  plan,
  prices,
  {
    at: "2026-12-01T10:00:00Z",
    tables: [
      { id: "a1", free: 8, freeSeats: seq(8) },
      { id: "l1", free: 6, freeSeats: seq(6) },
      { id: "p1", free: 8, freeSeats: seq(8) },
    ],
  },
  "seat",
);

describe("price", () => {
  it("tutarlar kuruş kaybı olmadan toplanır", () => {
    expect(sumMoney(["1500.00", "750.50", "0.05"])).toBe("2250.55");
    expect(sumMoney([])).toBe("0.00");
  });

  it("seçim tutarı: sandalye × birim fiyat + bütün masa × sandalye sayısı; fiyatsız kalem null", () => {
    const empty = initialPicks(2);
    expect(picksTotal(empty, model, prices)).toBe("0.00");

    const state: PickState = {
      partySize: 4,
      activeTableId: "l1",
      picks: [
        { tableId: "a1", whole: false, seatNos: [1, 2] },
        { tableId: "l1", whole: true },
      ],
    };
    expect(picksTotal(state, model, prices)).toBe("27000.00");

    const missingPrice: PickState = {
      partySize: 2,
      activeTableId: "p1",
      picks: [{ tableId: "p1", whole: false, seatNos: [1] }],
    };
    expect(picksTotal(missingPrice, model, prices)).toBeNull();
  });
});
