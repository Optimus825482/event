import { createStore } from "zustand/vanilla";
import type { DecorElement, DecorKind } from "../schemas";
import { decorItemKey, type ShapeOf } from "./collision";
import { findFreeSpot, normalizeAngle, nextLabel, snap, snapPoint, type Point } from "./geometry";
import { DEFAULT_VIEW_SETTINGS, type ViewSettings } from "./view-chrome";
import { emptyHistory, record, redo, undo } from "./history";
import { createLineActions } from "./line-actions";
import { copyLines, lineKey, linesForSave } from "./lines";
import {
  applyMoves,
  autoAlignTables,
  bulkAddTables,
  centreSelectionHorizontally,
  nudgeMoves,
  snapTablesToCells,
  spaceTables,
  type MoveOutcome,
  type ToolCtx,
} from "./tool-actions";
import type { ArrangeReport, EditorActions, EditorState, EditorTable, InitialLayout, MoveResult, Snapshot } from "./types";

export type {
  ArrangeReport,
  BulkAddReport,
  DraftContent,
  EditorActions,
  EditorState,
  EditorTable,
  InitialLayout,
  MoveResult,
  Placement,
  Snapshot,
  Tool,
} from "./types";

export type EditorStore = ReturnType<typeof createEditorStore>;

export const DECOR_KEY_PREFIX = "d:";
export const decorKey = decorItemKey;
/** Araç çubuğundan eklenen masalar arasındaki en küçük aralık (ızgara hücresi cinsinden). */
const NEW_TABLE_SPACING_CELLS = 4;

/** Düzenleyicide ne masa ne dekor varsa (sunucu verisinden bağımsız, anlık durum) true. */
export function isLayoutEmpty(state: Pick<EditorState, "tables" | "elements"> & { lines?: readonly unknown[] }): boolean {
  return state.tables.length === 0 && state.elements.length === 0 && (state.lines?.length ?? 0) === 0;
}

export const isDecorKey = (key: string) => key.startsWith(DECOR_KEY_PREFIX);

/** Masa tipi biçimini (yuvarlak/dikdörtgen/kare) durumdaki tip eşlemesinden çözer; bilinmeyen tip yuvarlaktır. */
export function shapeResolver(state: Pick<EditorState, "tableShapes">): ShapeOf {
  return (t) => (t.tableTypeId ? state.tableShapes[t.tableTypeId] : undefined) ?? "round";
}

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

const DECOR_DEFAULTS: Record<DecorKind, { width: number; height: number; label: string; color: string }> = {
  stage: { width: 320, height: 100, label: "Sahne", color: "#7c3aed" },
  area: { width: 200, height: 140, label: "Alan", color: "#0ea5e9" },
  wall: { width: 300, height: 12, label: "", color: "#64748b" },
  label: { width: 140, height: 36, label: "Metin", color: "#f59e0b" },
};

function snapshot(state: Snapshot): Snapshot {
  return { tables: state.tables, elements: state.elements, lines: state.lines };
}

function toEditorTables(layout: InitialLayout): EditorTable[] {
  const locked = new Set(layout.lockedTableIds);
  return layout.tables.map((t) => ({
    key: `t:${t.id}`,
    id: t.id,
    label: t.label,
    capacity: t.capacity,
    tableTypeId: t.tableTypeId,
    x: t.x,
    y: t.y,
    rotation: t.rotation,
    isLoca: t.isLoca,
    isVip: t.isVip,
    isPinned: t.isPinned,
    size: t.size,
    floor: t.floor,
    sortNumber: t.sortNumber,
    locked: locked.has(t.id),
  }));
}

