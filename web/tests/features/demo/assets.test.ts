import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_ASSET_DIR, DEMO_CONCERTS, DEMO_HERO_FILE } from "@/features/demo/concerts";
import { diamondUnits } from "@/features/demo/diamond-plan";

describe("demo tohum varlıkları", () => {
  it("her konserin afişi ve sanatçı görseli ile hero dosyası depodadır; bütçe aşılmaz", () => {
    const assetDir = path.resolve(process.cwd(), DEMO_ASSET_DIR);
    expect(existsSync(assetDir)).toBe(true);

    const expected = new Set<string>([DEMO_HERO_FILE]);
    for (const c of DEMO_CONCERTS) {
      expected.add(c.poster);
      expected.add(c.artistImage);
    }

    const actual = readdirSync(assetDir);
    expect(actual).toHaveLength(11);
    expect(new Set(actual)).toEqual(expected);

    let totalBytes = 0;
    for (const file of actual) {
      const size = statSync(path.join(assetDir, file)).size;
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThanOrEqual(1_000_000);
      totalBytes += size;
    }
    expect(totalBytes).toBeLessThanOrEqual(2_500_000);
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
