import type { TableShape } from "../schemas";

/** Eski düzenleyicideki kapasite renkleri (dolgu + açık çerçeve tonu). */
export const CAPACITY_COLORS = [
  { capacity: 4, fill: "#22c55e", border: "#4ade80" },
  { capacity: 6, fill: "#3b82f6", border: "#60a5fa" },
  { capacity: 8, fill: "#6366f1", border: "#818cf8" },
  { capacity: 10, fill: "#8b5cf6", border: "#a78bfa" },
  { capacity: 12, fill: "#a855f7", border: "#c084fc" },
  { capacity: 14, fill: "#d946ef", border: "#e879f9" },
  { capacity: 16, fill: "#ec4899", border: "#f472b6" },
  { capacity: 20, fill: "#f43f5e", border: "#fb7185" },
] as const;

export type CapacityColor = (typeof CAPACITY_COLORS)[number];

/** Kapasiteye en yakın renk (eşitlikte küçük kapasite kazanır). */
export function capacityColor(capacity: number): CapacityColor {
  let best: CapacityColor = CAPACITY_COLORS[0];
  for (const c of CAPACITY_COLORS) {
    if (Math.abs(c.capacity - capacity) < Math.abs(best.capacity - capacity)) best = c;
  }
  return best;
}

export const VIP_FILL = "#f59e0b";
export const VIP_BORDER = "#fbbf24";
export const LOCA_BORDER = "#ec4899";
export const PIN_BADGE_FILL = "#f59e0b";

export const SIZE_PRESETS = [
  { id: "xs", label: "XS", size: 24 },
  { id: "s", label: "S", size: 32 },
  { id: "m", label: "M", size: 40 },
  { id: "l", label: "L", size: 48 },
  { id: "xl", label: "XL", size: 56 },
  { id: "xxl", label: "XXL", size: 64 },
] as const;
export const SIZE_SLIDER_MIN = 20;
export const SIZE_SLIDER_MAX = 80;

export const FLOOR_OPTIONS = [
  { value: 1, label: "Zemin Kat" },
  { value: 2, label: "2. Kat" },
  { value: 3, label: "3. Kat" },
] as const;

export function floorLabel(floor: number): string {
  return FLOOR_OPTIONS.find((o) => o.value === floor)?.label ?? `${floor}. Kat`;
}

/** Masanın tuvaldeki kutusu: loca 1.2x0.9 oranlı kabin, dikdörtgen masa uzun kenar `size`. */
export function tableDims(shape: TableShape, isLoca: boolean, size: number): { width: number; height: number } {
  if (isLoca) return { width: size * 1.2, height: size * 0.9 };
  if (shape === "rectangle") return { width: size, height: size * 0.6 };
  return { width: size, height: size };
}

type SizedTable = { key: string; tableTypeId: string | null; capacity: number; isLoca: boolean };

/** "Aynı Tip Masaları Eşitle": kaynakla aynı tip + kapasite + loca durumundaki diğer masaların anahtarları. */
export function equalizeTargets(tables: readonly SizedTable[], sourceKey: string): string[] {
  const source = tables.find((t) => t.key === sourceKey);
  if (!source) return [];
  return tables
    .filter(
      (t) =>
        t.key !== sourceKey &&
        t.tableTypeId === source.tableTypeId &&
        t.capacity === source.capacity &&
        t.isLoca === source.isLoca,
    )
    .map((t) => t.key);
}

/** 3B sahnede her kat arasındaki yükseklik (birim). */
export const FLOOR_HEIGHT = 3;

/** Kat yüksekliği: zemin kat 0, her üst kat `FLOOR_HEIGHT` kadar yukarıda. */
export function floorElevation(floor: number): number {
  return Math.max(0, floor - 1) * FLOOR_HEIGHT;
}
