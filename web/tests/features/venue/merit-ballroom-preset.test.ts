import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { venueTemplates } from "@/db/schema";
import { itemsCollide, layoutItems } from "@/features/venue/editor/collision";
import { insideCanvas } from "@/features/venue/editor/geometry";
import { MERIT_BALLROOM_NAME, meritBallroomLayout, meritBallroomSeedSql } from "@/features/venue/presets/merit-ballroom";
import { normalizeLabel } from "@/features/venue/schemas";
import { parseTemplateLayout } from "@/features/venue/template-layout";

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

  it("0010 migration'ı koddaki yerleşimle birebir aynıdır ve yeniden çalıştırılınca çoğaltmaz", async () => {
    const file = path.resolve(import.meta.dirname, "../../../drizzle/0010_seed_merit_ballroom_template.sql");
    const seed = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    expect(seed).toBe(meritBallroomSeedSql());

    await db.delete(venueTemplates).where(eq(venueTemplates.name, MERIT_BALLROOM_NAME));
    await db.execute(sql.raw(seed));
    await db.execute(sql.raw(seed));
    const rows = await db.select().from(venueTemplates).where(eq(venueTemplates.name, MERIT_BALLROOM_NAME));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ isPublic: true, createdById: null });
    expect(parseTemplateLayout(rows[0]?.layoutData)).toEqual(layout);
  });
});
