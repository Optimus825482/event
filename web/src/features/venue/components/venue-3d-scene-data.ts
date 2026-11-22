import { statusColor, type PlanStatus } from "../plan-status";
import type { FloorPlanData } from "../plan-types";
import type { TableShape } from "../schemas";
import { DEFAULT_TABLE_COLOR, LOCA_COLOR } from "./editor-context";

/** 3B sahnenin çizdiği masa: düzenleyiciden ya da salt okunur plandan türetilir (saf veri). */
export type SceneTable = {
  key: string;
  label: string;
  capacity: number;
  x: number;
  y: number;
  rotation: number;
  isLoca: boolean;
  floor: number;
  /** Piksel cinsinden kenar; `null` ise kapasiteden türetilir. */
  size: number | null;
  shape: TableShape;
  /** Çözülmüş dolgu rengi. */
  color: string;
  /** Vurgulu masa: parlar ve zeminde halka çizilir. */
  highlighted: boolean;
  /** Soluk (seçilemez) masa. */
  dimmed: boolean;
};

export type PlanSceneOptions = {
  statuses?: Readonly<Record<string, PlanStatus>>;
  selectedId?: string | null;
  disabledIds?: readonly string[];
};

/** Salt okunur planı 3B sahne masalarına çevirir; renk önceliği 2B plandakiyle aynıdır (durum > loca > tip rengi). */
export function planToSceneTables(plan: FloorPlanData, options: PlanSceneOptions = {}): SceneTable[] {
  const disabled = new Set(options.disabledIds ?? []);
  return plan.tables.map((t) => ({
    key: t.id,
    label: t.label,
    capacity: t.capacity,
    x: t.x,
    y: t.y,
    rotation: t.rotation,
    isLoca: t.isLoca,
    floor: 1,
    size: null,
    shape: t.shape,
    color: statusColor(options.statuses?.[t.id]) ?? (t.isLoca ? LOCA_COLOR : (t.color ?? DEFAULT_TABLE_COLOR)),
    highlighted: options.selectedId != null && options.selectedId === t.id,
    dimmed: disabled.has(t.id),
  }));
}
