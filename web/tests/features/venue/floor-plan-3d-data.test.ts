import { describe, expect, it } from "vitest";
import { PLAN_STATUS_COLORS } from "@/features/venue/plan-status";
import type { FloorPlanData, PlanTable } from "@/features/venue/plan-types";
import { planToSceneTables } from "@/features/venue/components/venue-3d-scene-data";

function table(over: Partial<PlanTable> & { id: string }): PlanTable {
  return { label: over.id.toUpperCase(), capacity: 8, x: 100, y: 200, rotation: 30, isLoca: false, shape: "round", color: "#123456", ...over };
}

const plan: FloorPlanData = {
  canvas: { width: 1000, height: 800 },
  tables: [
    table({ id: "a" }),
    table({ id: "b", isLoca: true, shape: "rectangle" }),
    table({ id: "c", color: null }),
  ],
  decor: [],
};

describe("planToSceneTables", () => {
  it("masa geometrisini taşır, kat 1 ve boyut türetilir", () => {
    const [a] = planToSceneTables(plan);
    expect(a).toMatchObject({ key: "a", label: "A", capacity: 8, x: 100, y: 200, rotation: 30, floor: 1, size: null, shape: "round" });
  });

  it("renk: tip rengi, loca rengi, tipsizde varsayılan", () => {
    const [a, b, c] = planToSceneTables(plan);
    expect(a?.color).toBe("#123456");
    expect(b?.color).toBe("#ec4899");
    expect(c?.color).toBe("#3b82f6");
  });

  it("durum rengi tip ve loca rengini ezer", () => {
    const [a, b, c] = planToSceneTables(plan, { statuses: { a: "confirmed", b: "free" } });
    expect(a?.color).toBe(PLAN_STATUS_COLORS.confirmed);
    expect(b?.color).toBe(PLAN_STATUS_COLORS.free);
    expect(c?.color).toBe("#3b82f6");
  });

  it("yalnızca seçili masa vurgulanır", () => {
    expect(planToSceneTables(plan, { selectedId: "b" }).map((t) => t.highlighted)).toEqual([false, true, false]);
    expect(planToSceneTables(plan, { selectedId: null }).some((t) => t.highlighted)).toBe(false);
    expect(planToSceneTables(plan).some((t) => t.highlighted)).toBe(false);
  });

  it("colorByTable durum ve tip rengini ezer, verilmeyen masa eskisi gibi kalır", () => {
    const [a, b, c] = planToSceneTables(plan, { statuses: { a: "confirmed", b: "free" }, colorByTable: { a: "#ff0000", c: "#00ff00" } });
    expect(a?.color).toBe("#ff0000");
    expect(b?.color).toBe(PLAN_STATUS_COLORS.free);
    expect(c?.color).toBe("#00ff00");
    expect(planToSceneTables(plan, { colorByTable: {} }).map((t) => t.color)).toEqual(planToSceneTables(plan).map((t) => t.color));
  });

  it("outlinedIds yalnızca verilen masaları çerçeveler", () => {
    expect(planToSceneTables(plan, { outlinedIds: ["b", "c"] }).map((t) => t.outlined)).toEqual([false, true, true]);
    expect(planToSceneTables(plan).some((t) => t.outlined)).toBe(false);
  });

  it("seçilemeyen masalar soluk işaretlenir", () => {
    expect(planToSceneTables(plan, { disabledIds: ["a", "c"] }).map((t) => t.dimmed)).toEqual([true, false, true]);
  });
});
