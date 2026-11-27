import type { PlanTableModel } from "../model";
import type { Vec2 } from "./metric";

export const MAX_CHAIRS = 16;
export const CHAIR_RING_GAP = 0.24;

export type ChairState = "free" | "taken" | "closed" | "selected";
export type ChairSpot = { seatNo: number | null; x: number; z: number; rotationY: number };

export function chairNumbers(capacity: number, seatNos: readonly number[]): (number | null)[] {
  const count = Math.min(MAX_CHAIRS, Math.max(capacity, seatNos.length));
  const slots: (number | null)[] = Array.from({ length: count }, () => null);
  const uniqueSorted = [...new Set(seatNos)].sort((a, b) => a - b);
  const overflow: number[] = [];

  for (const no of uniqueSorted) {
    if (no >= 1 && no <= count && slots[no - 1] === null) {
      slots[no - 1] = no;
    } else {
      overflow.push(no);
    }
  }

  let oi = 0;
  for (let i = 0; i < count && oi < overflow.length; i++) {
    if (slots[i] === null) {
      slots[i] = overflow[oi++]!;
    }
  }
  return slots;
}

export function chairState(
  seatNo: number | null,
  freeSeats: readonly number[],
  selected: readonly number[],
): ChairState {
  if (seatNo === null) return "closed";
  if (!freeSeats.includes(seatNo)) return "taken";
  if (selected.includes(seatNo)) return "selected";
  return "free";
}

export function chairSpots(
  table: {
    center: Vec2;
    width: number;
    depth: number;
    rotationDeg: number;
    shape: PlanTableModel["shape"];
    isLoca: boolean;
    capacity: number;
    seatNos: readonly number[];
  },
  toStage: Vec2,
): ChairSpot[] {
  if (table.isLoca) {
    const count = Math.min(MAX_CHAIRS, Math.max(0, table.capacity));
    const perRow = 6;
    const colGap = 0.58;
    const rowGap = 0.63;
    const firstRowOffset = 0.53;
    const fwd = toStage;
    const right: Vec2 = { x: -fwd.z, z: fwd.x };
    const rotationY = Math.atan2(fwd.x, fwd.z);
    const spots: ChairSpot[] = [];

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const rowCols = Math.min(perRow, count - row * perRow);
      const lateral = (col - (rowCols - 1) / 2) * colGap;
      const depthShift = firstRowOffset - row * rowGap;
      spots.push({
        seatNo: null,
        x: table.center.x + right.x * lateral + fwd.x * depthShift,
        z: table.center.z + right.z * lateral + fwd.z * depthShift,
        rotationY,
      });
    }
    return spots;
  }

  const numbers = chairNumbers(table.capacity, table.seatNos);
  const n = numbers.length;
  if (n === 0) return [];

  const back: Vec2 = { x: -toStage.x, z: -toStage.z };
  const rotRad = (table.rotationDeg * Math.PI) / 180;
  const rx = table.width / 2 + CHAIR_RING_GAP;
  const rz = table.depth / 2 + CHAIR_RING_GAP;
  const isRect = table.shape === "rectangle";

  return numbers.map((seatNo, k) => {
    const alpha = (k * Math.PI * 2) / n;
    const cosA = Math.cos(alpha);
    const sinA = Math.sin(alpha);
    const d: Vec2 = {
      x: back.x * cosA + back.z * sinA,
      z: back.z * cosA - back.x * sinA,
    };

    let ox: number;
    let oz: number;
    if (isRect) {
      const cosR = Math.cos(rotRad);
      const sinR = Math.sin(rotRad);
      const localX = d.x * cosR + d.z * sinR;
      const localZ = -d.x * sinR + d.z * cosR;
      const ex = localX * rx;
      const ez = localZ * rz;
      ox = ex * cosR - ez * sinR;
      oz = ex * sinR + ez * cosR;
    } else {
      const r = rx;
      ox = d.x * r;
      oz = d.z * r;
    }

    return {
      seatNo,
      x: table.center.x + ox,
      z: table.center.z + oz,
      rotationY: Math.atan2(-ox, -oz),
    };
  });
}
