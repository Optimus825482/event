import type { DecorElement } from "../schemas";
import { applySpacing, autoAlign, horizontalCentreDelta, snapToCellCentres, type ArrangeItem, type ArrangeResult } from "./arrange";
import { decorItemKey, layoutItems, newCollisions, occupiesFloor, tableBox, type ShapeOf } from "./collision";
import { clampDelta, labelNumber, nextLabel, nextPrefixedLabel, normalizeAngle, snapPoint, tableFootprint, unionRect, type Point } from "./geometry";
import { BULK_ADD_MAX, placeInRows } from "./placement";
import type { EditorTable, Placement } from "./types";

/** Araç işlemlerinin okuduğu düzenleyici durumu. */
export type ToolCtx = {
  tables: readonly EditorTable[];
  elements: readonly DecorElement[];
  canvas: { width: number; height: number };
  selection: readonly string[];
  shapeOf: ShapeOf;
  gridSize: number;
  snapEnabled: boolean;
  /** Donmuş masa anahtarları: sabitlenmiş gibi taşınmaz (kullanıcı sabitlemeyi kaldırsa da). */
  frozenKeys: ReadonlySet<string>;
};

export type MoveOutcome =
  | { ok: true; tables: EditorTable[]; elements: DecorElement[]; moved: number }
  | { ok: false; reason: "collision"; keys: string[] }
  | { ok: false; reason: "nothing" };

/** Masa sırası: önce masalar sonra localar; sıra numarası, etiket sayısı, sonra etiket. */
export function compareTables(a: EditorTable, b: EditorTable): number {
  const na = a.sortNumber ?? labelNumber(a.label) ?? Number.MAX_SAFE_INTEGER;
  const nb = b.sortNumber ?? labelNumber(b.label) ?? Number.MAX_SAFE_INTEGER;
  return Number(a.isLoca) - Number(b.isLoca) || na - nb || a.label.localeCompare(b.label, "tr", { numeric: true });
}

/**
 * Konumları değiştirir; sabitlenmiş öğeler atlanır, grup tuval içine geri itilir ve yeni bir çakışma
 * (masa–masa, masa–sahne/alan/duvar) doğuyorsa hiçbir şey taşınmaz.
 */
export function applyMoves(ctx: ToolCtx, placements: readonly Placement[], opts: { snap: boolean }): MoveOutcome {
  const pinned = new Set([
    ...ctx.tables.filter((t) => t.isPinned).map((t) => t.key),
    ...ctx.frozenKeys,
    ...ctx.elements.filter((e) => e.isPinned === true).map((e) => decorItemKey(e.id)),
  ]);
  const wanted = placements.filter((p) => !pinned.has(p.key));
  if (wanted.length === 0) return { ok: false, reason: "nothing" };
  const byKey = new Map(wanted.map((p) => [p.key, p]));
  const place = (p: Placement): Point =>
    opts.snap ? snapPoint({ x: p.x, y: p.y }, ctx.gridSize, ctx.snapEnabled) : { x: p.x, y: p.y };

  const build = (shift: Point) => {
    const tables = ctx.tables.map((t) => {
      const p = byKey.get(t.key);
      if (!p) return t;
      const at = place(p);
      return { ...t, x: at.x + shift.x, y: at.y + shift.y, rotation: normalizeAngle(p.rotation ?? t.rotation) };
    });
    const elements = ctx.elements.map((e) => {
      const p = byKey.get(decorItemKey(e.id));
      if (!p) return e;
      const at = place(p);
      return {
        ...e,
        x: at.x + shift.x,
        y: at.y + shift.y,
        width: Math.max(4, p.width ?? e.width),
        height: Math.max(4, p.height ?? e.height),
        rotation: normalizeAngle(p.rotation ?? e.rotation),
      };
    });
    return { tables, elements };
  };

  let next = build({ x: 0, y: 0 });
  const movedBoxes = layoutItems(next.tables, next.elements, ctx.shapeOf).filter((i) => byKey.has(i.key)).map((i) => i.box);
  const fix = clampDelta(movedBoxes, { x: 0, y: 0 }, ctx.canvas);
  if (fix.x !== 0 || fix.y !== 0) {
    const g = opts.snap && ctx.snapEnabled ? ctx.gridSize : 0;
    const away = (v: number) => (g > 0 && v !== 0 ? Math.sign(v) * Math.ceil(Math.abs(v) / g) * g : v);
    const grid = { x: away(fix.x), y: away(fix.y) };
    const shifted = build(grid);
    const ok = layoutItems(shifted.tables, shifted.elements, ctx.shapeOf).every(
      (i) => !byKey.has(i.key) || clampDelta([i.box], { x: 0, y: 0 }, ctx.canvas).x === 0,
    );
    next = ok ? shifted : build(fix);
  }
  const before = layoutItems(ctx.tables, ctx.elements, ctx.shapeOf);
  const after = layoutItems(next.tables, next.elements, ctx.shapeOf);
  const hits = newCollisions(before, after, new Set(byKey.keys()));
  if (hits.length > 0) return { ok: false, reason: "collision", keys: hits };
  return { ok: true, ...next, moved: wanted.length };
}

