import type { Vec2, Vec3 } from "./metric";
import type { StageInfo } from "./stage";

export type CameraPose = { position: Vec3; target: Vec3; fov: number };

export const EYE_HEIGHT = 1.22;
export const SEAT_OFFSET = 1.03;
export const FOV_HALL = 41;
export const FOV_SEAT = 60;
export const MIN_DISTANCE = 3;
export const CHAIR_PICK_DISTANCE = 20;

const OVERVIEW_TARGET: Vec3 = [0, 1, 1];

function scaleFactor(room: { width: number; depth: number }): number {
  return Math.max(room.width, room.depth * 1.5) / 64;
}

export function maxDistance(room: { width: number; depth: number }): number {
  return 135 * scaleFactor(room);
}

export function overviewPose(room: { width: number; depth: number }, narrow: boolean): CameraPose {
  const k = scaleFactor(room);
  const position: Vec3 = narrow ? [15 * k, 69 * k, 72 * k] : [17 * k, 58 * k, 65 * k];
  return { position, target: [...OVERVIEW_TARGET], fov: FOV_HALL };
}

export function topPose(room: { width: number; depth: number }, narrow: boolean): CameraPose {
  const k = scaleFactor(room);
  return {
    position: [0, (narrow ? 106 : 81) * k, 2],
    target: [...OVERVIEW_TARGET],
    fov: FOV_HALL,
  };
}

export function detailPose(table: Vec2, floorY: number, toStage: Vec2): CameraPose {
  const side: Vec2 = { x: -toStage.z, z: toStage.x };
  return {
    position: [
      table.x + side.x * 1.45 - toStage.x * 4.4,
      floorY + 6.65,
      table.z + side.z * 1.45 - toStage.z * 4.4,
    ],
    target: [table.x, floorY + 0.18, table.z],
    fov: FOV_HALL,
  };
}

export function seatPose(table: Vec2, floorY: number, stage: StageInfo, chair?: Vec2): CameraPose {
  const pos = chair ?? {
    x: table.x - ((stage.target[0] - table.x) / (Math.hypot(stage.target[0] - table.x, stage.target[2] - table.z) || 1)) * SEAT_OFFSET,
    z: table.z - ((stage.target[2] - table.z) / (Math.hypot(stage.target[0] - table.x, stage.target[2] - table.z) || 1)) * SEAT_OFFSET,
  };
  return {
    position: [pos.x, floorY + EYE_HEIGHT, pos.z],
    target: [...stage.target],
    fov: FOV_SEAT,
  };
}

export type OrbitMove = "left" | "right" | "in" | "out";

export function orbitMove(
  pose: { position: Vec3; target: Vec3 },
  move: OrbitMove,
  maxDist: number,
): { position: Vec3; target: Vec3 } {
  const dx = pose.position[0] - pose.target[0];
  const dy = pose.position[1] - pose.target[1];
  const dz = pose.position[2] - pose.target[2];

  if (move === "left" || move === "right") {
    const angle = move === "left" ? 0.3 : -0.3;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      position: [
        pose.target[0] + dx * cos + dz * sin,
        pose.position[1],
        pose.target[2] - dx * sin + dz * cos,
      ],
      target: [...pose.target],
    };
  }

  const dist = Math.hypot(dx, dy, dz) || 1;
  const factor = move === "in" ? 0.79 : 1.26;
  const nextDist = Math.max(MIN_DISTANCE, Math.min(maxDist, dist * factor));
  const scale = nextDist / dist;
  return {
    position: [
      pose.target[0] + dx * scale,
      pose.target[1] + dy * scale,
      pose.target[2] + dz * scale,
    ],
    target: [...pose.target],
  };
}
