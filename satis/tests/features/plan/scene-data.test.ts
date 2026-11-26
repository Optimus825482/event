import { describe, expect, it } from "vitest";
import { buildPlanModel } from "@/features/plan/model";
import { planToSceneDecor, planToSceneLines, planToSceneTables, WORLD_SCALE, toWorld } from "@/features/plan/three/scene-data";
import { COLORS } from "@/lib/theme";
import type { EventDetail } from "@/lib/core/contract";

type Table = EventDetail["plan"]["tables"][number];
const t = (id: string, label: string, extra: Partial<Table> = {}): Table => ({
  id, label, x: 100, y: 100, rotation: 0, shape: "round", isLoca: false, sellable: true, category: "standard", seats: 8, wholeOnly: false, ...extra,
});
const plan: EventDetail["plan"] = {
  canvas: { width: 1200, height: 800 },
  tables: [
    t("free", "A1", { x: 200, y: 300, rotation: 30 }),
    t("part", "A2"),
    t("full", "A3"),
    t("closed", "A4", { sellable: false, category: null, seats: null }),
    t("prem", "P1", { category: "premium" }),
    t("vip", "V1", { category: "vip", shape: "rectangle" }),
    t("loca", "L1", { isLoca: true, category: "vip" }),
  ],
  decor: [
    { id: "s", kind: "stage", x: 500, y: 40, width: 200, height: 80, rotation: 90, label: "Sahne" },
    { bozuk: true },
  ],
  lines: [{ id: "l", x1: 0, y1: 0, x2: 100, y2: 0, width: 4 }],
};
const prices: EventDetail["prices"] = [{ category: "standard", label: "Standart", price: "1500.00" }];
const model = buildPlanModel(plan, prices, {
  at: "x",
  tables: [{ id: "free", free: 8 }, { id: "part", free: 3 }, { id: "full", free: 0 }, { id: "prem", free: 8 }, { id: "vip", free: 8 }, { id: "loca", free: 4 }],
});
const byKey = (rows: ReturnType<typeof planToSceneTables>, key: string) => rows.find((r) => r.key === key)!;

describe("planToSceneTables", () => {
  const rows = planToSceneTables(model, { selectedId: null });
  it("konum, boyut, döndürme ve kapasite modelden gelir", () => {
    const a = byKey(rows, "free");
    expect(a).toMatchObject({ x: 200, y: 300, rotation: 30, width: 40, height: 40, capacity: 8, label: "A1", shape: "round", isLoca: false });
    expect(byKey(rows, "vip")).toMatchObject({ width: 40, height: 24, shape: "rectangle" });
    expect(byKey(rows, "loca")).toMatchObject({ width: 48, height: 36, isLoca: true });
  });
  it("durumlar: boş, kısmen dolu, dolu, satışa kapalı", () => {
    expect(byKey(rows, "free")).toMatchObject({ state: "free", selectable: true });
    expect(byKey(rows, "part")).toMatchObject({ state: "partial", selectable: true });
    expect(byKey(rows, "full")).toMatchObject({ state: "full", selectable: false });
    expect(byKey(rows, "closed")).toMatchObject({ state: "closed", selectable: false, capacity: 0 });
  });
  it("renkler tema belirteçlerindendir ve durumlar birbirinden ayrışır", () => {
    expect(byKey(rows, "free").color).toBe(COLORS.ivory);
    expect(byKey(rows, "prem").color).toBe(COLORS.gold);
    expect(byKey(rows, "vip").color).toBe(COLORS.gold);
    expect(byKey(rows, "part").color).toBe(COLORS.muted);
    expect(byKey(rows, "full").color).toBe(COLORS.disabledBg);
    expect(byKey(rows, "closed").color).toBe(COLORS.surface);
    expect(new Set([byKey(rows, "free").color, byKey(rows, "part").color, byKey(rows, "full").color]).size).toBe(3);
  });
  it("seçili masa işaretlenir ve seçili rengi alır; yalnız o masa", () => {
    const sel = planToSceneTables(model, { selectedId: "part" });
    expect(byKey(sel, "part")).toMatchObject({ selected: true, color: COLORS.goldBright });
    expect(sel.filter((r) => r.selected)).toHaveLength(1);
  });
  it("dolu masa seçili gösterilmez", () => {
    expect(byKey(planToSceneTables(model, { selectedId: "full" }), "full").selected).toBe(false);
  });
});

describe("dünya dönüşümü", () => {
  it("50 piksel 1 birimdir ve salon orijinde ortalıdır", () => {
    expect(WORLD_SCALE).toBe(50);
    expect(toWorld(model.canvas, 0, 0)).toEqual([-12, -8]);
    expect(toWorld(model.canvas, 600, 400)).toEqual([0, 0]);
  });
});

describe("planToSceneDecor / planToSceneLines", () => {
  it("dekor merkez noktasına ve radyana çevrilir; bozuk öğe atlanır", () => {
    const decor = planToSceneDecor(model);
    expect(decor).toHaveLength(1);
    expect(decor[0]).toMatchObject({ id: "s", kind: "stage", x: 600, y: 80, width: 200, height: 80 });
    expect(decor[0]!.angle).toBeCloseTo(Math.PI / 2);
  });
  it("çizgi şeride çevrilir", () => {
    expect(planToSceneLines(model)).toEqual([{ id: "l", cx: 50, cy: 0, length: 100, angle: 0, width: 4 }]);
  });
});