/** Seçili, sabitlenmemiş öğeleri `dx,dy` kadar kaydırır (ızgaraya oturtmadan). */
export function nudgeMoves(ctx: ToolCtx, dx: number, dy: number): MoveOutcome {
  const selected = new Set(ctx.selection);
  const placements: Placement[] = [
    ...ctx.tables.filter((t) => selected.has(t.key)).map((t) => ({ key: t.key, x: t.x + dx, y: t.y + dy })),
    ...ctx.elements
      .filter((e) => selected.has(decorItemKey(e.id)))
      .map((e) => ({ key: decorItemKey(e.id), x: e.x + dx, y: e.y + dy })),
  ];
  return applyMoves(ctx, placements, { snap: false });
}

export type BulkAddOptions = {
  count: number;
  capacity: number;
  isLoca: boolean;
  floor: number;
  tableTypeId: string | null;
  /** Yerleşimin başlayacağı nokta (sağ tıklanan hücre); yoksa B1. */
  start?: Point;
};

/** Toplu ekleme: yeni masaları (tablolar 1..N devamı, localar "L1.." devamı) engellerin etrafına dizer. */
export function bulkAddTables(ctx: ToolCtx, opts: BulkAddOptions, newKey: () => string): EditorTable[] {
  const count = Math.max(0, Math.min(BULK_ADD_MAX, Math.floor(opts.count)));
  if (count === 0) return [];
  const footprint = tableFootprint({ size: null, capacity: opts.capacity, isLoca: opts.isLoca }, ctx.shapeOf(opts));
  const obstacles = layoutItems(ctx.tables, ctx.elements, ctx.shapeOf)
    .filter((i) => i.obstacle && occupiesFloor(i, opts.floor))
    .map((i) => i.box);
  const points = placeInRows({ count, footprint, obstacles, canvas: ctx.canvas, start: opts.start });
  const all = ctx.tables.map((t) => t.label);
  const taken = new Set(all.map((l) => l.toLocaleLowerCase("tr")));
  const tableLabels = ctx.tables.filter((t) => !t.isLoca).map((t) => t.label);
  const locaLabels = ctx.tables.filter((t) => t.isLoca).map((t) => t.label);
  return points.map((p) => {
    let label: string;
    if (opts.isLoca) {
      label = nextPrefixedLabel(locaLabels, "L", all);
      locaLabels.push(label);
    } else {
      label = nextLabel(tableLabels);
      while (taken.has(label.toLocaleLowerCase("tr"))) {
        tableLabels.push(label);
        label = nextLabel(tableLabels);
      }
      tableLabels.push(label);
    }
    all.push(label);
    taken.add(label.toLocaleLowerCase("tr"));
    return {
      key: newKey(),
      id: null,
      label,
      capacity: opts.capacity,
      tableTypeId: opts.tableTypeId,
      x: p.x,
      y: p.y,
      rotation: 0,
      isLoca: opts.isLoca,
      isVip: false,
      isPinned: false,
      size: null,
      floor: opts.floor,
      sortNumber: labelNumber(label),
      locked: false,
    };
  });
}

export type ArrangeOutcome = { tables: EditorTable[]; moved: number; unplaced: string[] };

/** Seçili masalar (yoksa tümü), sabitlenmişler hariç; seçimde masa yoksa boş. */
function arrangeTargets(ctx: ToolCtx, requireSelection: boolean): { targets: EditorTable[]; scoped: boolean } {
  const selected = new Set(ctx.selection);
  const chosen = ctx.tables.filter((t) => selected.has(t.key));
  const scoped = chosen.length > 0 && chosen.length < ctx.tables.length;
  const pool = chosen.length > 0 || requireSelection ? chosen : ctx.tables;
  return { targets: pool.filter((t) => !t.isPinned && !ctx.frozenKeys.has(t.key)).sort(compareTables), scoped };
}

