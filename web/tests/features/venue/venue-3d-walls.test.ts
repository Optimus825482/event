import { describe, expect, it } from "vitest";
import { fitLogo, wallLayout, WALL_MARGIN } from "@/features/venue/components/venue-3d-walls-geometry";

describe("wallLayout", () => {
  it("places back/left/right walls around a centred floor, front open", () => {
    const walls = wallLayout(1000, 500); // 20 x 10 birim
    expect(walls.map((w) => w.side)).toEqual(["back", "left", "right"]);
    const [back, left, right] = walls;
    expect(back?.position).toEqual([0, 0, -(5 + WALL_MARGIN)]);
    expect(back?.length).toBeCloseTo(20 + WALL_MARGIN * 2);
    expect(left?.position[0]).toBeCloseTo(-(10 + WALL_MARGIN));
    expect(right?.position[0]).toBeCloseTo(10 + WALL_MARGIN);
    expect(left?.length).toBeCloseTo(10 + WALL_MARGIN * 2);
    expect(walls.every((w) => w.position[2] <= 0)).toBe(true);
  });

  it("clamps negative sizes", () => {
    expect(wallLayout(-5, -5)[0]?.length).toBeCloseTo(WALL_MARGIN * 2);
  });
});

describe("fitLogo", () => {
  it("preserves aspect ratio inside the box", () => {
    const wide = fitLogo(4, 3, 2);
    expect(wide.width).toBeCloseTo(3);
    expect(wide.height).toBeCloseTo(0.75);
    const tall = fitLogo(0.5, 3, 2);
    expect(tall.height).toBeCloseTo(2);
    expect(tall.width).toBeCloseTo(1);
  });

  it("falls back to square for invalid aspect", () => {
    const r = fitLogo(Number.NaN, 3, 2);
    expect(r.width).toBeCloseTo(2);
    expect(r.height).toBeCloseTo(2);
  });
});
