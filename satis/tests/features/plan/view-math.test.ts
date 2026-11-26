import { describe, expect, it } from "vitest";
import { fitView, isTap, pinchView, zoomAround } from "@/features/plan/view-math";

describe("view-math", () => {
  it("fitView tuvali telefona sığdırır ve ortalar", () => {
    const v = fitView({ width: 1200, height: 800 }, { width: 375, height: 420 });
    expect(v.scale).toBeCloseTo(0.2925, 4);
    expect(v.x).toBeCloseTo(12, 4);
    expect(v.y).toBeCloseTo(93, 4);
  });
  it("zoomAround çapa noktasını sabit tutar ve ölçeği sınırlar", () => {
    expect(zoomAround({ scale: 1, x: 0, y: 0 }, { x: 100, y: 100 }, 2)).toEqual({ scale: 2, x: -100, y: -100 });
    expect(zoomAround({ scale: 1, x: 0, y: 0 }, { x: 0, y: 0 }, 9).scale).toBe(4);
    expect(zoomAround({ scale: 1, x: 0, y: 0 }, { x: 0, y: 0 }, 0.01).scale).toBe(0.2);
  });
  it("pinchView: parmaklar iki katına açılınca orta nokta sabit, ölçek iki katı", () =>
    expect(
      pinchView({ view: { scale: 1, x: 0, y: 0 }, a: { x: 100, y: 150 }, b: { x: 200, y: 150 } }, { a: { x: 50, y: 150 }, b: { x: 250, y: 150 } }),
    ).toEqual({ scale: 2, x: -150, y: -150 }));
  it("pinchView: orta nokta kayınca görünüm de kayar", () =>
    expect(
      pinchView({ view: { scale: 1, x: 0, y: 0 }, a: { x: 100, y: 100 }, b: { x: 200, y: 100 } }, { a: { x: 120, y: 130 }, b: { x: 220, y: 130 } }),
    ).toEqual({ scale: 1, x: 20, y: 30 }));
  it("8 pikselden kısa hareket dokunmadır", () => {
    expect(isTap({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe(true);
    expect(isTap({ x: 0, y: 0 }, { x: 9, y: 0 })).toBe(false);
  });
});