type FloorRun = { fixed: ReturnType<typeof fixedBoxes>; floorTargets: readonly EditorTable[]; lowest: boolean };

/** Hedefleri kat kat düzenler: her kat yalnızca kendi katındaki engelleri görür, sonuçlar birleştirilir. */
function run(ctx: ToolCtx, targets: readonly EditorTable[], fn: (items: ArrangeItem[], floor: FloorRun) => ArrangeResult): ArrangeOutcome {
  const keys = new Set(targets.map((t) => t.key));
  const floors = [...new Set(targets.map((t) => t.floor))].sort((a, b) => a - b);
  const res: ArrangeResult = { positions: new Map(), unplaced: [] };
  for (const floor of floors) {
    const floorTargets = targets.filter((t) => t.floor === floor);
    const items = floorTargets.map((t) => {
      const b = tableBox(t, ctx.shapeOf);
      return { key: t.key, x: t.x, y: t.y, width: b.width, height: b.height };
    });
    const part = fn(items, { fixed: fixedBoxes(ctx, keys, floor), floorTargets, lowest: floor === floors[0] });
    for (const [k, p] of part.positions) res.positions.set(k, p);
    res.unplaced.push(...part.unplaced);
  }
  const tables = ctx.tables.map((t) => {
    const p = res.positions.get(t.key);
    return p && (p.x !== t.x || p.y !== t.y) ? { ...t, x: p.x, y: p.y } : t;
  });
  const moved = tables.filter((t, i) => t !== ctx.tables[i]).length;
  const label = new Map(ctx.tables.map((t) => [t.key, t.label]));
  return { tables, moved, unplaced: res.unplaced.map((k) => label.get(k) ?? k) };
}

function fixedBoxes(ctx: ToolCtx, moving: ReadonlySet<string>, floor: number) {
  return layoutItems(ctx.tables, ctx.elements, ctx.shapeOf)
    .filter((i) => i.obstacle && occupiesFloor(i, floor) && !moving.has(i.key))
    .map((i) => i.box);
}

export function autoAlignTables(ctx: ToolCtx): ArrangeOutcome & { scoped: boolean } {
  const { targets, scoped } = arrangeTargets(ctx, false);
  // Seçim hizalanırken ve en alt katın üstündeki katlarda dizilim öğelerin bulunduğu bölgeden başlar;
  // böylece üst kat (localar) tuvalin başına, zemin masaların üstüne taşınmaz.
  const out = run(ctx, targets, (items, { fixed, floorTargets, lowest }) => {
    const start = scoped || !lowest ? unionRect(floorTargets.map((t) => tableBox(t, ctx.shapeOf))) : null;
    return autoAlign(items, fixed, ctx.canvas, start ? { start: { x: start.x, y: start.y } } : {});
  });
  return { ...out, scoped };
}

export function snapTablesToCells(ctx: ToolCtx): ArrangeOutcome {
  const { targets } = arrangeTargets(ctx, false);
  return run(ctx, targets, (items, { fixed }) => snapToCellCentres(items, fixed, ctx.canvas));
}

export function spaceTables(ctx: ToolCtx, gap: number): ArrangeOutcome {
  const { targets } = arrangeTargets(ctx, true);
  if (targets.length < 2) return { tables: [...ctx.tables], moved: 0, unplaced: [] };
  return run(ctx, targets, (items, { fixed }) => applySpacing(items, gap, fixed, ctx.canvas));
}

/** Seçili (sabitlenmemiş) öğeleri grup olarak yatay ortalar; çakışma doğarsa reddedilir. */
export function centreSelectionHorizontally(ctx: ToolCtx): MoveOutcome {
  const selected = new Set(ctx.selection);
  const items = layoutItems(ctx.tables, ctx.elements, ctx.shapeOf).filter((i) => selected.has(i.key) && !i.pinned && !ctx.frozenKeys.has(i.key));
  const dx = horizontalCentreDelta(
    items.map((i) => i.box),
    ctx.canvas,
  );
  if (items.length === 0) return { ok: false, reason: "nothing" };
  const keys = new Set(items.map((i) => i.key));
  const placements: Placement[] = [
    ...ctx.tables.filter((t) => keys.has(t.key)).map((t) => ({ key: t.key, x: t.x + dx, y: t.y })),
    ...ctx.elements.filter((e) => keys.has(decorItemKey(e.id))).map((e) => ({ key: decorItemKey(e.id), x: e.x + dx, y: e.y })),
  ];
  return applyMoves(ctx, placements, { snap: false });
}
