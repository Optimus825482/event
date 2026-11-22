import { createStore } from "zustand/vanilla";
import type { Decor, DecorElement, DecorKind, TableInput } from "../schemas";
import { normalizeAngle, nextLabel, snap, snapPoint, GRID_SIZE, type Point } from "./geometry";
import { emptyHistory, record, redo, undo, type History } from "./history";

export type EditorTable = {
  key: string;
  id: string | null;
  label: string;
  capacity: number;
  tableTypeId: string | null;
  x: number;
  y: number;
  rotation: number;
  isLoca: boolean;
  /** Rezervasyonu/ataması var: silinemez (sunucu da reddeder). */
  locked: boolean;
};

export type Snapshot = { tables: EditorTable[]; elements: DecorElement[] };
export type Tool = "select" | "pan";

export type InitialLayout = {
  tables: Array<Omit<EditorTable, "key" | "locked"> & { id: string }>;
  decor: Decor;
  lockedTableIds: readonly string[];
};

export type Placement = { key: string; x: number; y: number; rotation?: number; width?: number; height?: number };

export type EditorState = Snapshot & {
  canvas: { width: number; height: number };
  selection: string[];
  history: History<Snapshot>;
  dirty: boolean;
  snapEnabled: boolean;
  gridSize: number;
  tool: Tool;
};

export type EditorActions = {
  load: (layout: InitialLayout) => void;
  addTable: (opts?: { at?: Point; capacity?: number; tableTypeId?: string | null; isLoca?: boolean }) => string;
  addDecor: (kind: DecorKind, at?: Point) => string;
  updateTables: (keys: readonly string[], patch: Partial<Pick<EditorTable, "label" | "capacity" | "tableTypeId" | "isLoca" | "rotation">>) => void;
  updateDecor: (key: string, patch: Partial<Pick<DecorElement, "label" | "color" | "width" | "height" | "rotation">>) => void;
  commitPlacements: (placements: readonly Placement[]) => void;
  nudge: (dx: number, dy: number) => void;
  deleteSelection: () => { blocked: string[] };
  duplicateSelection: () => void;
  select: (keys: readonly string[], mode?: "replace" | "toggle" | "add") => void;
  selectAll: () => void;
  clearSelection: () => void;
  undo: () => void;
  redo: () => void;
  setSnap: (enabled: boolean) => void;
  setTool: (tool: Tool) => void;
  setCanvasSize: (size: { width: number; height: number }) => void;
  toSaveInput: () => { tables: TableInput[]; decor: Decor };
};

export type EditorStore = ReturnType<typeof createEditorStore>;

export const DECOR_KEY_PREFIX = "d:";
export const decorKey = (id: string) => `${DECOR_KEY_PREFIX}${id}`;
export const isDecorKey = (key: string) => key.startsWith(DECOR_KEY_PREFIX);

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
  return { tables: state.tables, elements: state.elements };
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
    locked: locked.has(t.id),
  }));
}

export function createEditorStore(initial: InitialLayout) {
  return createStore<EditorState & EditorActions>()((set, get) => {
    /** Durumu değiştiren her işlem önce mevcut durumu geçmişe yazar. */
    const change = (next: Partial<Snapshot> & Partial<Pick<EditorState, "selection">>) => {
      const s = get();
      set({ ...next, history: record(s.history, snapshot(s)), dirty: true });
    };
    const center = (): Point => {
      const { canvas, gridSize } = get();
      return { x: snap(canvas.width / 2, gridSize), y: snap(canvas.height / 2, gridSize) };
    };

    return {
      tables: toEditorTables(initial),
      elements: initial.decor.elements,
      canvas: { width: initial.decor.width, height: initial.decor.height },
      selection: [],
      history: emptyHistory(),
      dirty: false,
      snapEnabled: true,
      gridSize: GRID_SIZE,
      tool: "select",

      load: (layout) =>
        set({
          tables: toEditorTables(layout),
          elements: layout.decor.elements,
          canvas: { width: layout.decor.width, height: layout.decor.height },
          selection: [],
          history: emptyHistory(),
          dirty: false,
        }),

      addTable: (opts = {}) => {
        const s = get();
        const at = snapPoint(opts.at ?? center(), s.gridSize, s.snapEnabled);
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

      commitPlacements: (placements) => {
        if (placements.length === 0) return;
        const s = get();
        const byKey = new Map(placements.map((p) => [p.key, p]));
        const place = (p: Placement) => snapPoint({ x: p.x, y: p.y }, s.gridSize, s.snapEnabled);
        const tables = s.tables.map((t) => {
          const p = byKey.get(t.key);
          if (!p) return t;
          return { ...t, ...place(p), rotation: normalizeAngle(p.rotation ?? t.rotation) };
        });
        const elements = s.elements.map((e) => {
          const p = byKey.get(decorKey(e.id));
          if (!p) return e;
          const size = {
            width: Math.max(4, p.width ?? e.width),
            height: Math.max(4, p.height ?? e.height),
          };
          return { ...e, ...place(p), ...size, rotation: normalizeAngle(p.rotation ?? e.rotation) };
        });
        change({ tables, elements });
      },

      nudge: (dx, dy) => {
        const s = get();
        const selected = new Set(s.selection);
        if (selected.size === 0) return;
        change({
          tables: s.tables.map((t) => (selected.has(t.key) ? { ...t, x: t.x + dx, y: t.y + dy } : t)),
          elements: s.elements.map((e) => (selected.has(decorKey(e.id)) ? { ...e, x: e.x + dx, y: e.y + dy } : e)),
        });
      },

      deleteSelection: () => {
        const s = get();
        const selected = new Set(s.selection);
        const blocked = s.tables.filter((t) => selected.has(t.key) && t.locked).map((t) => t.label);
        const tables = s.tables.filter((t) => !selected.has(t.key) || t.locked);
        const elements = s.elements.filter((e) => !selected.has(decorKey(e.id)));
        if (tables.length !== s.tables.length || elements.length !== s.elements.length) {
          change({ tables, elements, selection: s.selection.filter((k) => tables.some((t) => t.key === k)) });
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
        if (copies.length + decorCopies.length === 0) return;
        change({
          tables: [...s.tables, ...copies],
          elements: [...s.elements, ...decorCopies],
          selection: [...copies.map((t) => t.key), ...decorCopies.map((e) => decorKey(e.id))],
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
        set({ selection: [...s.tables.map((t) => t.key), ...s.elements.map((e) => decorKey(e.id))] });
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
          })),
          decor: { width: s.canvas.width, height: s.canvas.height, elements: s.elements },
        };
      },
    };
  });
}

function keepExisting(selection: readonly string[], state: Snapshot): string[] {
  const keys = new Set([...state.tables.map((t) => t.key), ...state.elements.map((e) => decorKey(e.id))]);
  return selection.filter((k) => keys.has(k));
}
