import { COLORS } from "@/lib/theme";
import { decorCenter, type PlanDecor } from "../decor";
import type { PlanModel, PlanTableModel } from "../model";

/** Tuvalde 50 piksel = 3B sahnede 1 birim (~1 metre). */
export const WORLD_SCALE = 50;

/** Tuval pikselini salon-orijinli dünya koordinatına (x, z) çevirir. */
export function toWorld(canvas: { width: number; height: number }, x: number, y: number): [number, number] {
  return [x / WORLD_SCALE - canvas.width / WORLD_SCALE / 2, y / WORLD_SCALE - canvas.height / WORLD_SCALE / 2];
}

export type SceneState = "free" | "partial" | "full" | "closed";

/** 3B sahnenin çizdiği masa (saf veri). */
export type SceneTable = {
  key: string;
  label: string;
  capacity: number;
  x: number;
  y: number;
  rotation: number;
  shape: PlanTableModel["shape"];
  isLoca: boolean;
  width: number;
  height: number;
  /** Masa üst tablası rengi (tema belirteci). */
  color: string;
  /** Masa örtüsü/gövde rengi: durumu büyük yüzeyde gösterir (tema belirteci). */
  bodyColor: string;
  state: SceneState;
  selected: boolean;
  selectable: boolean;
};

function sceneState(table: PlanTableModel): SceneState {
  if (table.status === "not_sellable") return "closed";
  if (table.status === "sold_out") return "full";
  return table.free !== null && table.seats !== null && table.free < table.seats ? "partial" : "free";
}

/** 2B `table-style.ts` anlamları: seçili > kapalı > dolu > kısmen dolu (soluk ton) > boş (standart fildişi, premium/VIP altın). */
function sceneColor(table: PlanTableModel, state: SceneState, selected: boolean): string {
  if (selected) return COLORS.goldBright;
  if (state === "closed") return COLORS.surface;
  if (state === "full") return COLORS.disabledBg;
  if (state === "partial") return COLORS.muted;
  return table.category === "premium" || table.category === "vip" ? COLORS.gold : COLORS.ivory;
}

/** Örtü rengi: seçili > kapalı > dolu > kısmen dolu > boş (2B `table-style.ts` anlamları). */
function bodyColorOf(state: SceneState, selected: boolean): string {
  if (selected) return COLORS.goldBright;
  if (state === "closed") return COLORS.surface;
  if (state === "full") return COLORS.disabledBg;
  if (state === "partial") return COLORS.muted;
  return COLORS.ivory;
}

export function planToSceneTables(model: PlanModel, opts: { selectedId: string | null }): SceneTable[] {
  return model.tables.map((table) => {
    const state = sceneState(table);
    const selectable = table.status === "available";
    const selected = selectable && table.id === opts.selectedId;
    return {
      key: table.id,
      label: table.label,
      capacity: table.seats ?? 0,
      x: table.x,
      y: table.y,
      rotation: table.rotation,
      shape: table.shape,
      isLoca: table.isLoca,
      width: table.width,
      height: table.height,
      color: sceneColor(table, state, selected),
      bodyColor: bodyColorOf(state, selected),
      state,
      selected,
      selectable,
    };
  });
}

/** Dekor: merkez noktası (2B'deki döndürme pivotu) ve radyan cinsinden açı. */
export type SceneDecor = { id: string; kind: PlanDecor["kind"]; x: number; y: number; width: number; height: number; angle: number };

export function planToSceneDecor(model: PlanModel): SceneDecor[] {
  return model.decor.map((d) => {
    const c = decorCenter(d);
    return { id: d.id, kind: d.kind, x: c.x, y: c.y, width: d.width, height: d.height, angle: (d.rotation * Math.PI) / 180 };
  });
}

/** Ayırıcı çizgi: zeminde ince şerit. */
export type SceneLine = { id: string; cx: number; cy: number; length: number; angle: number; width: number };

export function planToSceneLines(model: PlanModel): SceneLine[] {
  return model.lines.map((l) => ({
    id: l.id,
    cx: (l.x1 + l.x2) / 2,
    cy: (l.y1 + l.y2) / 2,
    length: Math.hypot(l.x2 - l.x1, l.y2 - l.y1),
    angle: Math.atan2(l.y2 - l.y1, l.x2 - l.x1),
    width: l.width,
  }));
}
