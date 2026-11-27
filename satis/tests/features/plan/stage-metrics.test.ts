import { describe, expect, it } from "vitest";
import type { PlanDecor } from "@/features/plan/decor";
import type { PlanModel, PlanTableModel } from "@/features/plan/model";
import { formatStageMetrics, tableStageMetrics } from "@/features/plan/stage-metrics";

function table(id: string, x: number, y: number): PlanTableModel {
  return {
    id,
    label: id,
    x,
    y,
    rotation: 0,
    shape: "round",
    isLoca: false,
    width: 40,
    height: 40,
    category: "standard",
    categoryLabel: "Standart",
    capacity: 8,
    seats: 8,
    seatNos: [1, 2, 3, 4, 5, 6, 7, 8],
    free: 8,
    freeSeats: [1, 2, 3, 4, 5, 6, 7, 8],
    wholeOnly: false,
    status: "available",
    countLabel: "8/8",
    ariaLabel: `Masa ${id}`,
  };
}

// 900x900 tuval; sahne üstte, ortası (450, 75) px. Masalar aşağıda (seyirci +z yönünde).
const stage: PlanDecor = { id: "s", kind: "stage", x: 300, y: 30, width: 300, height: 90, rotation: 0, label: "Sahne" };
const tables = [table("M-1", 450, 525), table("M-2", 450 + 450 * Math.tan(Math.PI / 6), 525), table("M-3", 150, 375)];
const model: PlanModel = { canvas: { width: 900, height: 900 }, saleMode: "seat", tables, decor: [stage], lines: [] };

describe("tableStageMetrics", () => {
  it("sahne ortasının tam karşısındaki masa: uzaklık metre, açı Orta", () => {
    const m = tableStageMetrics(model, tables[0]!)!;
    expect(m.meters).toBeCloseTo(30, 5); // 450 px / 15
    expect(m.side).toBe("center");
    expect(formatStageMetrics(m)).toBe("30m · Orta");
  });

  it("seyircinin sağındaki (plan doğusu) masa Sağ, solundaki Sol açıyla yazılır", () => {
    const right = tableStageMetrics(model, tables[1]!)!;
    expect(right.side).toBe("right");
    expect(right.degrees).toBe(30);
    expect(formatStageMetrics(right)).toBe("35m · Sağ 30°");
    const left = tableStageMetrics(model, tables[2]!)!;
    expect(left.side).toBe("left");
    expect(left.degrees).toBe(45);
  });

  it("sahne dekoru yoksa (yedek sahne) hesap yapılmaz", () => {
    expect(tableStageMetrics({ ...model, decor: [] }, tables[0]!)).toBeNull();
  });
});
