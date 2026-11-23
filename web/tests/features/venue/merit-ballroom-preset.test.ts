import { describe, expect, it } from "vitest";
import { itemsCollide, layoutItems } from "@/features/venue/editor/collision";
import { insideCanvas } from "@/features/venue/editor/geometry";
import { meritBallroomLayout } from "@/features/venue/presets/merit-ballroom";
import { normalizeLabel } from "@/features/venue/schemas";

describe("Merit Royal Diamond Ballroom hazır yerleşimi", () => {
  const layout = meritBallroomLayout();
  const tables = layout.tables.filter((t) => !t.isLoca);
  const locas = layout.tables.filter((t) => t.isLoca);

  it("krokideki sayılar: 161 masa × 12 + 12 loca × 6 = 2004 kişi; etiketler tekil", () => {
    expect(tables).toHaveLength(161);
    expect(tables.map((t) => t.label)).toEqual(Array.from({ length: 161 }, (_, i) => String(i + 1)));
    expect(locas).toHaveLength(12);
    expect(locas.every((t) => t.floor === 2 && t.capacity === 6)).toBe(true);
    expect(layout.tables.reduce((sum, t) => sum + t.capacity, 0)).toBe(2004);
    expect(new Set(layout.tables.map((t) => normalizeLabel(t.label))).size).toBe(layout.tables.length);
  });

  it("üç bar, T biçimli catwalk ve dört duvarlı salon sınırı vardır; barlar sınırın dışındadır", () => {
    const kinds = layout.decor.elements.map((e) => e.kind);
    expect(kinds.filter((k) => k === "bar")).toHaveLength(3);
    expect(kinds.filter((k) => k === "catwalk")).toHaveLength(2);
    expect(kinds.filter((k) => k === "wall")).toHaveLength(4);
    const top = layout.decor.elements.find((e) => e.id === "wall-top");
    const bottom = layout.decor.elements.find((e) => e.id === "wall-bottom");
    for (const bar of layout.decor.elements.filter((e) => e.kind === "bar")) {
      expect(bar.y + bar.height <= (top?.y ?? 0) || bar.y >= (bottom?.y ?? 0) + (bottom?.height ?? 0)).toBe(true);
    }
  });

  it("hiçbir öğe çakışmaz ve her şey tuvalin içindedir", () => {
    const keyed = layout.tables.map((t, i) => ({ ...t, key: `t${i}` }));
    const items = layoutItems(keyed, layout.decor.elements, () => "round");
    const hits: string[] = [];
    for (const [i, a] of items.entries()) {
      for (const b of items.slice(i + 1)) if (itemsCollide(a, b)) hits.push(`${a.key}×${b.key}`);
    }
    expect(hits).toEqual([]);
    expect(items.every((i) => insideCanvas(i.box, layout.decor))).toBe(true);
  });
});
