import { describe, expect, it } from "vitest";
import { TABLE_STYLES, tableVisual } from "@/features/plan/table-style";
import { COLORS, contrastRatio } from "@/lib/theme";

describe("table-style", () => {
  it.each(Object.entries(TABLE_STYLES))("%s: masa metni dolgu üzerinde en az 4.5:1", (_, s) =>
    expect(contrastRatio(COLORS[s.text], COLORS[s.fill])).toBeGreaterThanOrEqual(4.5));
  it.each(["standard", "premium", "vip", "picked", "active"] as const)("%s: çerçeve tuval (surface) üzerinde en az 3:1", (v) =>
    expect(contrastRatio(COLORS[TABLE_STYLES[v].stroke], COLORS.surface)).toBeGreaterThanOrEqual(3));
  it("odak halkası (ivory) tuval üzerinde en az 3:1", () =>
    expect(contrastRatio(COLORS.ivory, COLORS.surface)).toBeGreaterThanOrEqual(3));
  it("seçim ve durum kategori renginin önüne geçer", () => {
    expect(tableVisual({ status: "available", category: "vip" }, "active")).toBe("active");
    expect(tableVisual({ status: "available", category: "vip" }, "picked")).toBe("picked");
    expect(tableVisual({ status: "sold_out", category: "vip" }, "active")).toBe("sold_out");
    expect(tableVisual({ status: "available", category: "premium" }, "none")).toBe("premium");
  });
});
