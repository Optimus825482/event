import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { venueTemplates } from "@/db/schema";
import { itemsCollide, layoutItems } from "@/features/venue/editor/collision";
import { insideCanvas } from "@/features/venue/editor/geometry";
import {
  MERIT_BALLROOM_HALL,
  MERIT_BALLROOM_NAME,
  meritBallroomLayout,
  meritBallroomMigrationSql,
} from "@/features/venue/presets/merit-ballroom";
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

  it("üç bar ve T biçimli catwalk vardır; duvar öğesi yoktur, barlar salon sınırının dışındadır", () => {
    const kinds = layout.decor.elements.map((e) => e.kind);
    expect(kinds.filter((k) => k === "bar")).toHaveLength(3);
    expect(kinds.filter((k) => k === "catwalk")).toHaveLength(2);
    expect(kinds.filter((k) => k === "wall")).toHaveLength(0);
    for (const bar of layout.decor.elements.filter((e) => e.kind === "bar")) {
      expect(bar.y + bar.height <= MERIT_BALLROOM_HALL.top || bar.y >= MERIT_BALLROOM_HALL.bottom).toBe(true);
    }
  });

  it("salon sınırı çizgiyle çizilir; alt kenarda üç giriş kapısı için boşluk vardır", () => {
    const lines = layout.decor.lines ?? [];
    const bottom = lines.filter((l) => l.id.startsWith("border-bottom-")).sort((a, b) => a.x1 - b.x1);
    expect(lines).toHaveLength(3 + 4);
    expect(bottom.every((l) => l.y1 === MERIT_BALLROOM_HALL.bottom && l.y2 === MERIT_BALLROOM_HALL.bottom)).toBe(true);
    const doors = layout.decor.elements.filter((e) => e.id.startsWith("door-")).sort((a, b) => a.x - b.x);
    expect(doors.map((d) => d.label)).toEqual(["GİRİŞ 1", "GİRİŞ 2", "GİRİŞ 3"]);
    // Her kapı, ardışık iki alt kenar parçası arasındaki boşluğu tam doldurur.
    doors.forEach((door, i) => {
      expect(door.x).toBe(bottom[i]?.x2);
      expect(door.x + door.width).toBe(bottom[i + 1]?.x1);
    });
  });

  it("localar salonun içindedir ve altlarında (1. katta) masa vardır", () => {
    const half = (t: { size?: number | null }) => (t.size ?? 0) / 2;
    for (const loca of locas) {
      expect(loca.y + half(loca)).toBeLessThanOrEqual(MERIT_BALLROOM_HALL.bottom);
      expect(loca.x - half(loca)).toBeGreaterThanOrEqual(MERIT_BALLROOM_HALL.left);
      expect(loca.x + half(loca)).toBeLessThanOrEqual(MERIT_BALLROOM_HALL.right);
    }
    const under = locas.filter((loca) =>
      tables.some((t) => Math.abs(t.x - loca.x) < half(t) + half(loca) && Math.abs(t.y - loca.y) < half(t) + half(loca)),
    );
    // Krokide son sıradaki masalar seyrek: her locanın altına masa denk gelmez (bir kısmı sistem kontrolün üstünde).
    expect(under.length).toBeGreaterThanOrEqual(4);
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

  const migration = () =>
    readFileSync(path.resolve(import.meta.dirname, "../../../drizzle/0011_update_merit_ballroom_template.sql"), "utf8").replace(/\r\n/g, "\n");
  const presetRows = () => db.select().from(venueTemplates).where(eq(venueTemplates.name, MERIT_BALLROOM_NAME));

  it("0011 migration'ı koddaki yerleşimle birebir aynıdır; satır yoksa ekler, yeniden çalıştırılınca çoğaltmaz", async () => {
    const seed = migration();
    expect(seed).toBe(meritBallroomMigrationSql());

    await db.delete(venueTemplates).where(eq(venueTemplates.name, MERIT_BALLROOM_NAME));
    await db.execute(sql.raw(seed));
    await db.execute(sql.raw(seed));
    const rows = await presetRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ isPublic: true, createdById: null });
    expect(parseTemplateLayout(rows[0]?.layoutData)).toEqual(layout);
  });

  it("0011, 0010'un eklediği eski (duvarlı) hazır şablonu yeni yerleşimle günceller", async () => {
    const old = readFileSync(path.resolve(import.meta.dirname, "../../../drizzle/0010_seed_merit_ballroom_template.sql"), "utf8");
    await db.delete(venueTemplates).where(eq(venueTemplates.name, MERIT_BALLROOM_NAME));
    await db.execute(sql.raw(old));
    expect(JSON.stringify((await presetRows())[0]?.layoutData)).toContain('"wall"');

    await db.execute(sql.raw(migration()));
    const rows = await presetRows();
    expect(rows).toHaveLength(1);
    expect(parseTemplateLayout(rows[0]?.layoutData)).toEqual(layout);
  });
});
