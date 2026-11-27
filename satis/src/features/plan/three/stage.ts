import { decorCenter, type PlanDecor } from "../decor";
import type { PlanModel } from "../model";
import { PX_PER_METER, roomSize, toMeters, type Vec2, type Vec3 } from "./metric";

export type StageInfo = {
  source: "decor" | "fallback";
  center: Vec2;
  width: number;
  depth: number;
  /** Birim vektör: sahneden seyirciye. */
  front: Vec2;
  /** Bakış hedefi (sahne ortası, biraz geride, y = 2,12). */
  target: Vec3;
  screen: { position: Vec3; rotationY: number; width: number; height: number };
};

export const STAGE_HEIGHT = 0.65;
export const TARGET_HEIGHT = 2.12;

function fallbackStage(canvas: { width: number; height: number }): StageInfo {
  const room = roomSize(canvas);
  const width = Math.min(17.4, Math.max(4, room.width * 0.5));
  const depth = 4;
  const center: Vec2 = { x: 0, z: -room.depth / 2 + 2 };
  const front: Vec2 = { x: 0, z: 1 };
  const screenWidth = Math.min(13.9, width * 0.8);
  const screenHeight = (screenWidth * 5.25) / 13.9;
  return {
    source: "fallback",
    center,
    width,
    depth,
    front,
    target: [center.x - front.x * depth * 0.2, TARGET_HEIGHT, center.z - front.z * depth * 0.2],
    screen: {
      position: [
        center.x - front.x * (depth / 2 - 0.05),
        STAGE_HEIGHT + 0.3 + screenHeight / 2,
        center.z - front.z * (depth / 2 - 0.05),
      ],
      rotationY: Math.atan2(front.x, front.z),
      width: screenWidth,
      height: screenHeight,
    },
  };
}

function mainStageDecor(decor: readonly PlanDecor[]): PlanDecor | null {
  let best: PlanDecor | null = null;
  let bestArea = 0;
  for (const d of decor) {
    if (d.kind !== "stage") continue;
    const area = d.width * d.height;
    if (area > bestArea) {
      bestArea = area;
      best = d;
    }
  }
  return best;
}

export function stageInfo(model: PlanModel): StageInfo {
  const stage = mainStageDecor(model.decor);
  if (!stage || stage.width <= 0 || stage.height <= 0) return fallbackStage(model.canvas);

  const pxCenter = decorCenter(stage);
  const center = toMeters(model.canvas, pxCenter.x, pxCenter.y);
  const theta = (stage.rotation * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  const u: Vec2 = { x: cos, z: sin };
  const v: Vec2 = { x: -sin, z: cos };
  const w = stage.width / PX_PER_METER;
  const h = stage.height / PX_PER_METER;

  const audience = model.tables.filter((t) => t.status === "available" || t.status === "sold_out");
  let avg: Vec2 = { x: 0, z: 1 };
  if (audience.length > 0) {
    let sx = 0;
    let sz = 0;
    for (const t of audience) {
      const m = toMeters(model.canvas, t.x, t.y);
      sx += m.x;
      sz += m.z;
    }
    avg = { x: sx / audience.length - center.x, z: sz / audience.length - center.z };
    if (Math.hypot(avg.x, avg.z) < 1e-6) avg = { x: 0, z: 1 };
  }

  const candidates: { vec: Vec2; alongV: boolean }[] = [
    { vec: u, alongV: false },
    { vec: { x: -u.x, z: -u.z }, alongV: false },
    { vec: v, alongV: true },
    { vec: { x: -v.x, z: -v.z }, alongV: true },
  ];

  let bestCand = candidates[2]!;
  let bestDot = -Infinity;
  for (const cand of candidates) {
    const dot = cand.vec.x * avg.x + cand.vec.z * avg.z;
    if (dot > bestDot) {
      bestDot = dot;
      bestCand = cand;
    }
  }

  const front = bestCand.vec;
  const width = bestCand.alongV ? w : h;
  const depth = bestCand.alongV ? h : w;
  const screenWidth = Math.min(13.9, width * 0.8);
  const screenHeight = (screenWidth * 5.25) / 13.9;

  return {
    source: "decor",
    center,
    width,
    depth,
    front,
    target: [center.x - front.x * depth * 0.2, TARGET_HEIGHT, center.z - front.z * depth * 0.2],
    screen: {
      position: [
        center.x - front.x * (depth / 2 - 0.05),
        STAGE_HEIGHT + 0.3 + screenHeight / 2,
        center.z - front.z * (depth / 2 - 0.05),
      ],
      rotationY: Math.atan2(front.x, front.z),
      width: screenWidth,
      height: screenHeight,
    },
  };
}

export function towardStage(stage: StageInfo, from: Vec2): Vec2 {
  const dx = stage.target[0] - from.x;
  const dz = stage.target[2] - from.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return { x: -stage.front.x, z: -stage.front.z };
  return { x: dx / len, z: dz / len };
}
