import { describe, expect, it } from "vitest";
import { canOffer3d } from "@/features/find-table/device";

describe("3B sunma kararı", () => {
  it.each([
    [{ webgl: true }, true],
    [{ webgl: true, deviceMemory: 8, hardwareConcurrency: 8 }, true],
    [{ webgl: false, deviceMemory: 8 }, false],
    [{ webgl: true, deviceMemory: 2 }, false],
    [{ webgl: true, hardwareConcurrency: 2 }, false],
    [{ webgl: true, saveData: true }, false],
    [{ webgl: true, reducedMotion: true }, false],
  ] as const)("canOffer3d(%o) = %s", (hints, expected) => expect(canOffer3d(hints)).toBe(expected));
});
