import type { Point } from "./geometry";

/** Düzenleyici görünüm ayarları (sistem ayarlarından); eksik/geçersiz değer varsayılana düşer. */
export type ViewSettings = { gridSize: number; snap: boolean; showGrid: boolean };

export const DEFAULT_VIEW_SETTINGS: ViewSettings = { gridSize: 20, snap: true, showGrid: true };
export const MIN_GRID_SIZE = 5;
export const MAX_GRID_SIZE = 100;

export function resolveViewSettings(raw: Partial<Record<keyof ViewSettings, unknown>> | null | undefined): ViewSettings {
  const size = raw?.gridSize;
  const gridSize =
    typeof size === "number" && Number.isFinite(size)
      ? Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, Math.round(size)))
      : DEFAULT_VIEW_SETTINGS.gridSize;
  return {
    gridSize,
    snap: typeof raw?.snap === "boolean" ? raw.snap : DEFAULT_VIEW_SETTINGS.snap,
    showGrid: typeof raw?.showGrid === "boolean" ? raw.showGrid : DEFAULT_VIEW_SETTINGS.showGrid,
  };
}

/** Sütun harfi: 0 → A, 25 → Z, 26 → AA. */
export function columnLabel(index: number): string {
  let n = Math.max(0, Math.floor(index));
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** Hücre adı ("B3"): sütun harfi + 1 tabanlı satır. Tuval dışı (negatif) konum için `null`. */
export function cellName(point: Point, cellSize: number): string | null {
  if (cellSize <= 0 || point.x < 0 || point.y < 0) return null;
  return `${columnLabel(Math.floor(point.x / cellSize))}${Math.floor(point.y / cellSize) + 1}`;
}

export type RulerTick = { index: number; label: string; /** Hücre merkezinin ekran konumu (px). */ center: number };

/**
 * Cetvel etiketleri. `axis` "x" için harfler, "y" için sayılar; hücreler `scale` ile küçüldüğünde
 * etiketler en az `minGap` px aralıklı kalacak şekilde seyreltilir.
 */
export function rulerTicks(
  axis: "x" | "y",
  length: number,
  cellSize: number,
  view: { scale: number; offset: number },
  minGap = 28,
): RulerTick[] {
  if (cellSize <= 0 || length <= 0 || view.scale <= 0) return [];
  const count = Math.ceil(length / cellSize);
  const every = Math.max(1, Math.ceil(minGap / (cellSize * view.scale)));
  const ticks: RulerTick[] = [];
  for (let i = 0; i < count; i += every) {
    ticks.push({
      index: i,
      label: axis === "x" ? columnLabel(i) : String(i + 1),
      center: view.offset + (i + 0.5) * cellSize * view.scale,
    });
  }
  return ticks;
}
