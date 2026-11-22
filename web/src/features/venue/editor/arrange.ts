import { CELL_SIZE, insideCanvas, rectsOverlap, unionRect, type Point, type Rect } from "./geometry";
import type { Canvas } from "./placement";

/** Düzenlenecek öğe: merkez (x,y) ve eksen hizalı kutu boyutu. */
export type ArrangeItem = { key: string; x: number; y: number; width: number; height: number };
export type ArrangeResult = { positions: Map<string, Point>; unplaced: string[] };

/** Otomatik hizalamada masalar arası boşluk (px). */
export const ALIGN_GAP = 8;
export const SPACING_MIN = 0;
export const SPACING_MAX = 40;
export const SPACING_PRESETS = [0, 4, 8, 16, 24] as const;

const topLeft = (it: ArrangeItem): Point => ({ x: it.x - it.width / 2, y: it.y - it.height / 2 });
const boxOf = (it: ArrangeItem, at: Point): Rect => ({ x: at.x, y: at.y, width: it.width, height: it.height });
const centreOf = (it: ArrangeItem, at: Point): Point => ({ x: at.x + it.width / 2, y: at.y + it.height / 2 });

function blocked(box: Rect, fixed: readonly Rect[], placed: readonly Rect[], gap: number): boolean {
  return fixed.some((o) => rectsOverlap(box, o, gap)) || placed.some((o) => rectsOverlap(box, o, gap));
}

/**
 * "Otomatik Hizala": öğeler verilen sırayla (masa numarası) satırlara dizilir; B sütunundan başlar,
 * Z sütununa girmeden alt satıra geçer, `fixed` kutularına (sabit masalar, sahne/alan, seçili olmayanlar)
 * çarpmadan boş yer arar. Sığmayan öğe yerinde kalır ve `unplaced` içinde döner.
 */
export function autoAlign(
  items: readonly ArrangeItem[],
  fixed: readonly Rect[],
  canvas: Canvas,
  opts: { start?: Point; gap?: number; cell?: number } = {},
): ArrangeResult {
  const cell = opts.cell ?? CELL_SIZE;
  const gap = opts.gap ?? ALIGN_GAP;
  const minX = opts.start?.x ?? cell;
  const maxX = canvas.width - cell;
  const step = cell / 2;
  const placed: Rect[] = [];
  const positions = new Map<string, Point>();
  const unplaced: string[] = [];
  const maxAttempts = (Math.ceil(canvas.width / step) + 1) * (Math.ceil(canvas.height / step) + 1);
  let cur: Point = { x: minX, y: opts.start?.y ?? gap };
  let rowY = cur.y;
  let rowH = 0;

  for (const it of items) {
    let at: Point = { ...cur };
    if (at.x + it.width > maxX) at = { x: minX, y: rowY + rowH + gap };
    const ok = (p: Point) => {
      const box = boxOf(it, p);
      return insideCanvas(box, canvas) && box.x + box.width <= Math.max(maxX, minX + it.width) && !blocked(box, fixed, placed, gap);
    };
    let attempts = 0;
    while (!ok(at) && attempts < maxAttempts && at.y + it.height <= canvas.height) {
      at = { x: at.x + step, y: at.y };
      if (at.x + it.width > maxX) at = { x: minX, y: at.y + step };
      attempts += 1;
    }
    if (!ok(at)) {
      unplaced.push(it.key);
      continue;
    }
    const box = boxOf(it, at);
    placed.push(box);
    positions.set(it.key, centreOf(it, at));
    if (at.y !== rowY) {
      rowY = at.y;
      rowH = it.height;
    } else {
      rowH = Math.max(rowH, it.height);
    }
    cur = { x: at.x + it.width + gap, y: at.y };
  }
  return { positions, unplaced };
}

/**
 * "Merkezle": her öğenin merkezini en yakın hücre merkezine oturtur; hücre doluysa (kutu başka bir
 * öğeyle ya da `fixed` ile çakışıyorsa) spiral arama ile en yakın uygun hücreyi seçer. Sol-üstten sağ-alta işlenir.
 */
