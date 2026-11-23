import { MIN_FLOOR, type DecorElement, type TableShape } from "../schemas";
import { rectsOverlap, rotatedExtent, tableFootprint, type Point, type Rect } from "./geometry";

/** Çakışma hesabı için masa alanları (store'daki `EditorTable`'ın alt kümesi). */
export type TableLike = {
  key: string;
  x: number;
  y: number;
  rotation: number;
  capacity: number;
  size: number | null;
  isLoca: boolean;
  isPinned: boolean;
  tableTypeId: string | null;
  floor: number;
};

export type ShapeOf = (t: Pick<TableLike, "tableTypeId">) => TableShape;

export type LayoutItem = {
  key: string;
  kind: "table" | "decor";
  box: Rect;
  /** Masaların üstüne binemeyeceği dekor (sahne, alan, duvar); metin etiketleri engel değildir. */
  obstacle: boolean;
  pinned: boolean;
  /** Kat; yalnızca aynı kattaki öğeler çakışır (loca altına masa konabilir). */
  floor: number;
  /** Her katta engel (duvar): katı ne olursa olsun tüm katlardaki masaları engeller. */
  allFloors: boolean;
};

export const decorItemKey = (id: string) => `d:${id}`;

/** Masanın eksen hizalı sınır kutusu; `at` verilirse o merkezde. */
export function tableBox(t: TableLike, shapeOf: ShapeOf, at?: Point): Rect {
  const fp = tableFootprint(t, shapeOf(t));
  const ext = rotatedExtent(fp.width, fp.height, t.rotation);
  const c = at ?? t;
  return { x: c.x - ext.width / 2, y: c.y - ext.height / 2, width: ext.width, height: ext.height };
}

/** Dekorun eksen hizalı sınır kutusu (Konva grubu sol-üst köşesi etrafında döner). */
export function decorBox(e: Pick<DecorElement, "x" | "y" | "width" | "height" | "rotation">, at?: Point): Rect {
  const o = at ?? e;
  const r = (e.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const corners = [
    [0, 0],
    [e.width, 0],
    [0, e.height],
    [e.width, e.height],
  ].map(([px = 0, py = 0]) => ({ x: o.x + px * cos - py * sin, y: o.y + px * sin + py * cos }));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/** Dekorun katı; kat alanı olmayan eski öğeler zemin kattır. */
export function decorFloor(e: Pick<DecorElement, "floor">): number {
  return e.floor ?? MIN_FLOOR;
}

export function isObstacleDecor(e: Pick<DecorElement, "kind">): boolean {
  return e.kind !== "label";
}

export function layoutItems(
  tables: readonly TableLike[],
  elements: readonly DecorElement[],
  shapeOf: ShapeOf,
): LayoutItem[] {
  return [
    ...tables.map((t) => ({ key: t.key, kind: "table" as const, box: tableBox(t, shapeOf), obstacle: true, pinned: t.isPinned, floor: t.floor, allFloors: false })),
    ...elements.map((e) => ({
      key: decorItemKey(e.id),
      kind: "decor" as const,
      box: decorBox(e),
      obstacle: isObstacleDecor(e),
      pinned: e.isPinned === true,
      floor: decorFloor(e),
      allFloors: e.kind === "wall",
    })),
  ];
}

/** Öğe verilen katta yer kaplıyor mu (duvar her katta kaplar). */
export function occupiesFloor(item: Pick<LayoutItem, "floor" | "allFloors">, floor: number): boolean {
  return item.allFloors || item.floor === floor;
}

/** Aynı kattaki masa–masa ve masa–engel dekor çakışır (duvar her katta); dekorlar birbirinin üstüne binebilir. */
export function itemsCollide(a: LayoutItem, b: LayoutItem): boolean {
  if (a.key === b.key || !(occupiesFloor(a, b.floor) || occupiesFloor(b, a.floor))) return false;
  if (a.kind === "decor" && b.kind === "decor") return false;
  if ((a.kind === "decor" && !a.obstacle) || (b.kind === "decor" && !b.obstacle)) return false;
  return rectsOverlap(a.box, b.box);
}

/**
 * Taşıma sonrası yeni bir çakışma doğuyorsa çakışan öğelerin anahtarları; yoksa boş dizi.
 * Önceden zaten çakışan (ör. eski veriden gelen) çiftler taşımayı engellemez.
 */
export function newCollisions(before: readonly LayoutItem[], after: readonly LayoutItem[], moved: ReadonlySet<string>): string[] {
  const prev = new Map(before.map((i) => [i.key, i]));
  const hits = new Set<string>();
  for (let i = 0; i < after.length; i += 1) {
    const a = after[i];
    if (!a) continue;
    for (let j = i + 1; j < after.length; j += 1) {
      const b = after[j];
      if (!b || (!moved.has(a.key) && !moved.has(b.key))) continue;
      if (!itemsCollide(a, b)) continue;
      const pa = prev.get(a.key);
      const pb = prev.get(b.key);
      if (pa && pb && itemsCollide(pa, pb)) continue;
      hits.add(a.key);
      hits.add(b.key);
    }
  }
  return [...hits];
}
