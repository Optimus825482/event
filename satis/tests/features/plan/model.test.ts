import { describe, expect, it } from "vitest";
import { buildPlanModel } from "@/features/plan/model";
import type { EventDetail } from "@/lib/core/contract";

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
      seatNos: [1, 2, 3, 4, 5, 6, 7, 8],
      wholeOnly: false,
    },
    {
      id: "l1",
      label: "L1",
      x: 300,
      y: 100,
      rotation: 0,
      shape: "rectangle",
      isLoca: true,
      sellable: true,
      category: "vip",
      capacity: 6,
      seats: 6,
      seatNos: [1, 2, 3, 4, 5, 6],
      wholeOnly: true,
    },
    {
      id: "c1",
      label: "C1",
      x: 500,
      y: 100,
      rotation: 0,
      shape: "square",
      isLoca: false,
      sellable: false,
      category: null,
      capacity: 8,
      seats: null,
      seatNos: [],
      wholeOnly: false,
    },
    {
      id: "g1",
      label: "G1",
      x: 700,
      y: 100,
      rotation: 0,
      shape: "round",
      isLoca: false,
      sellable: true,
      category: "standard",
      capacity: 8,
      seats: 6,
      seatNos: [1, 2, 3, 5, 6, 8],
      wholeOnly: false,
    },
  ],
  decor: [],
  lines: [],
};
const prices: EventDetail["prices"] = [
  { category: "standard", label: "Standart", price: "1500.00" },
  { category: "premium", label: "Premium", price: "2500.00" },
  { category: "vip", label: "VIP", price: "4000.00" },
];
const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const model = (free: Record<string, number>) =>
  buildPlanModel(
    plan,
    prices,
    {
      at: "2026-12-01T10:00:00Z",
      tables: Object.entries(free).map(([id, f]) => ({ id, free: f, freeSeats: seq(f) })),
    },
    "seat",
  );

describe("buildPlanModel", () => {
  it("boş sandalyesi olan masa: 5/8 ve erişilebilir ad", () =>
    expect(model({ a1: 5, l1: 6 }).tables[0]).toMatchObject({
      status: "available", free: 5, seats: 8, countLabel: "5/8", categoryLabel: "Standart", width: 40, height: 40,
      ariaLabel: "Masa A1, Standart, boş sandalye 5/8",
    }));
  it("dolu masa", () =>
    expect(model({ a1: 0, l1: 6 }).tables[0]).toMatchObject({ status: "sold_out", countLabel: "0/8", ariaLabel: "Masa A1, Standart, dolu" }));
  it("dolulukta olmayan satılabilir masa dolu sayılır", () =>
    expect(model({ l1: 6 }).tables[0]).toMatchObject({ status: "sold_out", free: 0 }));
  it("satışta olmayan masa sayı ve kategori göstermez", () =>
    expect(model({ a1: 5, l1: 6 }).tables[2]).toMatchObject({
      status: "not_sellable", free: null, countLabel: null, category: null, ariaLabel: "Masa C1, satışta değil",
    }));
  it("bütün satılan loca boşken alınabilir, kısmen doluysa dolu sayılır", () => {
    expect(model({ a1: 5, l1: 6 }).tables[1]).toMatchObject({
      status: "available", width: 48, height: 36, ariaLabel: "Loca L1, VIP, yalnızca bütün olarak 6 kişilik",
    });
    expect(model({ a1: 5, l1: 4 }).tables[1]).toMatchObject({ status: "sold_out" });
  });
  it("plandaki olmayan doluluk satırı yok sayılır", () => expect(model({ a1: 5, l1: 6, x9: 3 }).tables).toHaveLength(4));

  it("masa kapasite, yuva numaraları ve boş numaraları taşır", () => {
    const built = buildPlanModel(
      plan,
      prices,
      {
        at: "2026-12-01T10:00:00Z",
        tables: [
          { id: "a1", free: 5, freeSeats: [1, 2, 3, 4, 5] },
          { id: "l1", free: 6, freeSeats: [1, 2, 3, 4, 5, 6] },
          { id: "g1", free: 4, freeSeats: [8, 2, 5, 1] },
        ],
      },
      "seat",
    );
    const g1 = built.tables.find((t) => t.id === "g1");
    expect(g1).toMatchObject({
      capacity: 8,
      seatNos: [1, 2, 3, 5, 6, 8],
      freeSeats: [1, 2, 5, 8],
    });
  });

  it("satılamaz masada yuva ve boş numara yoktur", () => {
    const c1 = model({ a1: 5, l1: 6 }).tables.find((t) => t.id === "c1");
    expect(c1).toMatchObject({ capacity: 8, seatNos: [], freeSeats: [] });
  });

  it("model satış şeklini taşır", () => {
    expect(
      buildPlanModel(
        plan,
        prices,
        { at: "2026-12-01T10:00:00Z", tables: [{ id: "a1", free: 8, freeSeats: seq(8) }] },
        "table",
      ).saleMode,
    ).toBe("table");
  });
});
