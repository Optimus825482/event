import type { PlanModel, PlanTableModel } from "./model";
import { toMeters } from "./three/metric";
import { stageInfo } from "./three/stage";

export type StageMetrics = { meters: number; side: "left" | "right" | "center"; degrees: number };

/** Ortadan sayılacak en büyük sapma (derece). */
const CENTER_TOLERANCE = 2;

/**
 * Masadan sahne ortasına uzaklık (m) ve seyircinin sahneye bakarken masanın sahne eksenine göre yatay açısı.
 * Sahne plandaki dekordan okunamıyorsa (yedek sahne) hesap yapılmaz: `null`.
 */
export function tableStageMetrics(model: PlanModel, table: Pick<PlanTableModel, "x" | "y">): StageMetrics | null {
  const stage = stageInfo(model);
  if (stage.source !== "decor") return null;
  const pos = toMeters(model.canvas, table.x, table.y);
  const dx = pos.x - stage.center.x;
  const dz = pos.z - stage.center.z;
  const meters = Math.hypot(dx, dz);
  if (meters < 1e-6) return null;
  // Seyirci sahneye (-front) bakar; sağ eli (front.z, -front.x) yönündedir.
  const forward = dx * stage.front.x + dz * stage.front.z;
  const lateral = dx * stage.front.z - dz * stage.front.x;
  const degrees = Math.round((Math.abs(Math.atan2(lateral, forward)) * 180) / Math.PI);
  const side = degrees <= CENTER_TOLERANCE ? "center" : lateral > 0 ? "right" : "left";
  return { meters, side, degrees: side === "center" ? 0 : degrees };
}

/** `"39m · Sağ 30°"`, `"12m · Orta"` biçimi. */
export function formatStageMetrics(m: StageMetrics): string {
  const angle = m.side === "center" ? "Orta" : `${m.side === "right" ? "Sağ" : "Sol"} ${m.degrees}°`;
  return `${Math.round(m.meters)}m · ${angle}`;
}
