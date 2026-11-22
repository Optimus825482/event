import type { DecorElement, TableShape } from "./schemas";

/** Salt okunur alan planı için masa: yalnızca çizim için gereken alanlar (yeni isteğe bağlı alanlar eklenebilir). */
export type PlanTable = {
  id: string;
  label: string;
  capacity: number;
  x: number;
  y: number;
  rotation: number;
  isLoca: boolean;
  shape: TableShape;
  /** Masa tipinin rengi; tipsiz masada `null`. */
  color: string | null;
  /** Ekip masa grubu (varsa); planda masanın çevresine grup renginde halka çizilir. */
  group?: { name: string; color: string } | null;
};

export type FloorPlanData = {
  canvas: { width: number; height: number };
  tables: PlanTable[];
  decor: DecorElement[];
};