export function createEditorStore(initial: InitialLayout, view: ViewSettings = DEFAULT_VIEW_SETTINGS) {
  return createStore<EditorState & EditorActions>()((set, get) => {
    /** Durumu değiştiren her işlem önce mevcut durumu geçmişe yazar. */
    const change = (next: Partial<Snapshot> & Partial<Pick<EditorState, "selection">>) => {
      const s = get();
      set({ ...next, history: record(s.history, snapshot(s)), dirty: true });
    };
    const ctx = (): ToolCtx => {
      const s = get();
      return { ...s, shapeOf: shapeResolver(s) };
    };
    const commitMove = (outcome: MoveOutcome): MoveResult => {
      if (!outcome.ok) return outcome.reason === "collision" ? { ok: false, reason: "collision", keys: outcome.keys } : { ok: false, reason: "nothing" };
      change({ tables: outcome.tables, elements: outcome.elements });
      return { ok: true, moved: outcome.moved };
    };
    const arranged = (out: { tables: EditorTable[]; moved: number; unplaced: string[] }): ArrangeReport => {
      if (out.moved > 0) change({ tables: out.tables });
      return { moved: out.moved, unplaced: out.unplaced };
    };
    const center = (): Point => {
      const { canvas, gridSize } = get();
      return { x: snap(canvas.width / 2, gridSize), y: snap(canvas.height / 2, gridSize) };
    };

    return {
      tables: toEditorTables(initial),
      elements: initial.decor.elements,
      lines: initial.decor.lines ?? [],
      canvas: { width: initial.decor.width, height: initial.decor.height },
      selection: [],
      history: emptyHistory(),
      dirty: false,
      snapEnabled: view.snap,
      showGrid: view.showGrid,
      gridSize: view.gridSize,
      tool: "select",
      tableShapes: {},
      ...createLineActions(get, change, () => uid("l-")),

      load: (layout) =>
        set({
          tables: toEditorTables(layout),
          elements: layout.decor.elements,
          lines: layout.decor.lines ?? [],
          canvas: { width: layout.decor.width, height: layout.decor.height },
          selection: [],
          history: emptyHistory(),
          dirty: false,
        }),

      addTable: (opts = {}) => {
        const s = get();
        // Konum verilmediyse (araç çubuğu) mevcut masaların üstüne binmeyen ilk boş nokta seçilir.
        const at = opts.at
          ? snapPoint(opts.at, s.gridSize, s.snapEnabled)
          : findFreeSpot(center(), s.tables, s.gridSize * NEW_TABLE_SPACING_CELLS, s.canvas);
        const key = uid("t:new-");
        const table: EditorTable = {
          key,
          id: null,
          label: nextLabel(s.tables.map((t) => t.label)),
          capacity: opts.capacity ?? 8,
          tableTypeId: opts.tableTypeId ?? null,
          x: at.x,
          y: at.y,
          rotation: 0,
          isLoca: opts.isLoca ?? false,
          isVip: false,
          isPinned: false,
          size: null,
          floor: 1,
          sortNumber: null,
          locked: false,
        };
        change({ tables: [...s.tables, table], selection: [key] });
        return key;
      },

      addDecor: (kind, at) => {
        const s = get();
        const d = DECOR_DEFAULTS[kind];
        const p = snapPoint(at ?? center(), s.gridSize, s.snapEnabled);
        const id = uid("d-");
        const element: DecorElement = {
          id,
          kind,
          x: p.x - d.width / 2,
          y: p.y - d.height / 2,
          width: d.width,
          height: d.height,
          rotation: 0,
          label: d.label,
          color: d.color,
        };
        change({ elements: [...s.elements, element], selection: [decorKey(id)] });
        return decorKey(id);
      },

      updateTables: (keys, patch) => {
        const wanted = new Set(keys);
        const s = get();
        if (!s.tables.some((t) => wanted.has(t.key))) return;
        const clean = { ...patch, ...(patch.rotation !== undefined ? { rotation: normalizeAngle(patch.rotation) } : {}) };
        change({ tables: s.tables.map((t) => (wanted.has(t.key) ? { ...t, ...clean } : t)) });
      },

      updateDecor: (key, patch) => {
        const s = get();
        if (!s.elements.some((e) => decorKey(e.id) === key)) return;
        change({ elements: s.elements.map((e) => (decorKey(e.id) === key ? { ...e, ...patch } : e)) });
      },

      commitPlacements: (placements) => commitMove(applyMoves(ctx(), placements, { snap: true })),

      nudge: (dx, dy) => commitMove(nudgeMoves(ctx(), dx, dy)),

      addTablesBatch: (opts) => {
        const s = get();
        const added = bulkAddTables(ctx(), opts, () => uid("t:new-"));
        const keys = added.map((t) => t.key);
        if (added.length > 0) change({ tables: [...s.tables, ...added], selection: keys });
        return { added: added.length, requested: opts.count, keys };
      },

      autoAlign: () => {
        const out = autoAlignTables(ctx());
        return { ...arranged(out), scoped: out.scoped };
      },
      snapToCells: () => arranged(snapTablesToCells(ctx())),
      setSpacing: (gap) => arranged(spaceTables(ctx(), gap)),
      centerHorizontally: (keys) => commitMove(centreSelectionHorizontally(keys ? { ...ctx(), selection: keys } : ctx())),

      setPinned: (keys, pinned) => {
        const wanted = new Set(keys);
        const s = get();
        const tables = s.tables.map((t) => (wanted.has(t.key) && t.isPinned !== pinned ? { ...t, isPinned: pinned } : t));
        const elements = s.elements.map((e) =>
          wanted.has(decorKey(e.id)) && (e.isPinned === true) !== pinned ? { ...e, isPinned: pinned } : e,
        );
        if (tables.some((t, i) => t !== s.tables[i]) || elements.some((e, i) => e !== s.elements[i])) change({ tables, elements });
      },
      setVip: (keys, vip) => {
        const wanted = new Set(keys);
        const s = get();
        const tables = s.tables.map((t) => (wanted.has(t.key) && t.isVip !== vip ? { ...t, isVip: vip } : t));
        if (tables.some((t, i) => t !== s.tables[i])) change({ tables });
      },
      setTableShapes: (shapes) => set({ tableShapes: shapes }),
      restoreDraft: (draft) => {
        const s = get();
        // Kilit (rezervasyon) bilgisi taslaktan değil, sunucudan gelen güncel durumdan alınır.
        const locked = new Set(s.tables.filter((t) => t.locked && t.id).map((t) => t.id));
        const tables = draft.tables.map((t) => ({ ...t, locked: t.id !== null && locked.has(t.id) }));
        change({ tables, elements: draft.elements, lines: draft.lines ?? [], selection: [] });
        set({ canvas: draft.canvas });
      },

      deleteSelection: () => {
        const s = get();
        const selected = new Set(s.selection);
        const blocked = s.tables.filter((t) => selected.has(t.key) && t.locked).map((t) => t.label);
        const tables = s.tables.filter((t) => !selected.has(t.key) || t.locked);
        const elements = s.elements.filter((e) => !selected.has(decorKey(e.id)));
        const lines = s.lines.filter((l) => !selected.has(lineKey(l.id)));
        if (tables.length !== s.tables.length || elements.length !== s.elements.length || lines.length !== s.lines.length) {
          change({ tables, elements, lines, selection: s.selection.filter((k) => tables.some((t) => t.key === k)) });
        }
        return { blocked };
      },

      duplicateSelection: () => {
        const s = get();
        const selected = new Set(s.selection);
        const labels = s.tables.map((t) => t.label);
        const offset = s.gridSize * 2;
        const copies: EditorTable[] = [];
        for (const t of s.tables) {
          if (!selected.has(t.key)) continue;
          const label = nextLabel(labels);
          labels.push(label);
          copies.push({ ...t, key: uid("t:new-"), id: null, label, x: t.x + offset, y: t.y + offset, locked: false });
        }
        const decorCopies = s.elements
          .filter((e) => selected.has(decorKey(e.id)))
          .map((e) => ({ ...e, id: uid("d-"), x: e.x + offset, y: e.y + offset }));
        const lineCopies = copyLines(s.lines, selected, offset, s.canvas, () => uid("l-"));
        if (copies.length + decorCopies.length + lineCopies.length === 0) return;
        change({
          tables: [...s.tables, ...copies],
          elements: [...s.elements, ...decorCopies],
          lines: [...s.lines, ...lineCopies],
          selection: [...copies.map((t) => t.key), ...decorCopies.map((e) => decorKey(e.id)), ...lineCopies.map((l) => lineKey(l.id))],
        });
      },

      select: (keys, mode = "replace") => {
        const current = get().selection;
        if (mode === "replace") return set({ selection: [...new Set(keys)] });
        if (mode === "add") return set({ selection: [...new Set([...current, ...keys])] });
        const toggled = new Set(current);
        for (const k of keys) {
          if (toggled.has(k)) toggled.delete(k);
          else toggled.add(k);
        }
        set({ selection: [...toggled] });
      },
      selectAll: () => {
        const s = get();
        set({ selection: [...s.tables.map((t) => t.key), ...s.elements.map((e) => decorKey(e.id)), ...s.lines.map((l) => lineKey(l.id))] });
      },
      clearSelection: () => set({ selection: [] }),

      undo: () => {
        const s = get();
        const res = undo(s.history, snapshot(s));
        if (!res) return;
        set({ ...res.state, history: res.history, dirty: true, selection: keepExisting(s.selection, res.state) });
      },
      redo: () => {
        const s = get();
        const res = redo(s.history, snapshot(s));
        if (!res) return;
        set({ ...res.state, history: res.history, dirty: true, selection: keepExisting(s.selection, res.state) });
      },

      setSnap: (enabled) => set({ snapEnabled: enabled }),
      setShowGrid: (show) => set({ showGrid: show }),
      setTool: (tool) => set({ tool }),
      setCanvasSize: (size) => {
        const s = get();
        if (s.canvas.width === size.width && s.canvas.height === size.height) return;
        // Tuval boyutu geri al geçmişine girmez (anlık görüntü yalnızca masalar ve dekor).
        set({ canvas: size, dirty: true });
      },

      toSaveInput: () => {
        const s = get();
        return {
          tables: s.tables.map((t) => ({
            ...(t.id ? { id: t.id } : {}),
            label: t.label.trim(),
            capacity: t.capacity,
            tableTypeId: t.tableTypeId,
            x: Math.round(t.x * 100) / 100,
            y: Math.round(t.y * 100) / 100,
            rotation: t.rotation,
            isLoca: t.isLoca,
            isVip: t.isVip,
            isPinned: t.isPinned,
            size: t.size,
            floor: t.floor,
            sortNumber: t.sortNumber,
          })),
          decor: { width: s.canvas.width, height: s.canvas.height, elements: s.elements, lines: linesForSave(s.lines, s.canvas) },
        };
      },
    };
  });
}

function keepExisting(selection: readonly string[], state: Snapshot): string[] {
  const keys = new Set([...state.tables.map((t) => t.key), ...state.elements.map((e) => decorKey(e.id)), ...state.lines.map((l) => lineKey(l.id))]);
  return selection.filter((k) => keys.has(k));
}
