import type { TableShape } from "../schemas";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export const GRID_SIZE = 20;
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4;

/** Değeri en yakın ızgara çizgisine yuvarlar; `grid <= 0` ise değeri değiştirmez. */
export function snap(value: number, grid: number): number {
  if (grid <= 0) return value;
  const snapped = Math.round(value / grid) * grid;
  return snapped === 0 ? 0 : snapped;
}

export function snapPoint(point: Point, grid: number, enabled: boolean): Point {
  return enabled ? { x: snap(point.x, grid), y: snap(point.y, grid) } : point;
}

/** Dönüşü 0..360 aralığına indirger (açıyı ızgaraya göre değil, 15°'lik adımlara oturtmak isteğe bağlıdır). */
export function normalizeAngle(deg: number, step = 0): number {
  const stepped = step > 0 ? Math.round(deg / step) * step : deg;
  const r = ((stepped % 360) + 360) % 360;
  return Math.round(r * 1000) / 1000;
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** İmleç altındaki noktayı sabit tutarak yakınlaştırır; yeni ölçek ve konumu döner. */
export function zoomAround(
  view: { scale: number; x: number; y: number },
  pointer: Point,
  nextScale: number,
): { scale: number; x: number; y: number } {
  const scale = clampZoom(nextScale);
  const world = { x: (pointer.x - view.x) / view.scale, y: (pointer.y - view.y) / view.scale };
  return { scale, x: pointer.x - world.x * scale, y: pointer.y - world.y * scale };
}

/** Masanın tuvaldeki boyutu: kapasite büyüdükçe masa büyür (merkez noktası x,y). */
export function tableSize(shape: TableShape, capacity: number): { width: number; height: number } {
  const c = Math.min(Math.max(capacity, 1), 30);
  if (shape === "rectangle") return { width: 48 + c * 6, height: 44 };
  const side = 36 + c * 2.5;
  return { width: side, height: side };
}

export function normalizeRect(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

export function containsPoint(rect: Rect, p: Point): boolean {
  return p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
}

/**
 * Yeni masa etiketi: mevcut etiketlerin sonundaki en büyük sayıdan bir fazlası,
 * etiketin sayı öncesi kısmı korunur ("M12" -> "M13"). Hiç sayı yoksa "1".
 */
export function nextLabel(labels: readonly string[], prefix?: string): string {
  const taken = new Set(labels.map((l) => l.trim().toLocaleLowerCase("tr")));
  let max = 0;
  let lastPrefix = "";
  for (const label of labels) {
    const match = /^(.*?)(\d+)$/.exec(label.trim());
    if (!match) continue;
    const n = Number(match[2]);
    if (n >= max) {
      max = n;
      lastPrefix = match[1] ?? "";
    }
  }
  const base = prefix ?? lastPrefix;
  let n = max + 1;
  while (taken.has(`${base}${n}`.toLocaleLowerCase("tr"))) n += 1;
  return `${base}${n}`;
}

/**
 * İstenen noktadan başlayıp halka halka dışarı doğru, `step` aralıklı ilk boş noktayı bulur
 * (bir noktanın her iki eksende de `step`'ten yakın başka masası varsa "dolu" sayılır).
 * `bounds` verilirse aday noktalar tuvalin içinde kalır. Yer yoksa istenen nokta döner.
 */
export function findFreeSpot(
  preferred: Point,
  occupied: readonly Point[],
  step: number,
  bounds?: { width: number; height: number },
): Point {
  const isFree = (p: Point) => !occupied.some((o) => Math.abs(o.x - p.x) < step && Math.abs(o.y - p.y) < step);
  const inside = (p: Point) => !bounds || (p.x >= 0 && p.y >= 0 && p.x <= bounds.width && p.y <= bounds.height);
  if (step <= 0 || isFree(preferred)) return preferred;
  const maxRing = bounds ? Math.ceil(Math.max(bounds.width, bounds.height) / step) : 50;
  for (let ring = 1; ring <= maxRing; ring += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const candidate = { x: preferred.x + dx * step, y: preferred.y + dy * step };
        if (inside(candidate) && isFree(candidate)) return candidate;
      }
    }
  }
  return preferred;
}