export function snapToCellCentres(
  items: readonly ArrangeItem[],
  fixed: readonly Rect[],
  canvas: Canvas,
  cell = CELL_SIZE,
): ArrangeResult {
  const ordered = [...items].sort((a, b) => Math.round(a.y / cell) - Math.round(b.y / cell) || a.x - b.x);
  const placed: Rect[] = [];
  const positions = new Map<string, Point>();
  const unplaced: string[] = [];
  const maxRadius = Math.ceil(Math.max(canvas.width, canvas.height) / cell);
  for (const it of ordered) {
    const col = Math.round((it.x - cell / 2) / cell);
    const row = Math.round((it.y - cell / 2) / cell);
    let found: Point | null = null;
    for (let r = 0; r <= maxRadius && !found; r += 1) {
      const ring: Array<{ p: Point; d: number }> = [];
      for (let dc = -r; dc <= r; dc += 1) {
        for (let dr = -r; dr <= r; dr += 1) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== r) continue;
          const p = { x: (col + dc) * cell + cell / 2, y: (row + dr) * cell + cell / 2 };
          ring.push({ p, d: Math.hypot(p.x - it.x, p.y - it.y) });
        }
      }
      ring.sort((a, b) => a.d - b.d);
      for (const { p } of ring) {
        const box = boxOf(it, topLeft({ ...it, ...p }));
        if (insideCanvas(box, canvas) && !blocked(box, fixed, placed, 0)) {
          found = p;
          break;
        }
      }
    }
    if (!found) {
      unplaced.push(it.key);
      placed.push(boxOf(it, topLeft(it)));
      continue;
    }
    placed.push(boxOf(it, topLeft({ ...it, ...found })));
    positions.set(it.key, found);
  }
  return { positions, unplaced };
}

/**
 * "Aralık Ayarla": öğeler Y'ye göre satırlara ayrılır (yakın Y aynı satır), satır içinde verilen sırada
 * (masa numarası) aralarında `gap` px kalacak şekilde soldan dizilir; satırlar da `gap` aralıkla alt alta gelir.
 * Engel varsa sağa kaydırılır; tuvale sığmayan öğe yerinde kalır.
 */
export function applySpacing(
  items: readonly ArrangeItem[],
  gap: number,
  fixed: readonly Rect[],
  canvas: Canvas,
  cell = CELL_SIZE,
): ArrangeResult {
  const g = Math.min(SPACING_MAX, Math.max(SPACING_MIN, gap));
  const order = new Map(items.map((it, i) => [it.key, i]));
  const rows: ArrangeItem[][] = [];
  for (const it of [...items].sort((a, b) => a.y - b.y)) {
    const row = rows.find((r) => r[0] && Math.abs(r[0].y - it.y) <= cell * 0.8);
    if (row) row.push(it);
    else rows.push([it]);
  }
  for (const row of rows) row.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
  const all = unionRect(items.map((it) => boxOf(it, topLeft(it))));
  const positions = new Map<string, Point>();
  const unplaced: string[] = [];
  if (!all) return { positions, unplaced };
  const placed: Rect[] = [];
  let top = Math.min(...(rows[0] ?? []).map((it) => topLeft(it).y));
  for (const row of rows) {
    const rowH = Math.max(...row.map((it) => it.height));
    let x = all.x;
    for (const it of row) {
      let at: Point = { x, y: top + (rowH - it.height) / 2 };
      while (blocked(boxOf(it, at), fixed, placed, 0) && at.x + it.width <= canvas.width) at = { x: at.x + it.width + g, y: at.y };
      const box = boxOf(it, at);
      if (!insideCanvas(box, canvas) || blocked(box, fixed, placed, 0)) {
        unplaced.push(it.key);
        continue;
      }
      placed.push(box);
      positions.set(it.key, centreOf(it, at));
      x = at.x + it.width + g;
    }
    top += rowH + g;
  }
  return { positions, unplaced };
}

/** "Yatay Ortala": grubu tuvalin yatay ortasına getirmek için gereken x kayması. */
export function horizontalCentreDelta(boxes: readonly Rect[], canvas: Canvas): number {
  const u = unionRect(boxes);
  if (!u) return 0;
  return Math.round(((canvas.width - u.width) / 2 - u.x) * 100) / 100;
}
