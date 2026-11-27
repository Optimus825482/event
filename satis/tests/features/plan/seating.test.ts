import { describe, expect, it } from "vitest";
import {
  CHAIR_RING_GAP,
  chairNumbers,
  chairSpots,
  chairState,
  MAX_CHAIRS,
} from "@/features/plan/three/seating";

describe("seating", () => {
  it("sandalye yuva numarasını kendi konumunda taşır; yuvasız konum null'dır", () => {
    expect(chairNumbers(8, [1, 2, 3, 5, 6, 8])).toEqual([1, 2, 3, null, 5, 6, null, 8]);
  });

  it("kapasiteyi aşan numaralar boş konumlara artan sırayla yerleşir", () => {
    expect(chairNumbers(6, [1, 2, 9, 12])).toEqual([1, 2, 9, 12, null, null]);
  });

  it("yuva sayısı kapasiteden büyükse yuva sayısı kadar, en çok MAX_CHAIRS sandalye çizilir", () => {
    expect(chairNumbers(4, [1, 2, 3, 4, 5, 6])).toEqual([1, 2, 3, 4, 5, 6]);
    expect(chairNumbers(40, [])).toHaveLength(MAX_CHAIRS);
  });

  it("her yuva numarası en çok bir sandalyededir", () => {
    for (let i = 0; i < 50; i++) {
      const cap = (i % 12) + 1;
      const raw = Array.from({ length: (i % 10) + 1 }, (_, k) => ((k * 3 + i) % 18) + 1);
      const unique = [...new Set(raw)];
      const result = chairNumbers(cap, unique);
      const nonNull = result.filter((n): n is number => n !== null);
      expect(new Set(nonNull).size).toBe(nonNull.length);
      for (const n of nonNull) {
        expect(unique).toContain(n);
      }
    }
  });

  it.each([
    [4, [4], [], "free"],
    [4, [], [], "taken"],
    [null, [1], [], "closed"],
    [4, [4], [4], "selected"],
    [4, [], [4], "taken"],
  ] as const)("chairState(%o, %o, %o) = %s", (seatNo, freeSeats, selected, expected) => {
    expect(chairState(seatNo, freeSeats, selected)).toBe(expected);
  });

  it("yuvarlak masada 1 numara sahneye en uzak noktadadır ve sandalyeler eşit aralıklıdır", () => {
    const spots = chairSpots(
      {
        center: { x: 0, z: 0 },
        width: 1.86,
        depth: 1.86,
        rotationDeg: 0,
        shape: "round",
        isLoca: false,
        capacity: 12,
        seatNos: Array.from({ length: 12 }, (_, i) => i + 1),
      },
      { x: 0, z: -1 },
    );
    expect(spots).toHaveLength(12);
    const radius = 1.86 / 2 + CHAIR_RING_GAP;
    expect(spots[0]!.x).toBeCloseTo(0, 4);
    expect(spots[0]!.z).toBeCloseTo(radius, 4);
    for (const s of spots) {
      expect(Math.hypot(s.x, s.z)).toBeCloseTo(radius, 2);
    }
    const angles = spots.map((s) => Math.atan2(s.z, s.x));
    for (let i = 0; i < spots.length; i++) {
      const next = angles[(i + 1) % spots.length]!;
      let diff = next - angles[i]!;
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      expect(Math.abs(diff)).toBeCloseTo((Math.PI * 2) / 12, 3);
    }
  });

  it("sandalyeler masaya bakar", () => {
    const spots = chairSpots(
      {
        center: { x: 4, z: -2 },
        width: 1.86,
        depth: 1.86,
        rotationDeg: 0,
        shape: "round",
        isLoca: false,
        capacity: 8,
        seatNos: [1, 2, 3, 4, 5, 6, 7, 8],
      },
      { x: 0, z: -1 },
    );
    for (const s of spots) {
      const dirX = Math.sin(s.rotationY);
      const dirZ = Math.cos(s.rotationY);
      const toCenterX = 4 - s.x;
      const toCenterZ = -2 - s.z;
      const dot = dirX * toCenterX + dirZ * toCenterZ;
      expect(dot).toBeGreaterThan(0.9);
    }
  });

  it("locada sandalyeler altışarlı sıralarda sahneye bakar ve numara taşımaz", () => {
    const spots = chairSpots(
      {
        center: { x: 0, z: 0 },
        width: 3.2,
        depth: 2.4,
        rotationDeg: 0,
        shape: "rectangle",
        isLoca: true,
        capacity: 8,
        seatNos: [1, 2, 3, 4, 5, 6, 7, 8],
      },
      { x: 0, z: -1 },
    );
    expect(spots).toHaveLength(8);
    expect(spots.every((s) => s.seatNo === null)).toBe(true);
    const expectedRot = Math.atan2(0, -1);
    expect(spots.every((s) => Math.abs(s.rotationY - expectedRot) < 1e-5)).toBe(true);
    // İlk 6 sandalye ön sırada (z aynı), kalan 2 arka sırada (z daha büyük)
    expect(new Set(spots.slice(0, 6).map((s) => s.z.toFixed(3))).size).toBe(1);
    expect(spots[6]!.z).toBeGreaterThan(spots[0]!.z);
  });
});
