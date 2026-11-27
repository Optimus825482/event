import { describe, expect, it } from "vitest";
import { DIAMOND_CANVAS, DIAMOND_TABLE_CAPACITY, diamondLayout, diamondUnits } from "@/features/demo/diamond-plan";
import { decorSchema, tableInputSchema } from "@/features/venue/schemas";

describe("Diamond salon planı", () => {
  it("161 masa ve 12 loca üretir; etiketler tekildir ve sahne görüşü kuralına uyar", () => {
    const units = diamondUnits();
    expect(units.filter((u) => !u.isLoca)).toHaveLength(161);
    expect(units.filter((u) => u.isLoca).map((u) => u.label)).toEqual([
      "L-9B",
      "L-9A",
      "L-8B",
      "L-8",
      "L-7",
      "L-6",
      "L-5",
      "L-4",
      "L-3B",
      "L-3A",
      "L-2",
      "L-1",
    ]);
    expect(new Set(units.map((u) => u.label)).size).toBe(173);
    expect(units.every((u) => /^[A-Z]-[0-9]{1,3}[A-Z]?$/.test(u.label))).toBe(true);
    expect(units.every((u) => u.capacity === DIAMOND_TABLE_CAPACITY && u.capacity === 12)).toBe(true);
  });

  it("koordinat dönüşümü: 15 px/m ölçeği (K1)", () => {
    const by = new Map(diamondUnits().map((u) => [u.label, u]));
    expect(by.get("M-1")!.x).toBeCloseTo(480 - 0.93885 * 28.7 * 15, 2);
    expect(by.get("M-1")!.y).toBeCloseTo((-0.997354 * 18.9 + 22) * 15, 2);
    expect(by.get("M-78")!.x).toBeCloseTo(480 + 0.0108 * 28.7 * 15, 2);
    expect(by.get("M-78")!.y).toBeCloseTo((-0.018519 * 18.9 + 22) * 15, 2);
    expect(by.get("L-9B")!.x).toBeCloseTo(480 - 5.5 * 4.97 * 15, 2);
    expect(by.get("L-9B")!.y).toBeCloseTo((21.18 + 22) * 15, 2);
    expect(by.get("L-1")!.x).toBeCloseTo(480 + 5.5 * 4.97 * 15, 2);
  });

  it("kategori dağılımı: 42 vip masa + 12 loca, 68 premium, 51 standard", () => {
    const units = diamondUnits();
    const n = (c: string, loca: boolean) => units.filter((u) => u.category === c && u.isLoca === loca).length;
    expect([n("vip", false), n("vip", true), n("premium", false), n("standard", false)]).toEqual([42, 12, 68, 51]);
    expect(units.find((u) => u.label === "M-78")!.category).toBe("vip");
    expect(units.find((u) => u.label === "M-1")!.category).toBe("premium");
    expect(units.find((u) => u.label === "M-161")!.category).toBe("standard");
  });

  it("yerleşim çekirdek şemalarından geçer; bar öğesi yoktur; hiçbir masa tuval dışında değildir", () => {
    const { tables, decor } = diamondLayout();
    expect(tables).toHaveLength(173);
    const parsed = decorSchema.parse(decor);
    expect([parsed.width, parsed.height]).toEqual([DIAMOND_CANVAS.width, DIAMOND_CANVAS.height]);
    expect([parsed.width, parsed.height]).toEqual([960, 710]);
    expect(parsed.elements.some((e) => e.kind === "bar")).toBe(false);
    const stage = parsed.elements.find((e) => e.kind === "stage");
    expect(stage).toMatchObject({ x: 349.5, width: 261, height: 128 });
    expect(stage?.y).toBeCloseTo(27.75, 2);
    expect(parsed.elements.some((e) => e.kind === "catwalk")).toBe(true);
    for (const t of tables) {
      tableInputSchema.parse(t);
      expect(t.x).toBeGreaterThan(30);
      expect(t.x).toBeLessThan(DIAMOND_CANVAS.width - 30);
      expect(t.y).toBeGreaterThan(30);
      expect(t.y).toBeLessThan(DIAMOND_CANVAS.height - 30);
    }
  });
});
