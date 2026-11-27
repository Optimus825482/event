import { describe, expect, it } from "vitest";
import { chandelierPositions } from "@/features/plan/three/layout";
import { wallLayout, wallVisibility } from "@/features/plan/three/walls-geometry";

describe("layout-3d", () => {
  it("avizeler salon genişliğine göre 1-3 adet yerleştirilir", () => {
    expect(chandelierPositions(6)).toHaveLength(1);
    expect(chandelierPositions(14)).toHaveLength(2);
    expect(chandelierPositions(40)).toHaveLength(3);
  });

  it("duvarlar 15 piksel = 1 metre ölçeğiyle dört kenarı çevirir", () => {
    const walls = wallLayout(960, 705);
    expect(walls.map((w) => w.side)).toEqual(["back", "left", "right", "front"]);
    const back = walls.find((w) => w.side === "back")!;
    const left = walls.find((w) => w.side === "left")!;
    expect(back.length).toBeGreaterThan(64);
    expect(left.length).toBeGreaterThan(47);
  });

  it("kamera duvarın dışındaysa o duvar gizlenir (kesit görünümü); masadan bakışta hepsi görünür", () => {
    const room = { width: 64, depth: 47 };
    const overviewVis = wallVisibility(room, [0, 40, 50], false);
    expect(overviewVis.front).toBe(false);
    expect(overviewVis.back).toBe(true);

    const povVis = wallVisibility(room, [0, 1.22, 50], true);
    expect(povVis).toEqual({ back: true, left: true, right: true, front: true });
  });
});
