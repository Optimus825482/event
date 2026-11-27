import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { DEMO_ASSET_DIR, DEMO_CONCERTS } from "@/features/demo/concerts";
import { diamondUnits } from "@/features/demo/diamond-plan";

describe("demo tohum varlıkları", () => {
  it("her konserin afişi, hero görseli ve sanatçı görseli depodadır; bütçe aşılmaz", () => {
    const assetDir = path.resolve(process.cwd(), DEMO_ASSET_DIR);
    expect(existsSync(assetDir)).toBe(true);

    const expected = new Set<string>();
    for (const c of DEMO_CONCERTS) {
      expected.add(c.poster);
      expected.add(c.hero);
      expected.add(c.artistImage);
    }

    const actual = readdirSync(assetDir);
    // Yorgo Kertis afişi hero ve sanatçı görseli olarak, Ziynet Sali klibi ve görseli iki konserde paylaşılır.
    expect(actual).toHaveLength(26);
    expect(new Set(actual)).toEqual(expected);

    let totalBytes = 0;
    for (const file of actual) {
      const size = statSync(path.join(assetDir, file)).size;
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThanOrEqual(1_000_000);
      totalBytes += size;
    }
    expect(totalBytes).toBeLessThanOrEqual(9_000_000);
  });

  it("klip hero görselleri hareketli WebP'dir", async () => {
    const assetDir = path.resolve(process.cwd(), DEMO_ASSET_DIR);
    const clips = [...new Set(DEMO_CONCERTS.map((c) => c.hero).filter((f) => f.endsWith("-clip.webp")))];
    expect(clips).toHaveLength(8);
    for (const clip of clips) {
      const meta = await sharp(readFileSync(path.join(assetDir, clip)), { animated: true }).metadata();
      expect(meta.pages ?? 1).toBeGreaterThan(1);
    }
  });

  it("tohum etiketlerinin her birinin sahne görüşü dosyası vardır", () => {
    const sightlineDir = path.resolve(process.cwd(), "../satis/public/sightline/diamond");
    expect(existsSync(sightlineDir)).toBe(true);
    const units = diamondUnits();
    expect(units).toHaveLength(173);
    for (const unit of units) {
      expect(existsSync(path.join(sightlineDir, `${unit.label}.webp`))).toBe(true);
    }
  });
});
