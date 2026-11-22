import { describe, expect, it } from "vitest";
import { PLAN_STATUS_COLORS, planTableFill } from "@/features/venue/plan-status";
import { isLassoDrag, rectFromPoints, tablesInRect, toWorld } from "@/features/venue/plan-view-math";

describe("kement seçimi", () => {
  it("ekran noktasını görünüme göre dünya koordinatına çevirir", () => {
    expect(toWorld({ x: 120, y: 60 }, { scale: 2, x: 20, y: 10 })).toEqual({ x: 50, y: 25 });
    expect(toWorld({ x: 5, y: 5 }, { scale: 1, x: 0, y: 0 })).toEqual({ x: 5, y: 5 });
  });

  it("sürükleme yönünden bağımsız dikdörtgen", () => {
    expect(rectFromPoints({ x: 50, y: 40 }, { x: 10, y: 80 })).toEqual({ x: 10, y: 40, width: 40, height: 40 });
  });

  it("merkezi dikdörtgende kalan masalar plan sırasıyla, kenar dahil", () => {
    const tables = [
      { id: "a", x: 10, y: 10 },
      { id: "b", x: 100, y: 100 },
      { id: "c", x: 50, y: 50 },
      { id: "d", x: 51, y: 0 },
    ];
    expect(tablesInRect(tables, { x: 0, y: 0, width: 50, height: 50 })).toEqual(["a", "c"]);
    expect(tablesInRect(tables, { x: 200, y: 200, width: 10, height: 10 })).toEqual([]);
  });

  it("küçük hareket tıklamadır", () => {
    expect(isLassoDrag({ x: 0, y: 0 }, { x: 2, y: 3 })).toBe(false);
    expect(isLassoDrag({ x: 0, y: 0 }, { x: 0, y: 4 })).toBe(true);
  });
});

describe("masa dolgu rengi", () => {
  it("masa rengi > durum rengi > masa tipi rengi; eski çağıranlar için davranış aynı", () => {
    const statuses = { a: "confirmed" as const };
    expect(planTableFill("a", "#111111", statuses, { a: "#abcdef" })).toBe("#abcdef");
    expect(planTableFill("a", "#111111", statuses)).toBe(PLAN_STATUS_COLORS.confirmed);
    expect(planTableFill("b", "#111111", statuses, { a: "#abcdef" })).toBe("#111111");
    expect(planTableFill("b", "#111111")).toBe("#111111");
  });
});
