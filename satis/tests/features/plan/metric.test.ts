import { describe, expect, it } from "vitest";
import { PX_PER_METER, roomSize, tableBody, toMeters } from "@/features/plan/three/metric";

describe("metric", () => {
  it("15 piksel 1 metredir ve salon orijinde ortalıdır", () => {
    expect(PX_PER_METER).toBe(15);
    expect(toMeters({ width: 1200, height: 900 }, 600, 450)).toEqual({ x: 0, z: 0 });
    expect(toMeters({ width: 1200, height: 900 }, 615, 0)).toEqual({ x: 1, z: -30 });
    expect(roomSize({ width: 960, height: 705 })).toEqual({ width: 64, depth: 47 });
  });

  it("40 piksellik yuvarlak masa 1,86 m gövde verir", () => {
    expect(tableBody({ width: 40, height: 40 }).width).toBeCloseTo(1.867, 2);
  });
});
