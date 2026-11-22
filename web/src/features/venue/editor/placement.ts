import { CELL_SIZE, insideCanvas, rectsOverlap, type Point, type Rect } from "./geometry";

export type Size = { width: number; height: number };
export type Canvas = { width: number; height: number };

/** Toplu eklemede en fazla adet (eski sihirbazla aynı). */
export const BULK_ADD_MAX = 200;
/** Toplu eklemede masalar ile engeller arasında bırakılan boşluk (px). */
export const BULK_ADD_GAP = 16;

export function boxAt(center: Point, size: Size): Rect {
  return { x: center.x - size.width / 2, y: center.y - size.height / 2, width: size.width, height: size.height };
}

function isFree(box: Rect, obstacles: readonly Rect[], canvas: Canvas, gap: number): boolean {
  return insideCanvas(box, canvas) && !obstacles.some((o) => rectsOverlap(box, o, gap));
}

/**
 * Akıllı yerleşim: hücre merkezlerinde satır satır yürür (varsayılan B1'den; `start` verilirse o hücreden,
 * sonraki satırlar yine B sütunundan başlar), engellere ve önceden yerleştirilenlere `gap` kadar yaklaşmadan
 * en fazla `count` merkez noktası döndürür. Z sütunu boş bırakılır. Yer biterse daha az nokta döner.
 */
export function placeInRows(opts: {
  count: number;
  footprint: Size;
  obstacles: readonly Rect[];
  canvas: Canvas;
  gap?: number;
  cell?: number;
  start?: Point;
}): Point[] {
  const cell = opts.cell ?? CELL_SIZE;
  const gap = opts.gap ?? BULK_ADD_GAP;
  const placedBoxes: Rect[] = [...opts.obstacles];
  const out: Point[] = [];
  const firstCol = cell * 1.5;
  const lastCol = Math.max(firstCol, opts.canvas.width - cell * 1.5);
  const cellCenter = (v: number) => Math.floor(v / cell) * cell + cell / 2;
  let x = opts.start ? Math.max(cell / 2, cellCenter(opts.start.x)) : firstCol;
  let y = opts.start ? Math.max(cell / 2, cellCenter(opts.start.y)) : cell / 2;
  while (out.length < opts.count && y - opts.footprint.height / 2 < opts.canvas.height) {
    if (x > lastCol) {
      x = firstCol;
      y += cell;
      continue;
    }
    const box = boxAt({ x, y }, opts.footprint);
    if (isFree(box, placedBoxes, opts.canvas, gap)) {
      out.push({ x, y });
      placedBoxes.push(box);
    }
    x += cell;
  }
  return out;
}

/**
 * `preferred` noktasından halka halka (adım `step`) dışarı doğru, kutusu tuvalde kalan ve engellerle
 * çakışmayan ilk merkez noktası; bulunamazsa null.
 */
export function findNearestFree(opts: {
  preferred: Point;
  footprint: Size;
  obstacles: readonly Rect[];
  canvas: Canvas;
  step?: number;
  gap?: number;
}): Point | null {
  const step = opts.step ?? CELL_SIZE / 2;
  const gap = opts.gap ?? 0;
  const fits = (p: Point) => isFree(boxAt(p, opts.footprint), opts.obstacles, opts.canvas, gap);
  if (fits(opts.preferred)) return opts.preferred;
  const maxRing = Math.ceil(Math.max(opts.canvas.width, opts.canvas.height) / step);
  for (let ring = 1; ring <= maxRing; ring += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const p = { x: opts.preferred.x + dx * step, y: opts.preferred.y + dy * step };
        if (fits(p)) return p;
      }
    }
  }
  return null;
}
