import type { PlanTableModel } from "../model";

export type Vec2 = { x: number; z: number };
export type Vec3 = [number, number, number];

export const PX_PER_METER = 15;
/** Masa gövdesinin plandaki alana oranı (1,86 m / 2,66 m). */
export const BODY_RATIO = 0.7;

export function toMeters(canvas: { width: number; height: number }, x: number, y: number): Vec2 {
  return {
    x: (x - canvas.width / 2) / PX_PER_METER,
    z: (y - canvas.height / 2) / PX_PER_METER,
  };
}

export function roomSize(canvas: { width: number; height: number }): { width: number; depth: number } {
  return {
    width: canvas.width / PX_PER_METER,
    depth: canvas.height / PX_PER_METER,
  };
}

export function tableBody(table: Pick<PlanTableModel, "width" | "height">): { width: number; depth: number } {
  return {
    width: (table.width / PX_PER_METER) * BODY_RATIO,
    depth: (table.height / PX_PER_METER) * BODY_RATIO,
  };
}
