import { LINE_COLORS, LINE_WIDTH_MAX, MAX_LINES, MIN_FLOOR, type DecorLine } from "../schemas";
import { snap, type Point, type Rect } from "./geometry";

/** Çizgi seçim anahtarı öneki (masalar `t:`, dekor `d:`). */
export const LINE_KEY_PREFIX = "l:";
export const lineKey = (id: string) => `${LINE_KEY_PREFIX}${id}`;
export const isLineKey = (key: string) => key.startsWith(LINE_KEY_PREFIX);

/** Yeni çizginin biçimi: eski sistemin grup çizgisi gibi kırmızı, 4 px. */
export const DEFAULT_LINE_STYLE = { color: LINE_COLORS[0], width: 4 } as const;
/** Bundan kısa çizgi (px) eklenmez: yanlışlıkla çift tıklama sıfır boylu çizgi üretmesin. */
export const MIN_LINE_LENGTH = 4;

type Canvas = { width: number; height: number };
export type LineEnd = "start" | "end";
export type EndpointOptions = { gridSize: number; snap: boolean; canvas: Canvas; constrain: boolean };

const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));

export function clampToCanvas(p: Point, canvas: Canvas): Point {
  return { x: clamp(p.x, canvas.width), y: clamp(p.y, canvas.height) };
}

/** Shift: uç, başlangıca göre baskın eksende kalır (yatay ya da dikey çizgi). */
export function constrainAxis(anchor: Point, p: Point): Point {
  return Math.abs(p.x - anchor.x) >= Math.abs(p.y - anchor.y) ? { x: p.x, y: anchor.y } : { x: anchor.x, y: p.y };
}

/**
 * İşaretçi konumunu çizgi ucuna çevirir: ızgaraya oturtur (açıksa), Shift ile eksene kilitler,
 * tuvalin içine kırpar. `anchor` diğer uçtur (ilk tıklamada yoktur).
 */
export function resolveEndpoint(raw: Point, anchor: Point | null, opts: EndpointOptions): Point {
  let p = opts.snap ? { x: snap(raw.x, opts.gridSize), y: snap(raw.y, opts.gridSize) } : raw;
  if (anchor && opts.constrain) p = constrainAxis(anchor, p);
  return clampToCanvas(p, opts.canvas);
}

/** Çizginin katı; kat alanı olmayan eski çizgiler zemin kattır. */
export function lineFloor(l: Pick<DecorLine, "floor">): number {
  return l.floor ?? MIN_FLOOR;
}

export function lineLength(l: Pick<DecorLine, "x1" | "y1" | "x2" | "y2">): number {
  return Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
}

export function isDrawable(a: Point, b: Point): boolean {
  return Math.hypot(b.x - a.x, b.y - a.y) >= MIN_LINE_LENGTH;
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Uçları tuvale kırpar ve iki haneye yuvarlar (kayıt doğrulamasını her zaman geçsin diye). */
export function normalizeLine(l: DecorLine, canvas: Canvas): DecorLine {
  const a = clampToCanvas({ x: l.x1, y: l.y1 }, canvas);
  const b = clampToCanvas({ x: l.x2, y: l.y2 }, canvas);
  return {
    ...l,
    x1: round(a.x),
    y1: round(a.y),
    x2: round(b.x),
    y2: round(b.y),
    width: Math.min(LINE_WIDTH_MAX, Math.max(1, Math.round(l.width))),
  };
}

/** Kayda gidecek çizgiler: kırpılır, sıfır boylular atılır, sınır aşılırsa fazlası düşer. */
export function linesForSave(lines: readonly DecorLine[], canvas: Canvas): DecorLine[] {
  return lines
    .map((l) => normalizeLine(l, canvas))
    .filter((l) => l.x1 !== l.x2 || l.y1 !== l.y2)
    .slice(0, MAX_LINES);
}

export function setEndpoint(l: DecorLine, end: LineEnd, p: Point): DecorLine {
  return end === "start" ? { ...l, x1: p.x, y1: p.y } : { ...l, x2: p.x, y2: p.y };
}

/** Çizgiyi kaydırır; çizgi tuvalden taşmayacak şekilde kayma kırpılır. */
export function translateLine(l: DecorLine, dx: number, dy: number, canvas: Canvas): DecorLine {
  const minX = Math.min(l.x1, l.x2);
  const maxX = Math.max(l.x1, l.x2);
  const minY = Math.min(l.y1, l.y2);
  const maxY = Math.max(l.y1, l.y2);
  const cx = Math.min(canvas.width - maxX, Math.max(-minX, dx));
  const cy = Math.min(canvas.height - maxY, Math.max(-minY, dy));
  return { ...l, x1: l.x1 + cx, y1: l.y1 + cy, x2: l.x2 + cx, y2: l.y2 + cy };
}

/** Seçili çizgileri kaydırır (tuvale kırpılır); değişmeyenler aynı nesne kalır. */
export function nudgeLines(
  lines: readonly DecorLine[],
  selected: ReadonlySet<string>,
  dx: number,
  dy: number,
  canvas: Canvas,
): { lines: DecorLine[]; moved: number } {
  let moved = 0;
  const next = lines.map((l) => {
    if (!selected.has(lineKey(l.id))) return l;
    const t = translateLine(l, dx, dy, canvas);
    if (t.x1 === l.x1 && t.y1 === l.y1 && t.x2 === l.x2 && t.y2 === l.y2) return l;
    moved += 1;
    return t;
  });
  return { lines: next, moved };
}

/** Kement seçimi: orta noktası dikdörtgenin içindeki çizgiler. */
export function linesInRect(lines: readonly DecorLine[], rect: Rect): string[] {
  return lines
    .filter((l) => {
      const mx = (l.x1 + l.x2) / 2;
      const my = (l.y1 + l.y2) / 2;
      return mx >= rect.x && mx <= rect.x + rect.width && my >= rect.y && my <= rect.y + rect.height;
    })
    .map((l) => lineKey(l.id));
}

/** Seçili çizgilerin kopyaları (`offset` kadar kaydırılmış, yeni kimlikli). */
export function copyLines(lines: readonly DecorLine[], selected: ReadonlySet<string>, offset: number, canvas: Canvas, newId: () => string): DecorLine[] {
  return lines
    .filter((l) => selected.has(lineKey(l.id)))
    .map((l) => ({ ...translateLine(l, offset, offset, canvas), id: newId() }));
}

/** 3B zemin şeridi: merkez, uzunluk ve (Y ekseni çevresinde) açı, tuval pikseli cinsinden. */
export function lineStrip(l: DecorLine): { cx: number; cy: number; length: number; angle: number } {
  return {
    cx: (l.x1 + l.x2) / 2,
    cy: (l.y1 + l.y2) / 2,
    length: lineLength(l),
    angle: Math.atan2(l.y2 - l.y1, l.x2 - l.x1),
  };
}
