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

/** Kapasiteden türetilen yuvarlak masa çapı (px). */
export function derivedTableSize(capacity: number): number {
  return tableSize("round", capacity).width;
}

/**
 * Masanın tek doğruluk kaynağı olan çizim boyutu (çap / uzun kenar, px):
 * kullanıcının verdiği `size` varsa o, yoksa kapasiteden türetilen boyut.
 */
export function effectiveTableSize(t: { size: number | null; capacity: number; isLoca: boolean }): number {
  if (t.size !== null && Number.isFinite(t.size) && t.size > 0) return t.size;
  return derivedTableSize(t.capacity);
}

/**
 * Masanın döndürülmemiş kutusu (merkez x,y): `size` verilmişse yuvarlak/kare için size×size,
 * dikdörtgende uzun kenar = size ve kapasiteden türetilen en-boy oranı korunur.
 */
export function tableFootprint(
  t: { size: number | null; capacity: number; isLoca: boolean },
  shape: TableShape,
): { width: number; height: number } {
  const derived = tableSize(shape, t.capacity);
  if (t.size === null || !(t.size > 0)) return derived;
  const s = effectiveTableSize(t);
  if (shape !== "rectangle") return { width: s, height: s };
  return { width: s, height: (s * derived.height) / derived.width };
}

/** `width×height` kutusu `deg` derece döndürüldüğünde eksen hizalı sınır kutusunun boyutu. */
export function rotatedExtent(width: number, height: number, deg: number): { width: number; height: number } {
  const r = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return { width: round(width * c + height * s), height: round(width * s + height * c) };
}

/** Eski düzenleyicinin hücre boyu (A–Z sütunları, 1.. satırları). */
export const CELL_SIZE = 40;

/** 0 → "A", 25 → "Z", 26 → "AA". */
export function columnName(index: number): string {
  let n = Math.max(0, Math.floor(index));
  let name = "";
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return name;
}

/** Tuval noktasının hücre adı ("B3"): sütun harfi + 1'den başlayan satır numarası. */
export function cellName(p: Point, cell = CELL_SIZE): string {
  const col = Math.max(0, Math.floor(p.x / cell));
  const row = Math.max(0, Math.floor(p.y / cell)) + 1;
  return `${columnName(col)}${row}`;
}

/** Noktanın bulunduğu hücrenin merkezi. */
export function cellCenter(p: Point, cell = CELL_SIZE): Point {
  return { x: Math.floor(p.x / cell) * cell + cell / 2, y: Math.floor(p.y / cell) * cell + cell / 2 };
}

/** İki kutu gerçekten üst üste biniyorsa true (kenar teması çakışma sayılmaz); `gap` kadar boşluk istenir. */
export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return (
    a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y
  );
}

/** Kutu tuvalin tamamen içinde mi (kenara değmek serbest). */
export function insideCanvas(r: Rect, canvas: { width: number; height: number }): boolean {
  const eps = 1e-6;
  return r.x >= -eps && r.y >= -eps && r.x + r.width <= canvas.width + eps && r.y + r.height <= canvas.height + eps;
}

/** Kutuların birleşimi; boş listede null. */
export function unionRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Bir grup kutuyu `delta` kadar taşırken tuval dışına taşmayacak şekilde düzeltilmiş delta.
 * Grup tuvalden büyükse sol/üst kenar hizalanır.
 */
export function clampDelta(rects: readonly Rect[], delta: Point, canvas: { width: number; height: number }): Point {
  const u = unionRect(rects);
  if (!u) return delta;
  const axis = (start: number, size: number, d: number, limit: number) => {
    const min = -start;
    const max = limit - (start + size);
    if (max < min) return min;
    return Math.min(max, Math.max(min, d));
  };
  return { x: axis(u.x, u.width, delta.x, canvas.width), y: axis(u.y, u.height, delta.y, canvas.height) };
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
 * `prefix` + sayı biçimindeki etiketler arasında en büyük sayıdan bir fazlası ("L3" → "L4").
 * Başka önekli etiketler sayılmaz; `taken` içindeki (tüm) etiketlerle çakışma atlanır.
 */
export function nextPrefixedLabel(labels: readonly string[], prefix: string, taken: readonly string[] = labels): string {
  const used = new Set(taken.map((l) => l.trim().toLocaleLowerCase("tr")));
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`, "i");
  let max = 0;
  for (const label of labels) {
    const match = re.exec(label.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  let n = max + 1;
  while (used.has(`${prefix}${n}`.toLocaleLowerCase("tr"))) n += 1;
  return `${prefix}${n}`;
}

/** Etiketin sonundaki sayı ("M12" → 12); yoksa null. */
export function labelNumber(label: string): number | null {
  const match = /(\d+)$/.exec(label.trim());
  return match ? Number(match[1]) : null;
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
