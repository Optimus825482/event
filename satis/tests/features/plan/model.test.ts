import { describe, expect, it } from "vitest";
import { buildPlanModel } from "@/features/plan/model";
import type { EventDetail } from "@/lib/core/contract";

const plan: EventDetail["plan"] = {
  canvas: { width: 1200, height: 800 },
  tables: [
    { id: "a1", label: "A1", x: 100, y: 100, rotation: 0, shape: "round", isLoca: false, sellable: true, category: "standard", seats: 8, wholeOnly: false },
    { id: "l1", label: "L1", x: 300, y: 100, rotation: 0, shape: "rectangle", isLoca: true, sellable: true, category: "vip", seats: 6, wholeOnly: true },
    { id: "c1", label: "C1", x: 500, y: 100, rotation: 0, shape: "square", isLoca: false, sellable: false, category: null, seats: null, wholeOnly: false },
  ],
  decor: [],
  lines: [],
};
const prices: EventDetail["prices"] = [
  { category: "standard", label: "Standart", price: "1500.00" },
  { category: "premium", label: "Premium", price: "2500.00" },
  { category: "vip", label: "VIP", price: "4000.00" },
];
const model = (free: Record<string, number>) =>
  buildPlanModel(plan, prices, { at: "2026-12-01T10:00:00Z", tables: Object.entries(free).map(([id, f]) => ({ id, free: f })) });

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
  it("plandaki olmayan doluluk satırı yok sayılır", () => expect(model({ a1: 5, l1: 6, x9: 3 }).tables).toHaveLength(3));
});
