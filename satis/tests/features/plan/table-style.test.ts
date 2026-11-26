import { describe, expect, it } from "vitest";
import { TABLE_STYLES, tableVisual } from "@/features/plan/table-style";
import { COLORS, contrastRatio } from "@/lib/theme";

describe("table-style", () => {
  it.each(Object.entries(TABLE_STYLES))("%s: masa metni dolgu üzerinde en az 4.5:1", (_, s) =>
    expect(contrastRatio(COLORS[s.text], COLORS[s.fill])).toBeGreaterThanOrEqual(4.5));
  it.each(["standard", "premium", "vip", "selected"] as const)("%s: çerçeve zemin üzerinde en az 3:1", (v) =>
    expect(contrastRatio(COLORS[TABLE_STYLES[v].stroke], COLORS.bg)).toBeGreaterThanOrEqual(3));
  it("seçim ve durum kategori renginin önüne geçer", () => {
    expect(tableVisual({ status: "available", category: "vip" }, true)).toBe("selected");
    expect(tableVisual({ status: "sold_out", category: "vip" }, false)).toBe("sold_out");
    expect(tableVisual({ status: "available", category: "premium" }, false)).toBe("premium");
  });
});
