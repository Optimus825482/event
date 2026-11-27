import { describe, expect, it } from "vitest";
import { buildPlanModel } from "@/features/plan/model";
import { reconcileSelection } from "@/features/plan/selection";
import type { EventDetail } from "@/lib/core/contract";

const rules = { maxSeatsPerOrder: 12, blockSingleLeftover: true };
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
  ],
  decor: [],
  lines: [],
};
const prices: EventDetail["prices"] = [{ category: "standard", label: "Standart", price: "1500.00" }];
const modelWith = (free: number) =>
  buildPlanModel(plan, prices, { at: "x", tables: [{ id: "a1", free, freeSeats: seq(free) }] }, "seat");

describe("reconcileSelection", () => {
  it("seçim geçerliyse aynı nesne döner", () => {
    const sel = { tableId: "a1", quantity: 2 };
    const r = reconcileSelection(sel, modelWith(5), rules);
    expect(r.selection).toBe(sel);
    expect(r.notice).toBeNull();
  });
  it("masa dolunca seçim düşer", () =>
    expect(reconcileSelection({ tableId: "a1", quantity: 2 }, modelWith(0), rules)).toEqual({
      selection: null,
      notice: "Seçtiğiniz masa doldu. Lütfen başka bir masa seçin.",
    }));
  it("adet geçersizleşince en yakın küçük geçerli adede iner", () =>
    expect(reconcileSelection({ tableId: "a1", quantity: 4 }, modelWith(5), rules)).toEqual({
      selection: { tableId: "a1", quantity: 3 },
      notice: "Masa durumu değişti; adet güncellendi.",
    }));
  it("küçük geçerli adet yoksa en küçük geçerli adede çıkar", () =>
    expect(reconcileSelection({ tableId: "a1", quantity: 1 }, modelWith(2), rules).selection).toEqual({ tableId: "a1", quantity: 2 }));
  it("seçim yoksa değişiklik yoktur", () =>
    expect(reconcileSelection(null, modelWith(5), rules)).toEqual({ selection: null, notice: null }));
});
