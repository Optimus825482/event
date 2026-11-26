import { describe, expect, it } from "vitest";
import { cameraPresets, chairPlacements, chairSize, chandelierPositions, MAX_CHAIRS, TABLE_BODY_SCALE, tableHeight } from "@/features/venue/components/venue-3d-layout";

describe("chairPlacements", () => {
  it("kapasite kadar sandalyeyi masanın dışına, eşit aralıkla yerleştirir", () => {
    const chairs = chairPlacements(2, 2, 0, 8);
    expect(chairs).toHaveLength(8);
    const gap = chairSize(2, 2) * 0.8;
    for (const c of chairs) expect(Math.hypot(c.x, c.z)).toBeCloseTo(1 + gap);
    expect(chairs[0]?.x).toBeCloseTo(1 + gap);
    expect(chairs[2]?.z).toBeCloseTo(1 + gap);
  });

  it("dikdörtgen masada elips izler ve masanın dönüşünü uygular", () => {
    const [first] = chairPlacements(4, 2, 90, 4);
    const gap = chairSize(4, 2) * 0.8;
    expect(first?.x).toBeCloseTo(0);
    expect(first?.z).toBeCloseTo(2 + gap);
  });

  it("sıfır ve negatif kapasitede boş, büyük kapasitede sınırlı döner", () => {
    expect(chairPlacements(2, 2, 0, 0)).toEqual([]);
    expect(chairPlacements(2, 2, 0, -3)).toEqual([]);
    expect(chairPlacements(2, 2, 0, 40)).toHaveLength(MAX_CHAIRS);
  });

  it("sandalye boyutu okunaklı aralıkta kalır", () => {
    expect(chairSize(0.1, 0.1)).toBe(0.04);
    expect(chairSize(2.4, 2.4)).toBeCloseTo(0.3);
    expect(chairSize(10, 10)).toBe(0.3);
  });

  it("masa ve sandalye halkası plandaki alana tam sığar", () => {
    const footprint = 1;
    const body = footprint * TABLE_BODY_SCALE;
    const size = chairSize(body, body);
    const [first] = chairPlacements(body, body, 0, 12);
    expect((first?.x ?? 0) + size / 2).toBeLessThanOrEqual(footprint / 2 + 1e-9);
    expect(tableHeight(body, body)).toBeCloseTo(body * 0.325);
    expect(tableHeight(10, 10)).toBe(0.78);
  });
});

describe("cameraPresets", () => {
  it("sahne ve loca yoksa yalnızca genel bakış ve kuş bakışı", () => {
    expect(cameraPresets(40, 30, null, null).map((p) => p.id)).toEqual(["overview", "top"]);
  });

  it("sahne ve loca varsa dört açı üretir; sahne açısı sahneye bakar", () => {
    const presets = cameraPresets(40, 30, { x: 0, z: -12 }, { x: 10, z: 14 });
    expect(presets.map((p) => p.id)).toEqual(["overview", "stage", "loca", "top"]);
    const stage = presets.find((p) => p.id === "stage");
    expect(stage?.target).toEqual([0, 1.2, -12]);
    expect(stage?.position[2]).toBeGreaterThan(-12);
    expect(presets.find((p) => p.id === "loca")?.target).toEqual([0, 1.2, -12]);
  });

  it("sahne tam ortadaysa bölme hatası vermez", () => {
    const stage = cameraPresets(40, 30, { x: 0, z: 0 }, null).find((p) => p.id === "stage");
    expect(stage?.position.every(Number.isFinite)).toBe(true);
  });
});

describe("chandelierPositions", () => {
  it("salon genişliğine göre bir, iki ya da üç avize", () => {
    expect(chandelierPositions(5)).toEqual([0]);
    expect(chandelierPositions(12)).toEqual([-3, 3]);
    expect(chandelierPositions(64)).toEqual([-20, 0, 20]);
  });
});
