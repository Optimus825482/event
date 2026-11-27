import { describe, expect, it } from "vitest";
import {
  detailPose,
  EYE_HEIGHT,
  FOV_HALL,
  FOV_SEAT,
  maxDistance,
  MIN_DISTANCE,
  orbitMove,
  overviewPose,
  SEAT_OFFSET,
  seatPose,
  topPose,
} from "@/features/plan/three/camera";
import type { StageInfo } from "@/features/plan/three/stage";

describe("camera", () => {
  it("genel bakış 64 m'lik salonda bilet2 ile aynıdır", () => {
    expect(overviewPose({ width: 64, depth: 42 }, false)).toEqual({
      position: [17, 58, 65],
      target: [0, 1, 1],
      fov: FOV_HALL,
    });
  });

  it("dar ekranda ve üstten bakışta kamera yükselir", () => {
    expect(overviewPose({ width: 64, depth: 42 }, true)).toEqual({
      position: [15, 69, 72],
      target: [0, 1, 1],
      fov: FOV_HALL,
    });
    expect(topPose({ width: 64, depth: 42 }, false)).toEqual({
      position: [0, 81, 2],
      target: [0, 1, 1],
      fov: FOV_HALL,
    });
    expect(topPose({ width: 64, depth: 42 }, true)).toEqual({
      position: [0, 106, 2],
      target: [0, 1, 1],
      fov: FOV_HALL,
    });
  });

  it("salon büyüdükçe duruşlar orantılı uzaklaşır", () => {
    const p = overviewPose({ width: 128, depth: 42 }, false);
    expect(p.position).toEqual([34, 116, 130]);
  });

  it("masa yakınlaşması: 6,65 m yukarıdan, sahnenin tersine 4,4 m geriden, 1,45 m yandan", () => {
    expect(detailPose({ x: 5, z: 3 }, 0, { x: 0, z: -1 })).toEqual({
      position: [6.45, 6.65, 7.4],
      target: [5, 0.18, 3],
      fov: FOV_HALL,
    });
  });

  it("masadan bakış: göz 1,22 m, masanın 1,03 m gerisinde, sahne hedefine, 60°", () => {
    const stage: StageInfo = {
      source: "decor",
      center: { x: 0, z: -20 },
      width: 17.4,
      depth: 8.5,
      front: { x: 0, z: 1 },
      target: [0, 2.12, -21.7],
      screen: { position: [0, 3.6, -24.2], rotationY: 0, width: 13.9, height: 5.25 },
    };
    const pose = seatPose({ x: 0, z: 0 }, 0.12, stage);
    expect(pose.fov).toBe(FOV_SEAT);
    expect(pose.position[1]).toBeCloseTo(0.12 + EYE_HEIGHT, 4);
    expect(pose.position[2]).toBeCloseTo(SEAT_OFFSET, 4);
    expect(pose.target).toEqual(stage.target);

    const fromChair = seatPose({ x: 0, z: 0 }, 0, stage, { x: 2, z: 3 });
    expect(fromChair.position).toEqual([2, EYE_HEIGHT, 3]);
  });

  it("sola/sağa 0,3 rad döner, hedef ve uzaklık korunur; yakınlaş ×0,79, uzaklaş ×1,26, sınırlar [3, max]", () => {
    const base = { position: [0, 10, 20] as [number, number, number], target: [0, 1, 1] as [number, number, number] };
    const dist = (p: typeof base) =>
      Math.hypot(p.position[0] - p.target[0], p.position[1] - p.target[1], p.position[2] - p.target[2]);
    const maxD = maxDistance({ width: 64, depth: 42 });

    const left = orbitMove(base, "left", maxD);
    expect(left.target).toEqual(base.target);
    expect(dist(left)).toBeCloseTo(dist(base), 4);

    const right = orbitMove(base, "right", maxD);
    expect(right.target).toEqual(base.target);
    expect(dist(right)).toBeCloseTo(dist(base), 4);
    expect(left.position[0]).toBeCloseTo(-right.position[0], 4);

    const zoomIn = orbitMove(base, "in", maxD);
    expect(dist(zoomIn)).toBeCloseTo(dist(base) * 0.79, 3);

    const zoomOut = orbitMove(base, "out", maxD);
    expect(dist(zoomOut)).toBeCloseTo(dist(base) * 1.26, 3);

    const tooClose = orbitMove({ position: [0, 1, 3.2], target: [0, 1, 1] }, "in", maxD);
    expect(dist(tooClose)).toBeCloseTo(MIN_DISTANCE, 4);

    const tooFar = orbitMove({ position: [0, 1, maxD], target: [0, 1, 1] }, "out", maxD);
    expect(dist(tooFar)).toBeCloseTo(maxD, 4);
  });
});
