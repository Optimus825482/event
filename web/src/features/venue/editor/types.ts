import type { Decor, DecorElement, DecorKind, DecorLine, TableInput, TableShape } from "../schemas";
import type { ActiveFloor } from "./floors";
import type { Point } from "./geometry";
import type { History } from "./history";
import type { LineActions } from "./line-actions";
import type { BulkAddOptions } from "./tool-actions";

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
  isVip: boolean;
  /** Düzenleyicide sabitlenmiş (taşınmaz); `locked` (kullanımda) kavramından bağımsız. */
  isPinned: boolean;
  /** Çizim boyutu (px); null = kapasiteden türetilir. */
  size: number | null;
  /** Kat, 1..9. */
  floor: number;
  /** Sayısal sıralama anahtarı; null = yok. */
  sortNumber: number | null;
  /** Rezervasyonu/ataması var: silinemez (sunucu da reddeder). */
  locked: boolean;
};

export type Snapshot = { tables: EditorTable[]; elements: DecorElement[]; lines: DecorLine[] };
/** `line`: tıkla-tıkla düz çizgi çizme aracı. */
export type Tool = "select" | "pan" | "line";

export type InitialLayout = {
  tables: Array<Omit<EditorTable, "key" | "locked"> & { id: string }>;
  decor: Decor;
  lockedTableIds: readonly string[];
  /** Satış kilidi altında konumu/etiketi değiştirilemeyen masa kimlikleri (editörde fiilen sabitlenmiş sayılır). */
  frozenTableIds?: readonly string[];
};

export type Placement = { key: string; x: number; y: number; rotation?: number; width?: number; height?: number };

export type EditorState = Snapshot & {
  canvas: { width: number; height: number };
  selection: string[];
  history: History<Snapshot>;
  dirty: boolean;
  snapEnabled: boolean;
  /** Izgara çizgileri görünür mü (yalnızca görünüm; kayıtlı veriyi etkilemez). */
  showGrid: boolean;
  gridSize: number;
  tool: Tool;
  /** Üzerinde çalışılan kat (yalnızca görünüm); diğer katlar soluk çizilir ve seçilemez. */
  activeFloor: ActiveFloor;
  /** Masa tipi kimliği → biçim (çakışma ve yerleşim hesapları için). */
  tableShapes: Readonly<Record<string, TableShape>>;
  /** Donmuş (satılmış/rezerve) masa kimlikleri; taşıma, döndürme, hizalama ve silme bunları atlar. */
  frozenIds: ReadonlySet<string>;
};

/** Taşıma sonucu: `ok: false` ise hiçbir şey değişmedi (çakışma ya da taşınacak öğe yok). */
export type MoveResult = { ok: true; moved: number } | { ok: false; reason: "collision" | "nothing"; keys?: string[] };
export type ArrangeReport = { moved: number; unplaced: string[] };
export type BulkAddReport = { added: number; requested: number; keys: string[] };
/** Taslaktan geri yüklenen düzenleyici içeriği. */
export type DraftContent = {
  tables: EditorTable[];
  elements: DecorElement[];
  /** Eski taslaklarda yoktur. */
  lines?: DecorLine[];
  canvas: { width: number; height: number };
};

export type EditorActions = LineActions & {
  load: (layout: InitialLayout) => void;
  addTable: (opts?: { at?: Point; capacity?: number; tableTypeId?: string | null; isLoca?: boolean }) => string;
  addDecor: (kind: DecorKind, at?: Point) => string;
  updateTables: (keys: readonly string[], patch: Partial<Pick<EditorTable, "label" | "capacity" | "tableTypeId" | "isLoca" | "rotation" | "isVip" | "isPinned" | "size" | "floor" | "sortNumber">>) => void;
  updateDecor: (key: string, patch: Partial<Omit<DecorElement, "id" | "kind">>) => void;
  commitPlacements: (placements: readonly Placement[]) => MoveResult;
  nudge: (dx: number, dy: number) => MoveResult;
  addTablesBatch: (opts: BulkAddOptions) => BulkAddReport;
  autoAlign: (frozen?: ReadonlySet<string>) => ArrangeReport & { scoped: boolean };
  snapToCells: (frozen?: ReadonlySet<string>) => ArrangeReport;
  setSpacing: (gap: number, frozen?: ReadonlySet<string>) => ArrangeReport;
  centerHorizontally: (keys?: readonly string[], frozen?: ReadonlySet<string>) => MoveResult;
  setPinned: (keys: readonly string[], pinned: boolean) => void;
  setVip: (keys: readonly string[], vip: boolean) => void;
  setTableShapes: (shapes: Readonly<Record<string, TableShape>>) => void;
  restoreDraft: (draft: DraftContent) => void;
  /** `frozen` verilirse durumdaki donmuş kümenin yerine geçer. `blocked`: rezervasyonlu/atamalı, `frozen`: donmuş masa etiketleri. */
  deleteSelection: (frozen?: ReadonlySet<string>) => { blocked: string[]; frozen: string[] };
  duplicateSelection: () => void;
  select: (keys: readonly string[], mode?: "replace" | "toggle" | "add") => void;
  selectAll: () => void;
  clearSelection: () => void;
  undo: () => void;
  redo: () => void;
  setSnap: (enabled: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setTool: (tool: Tool) => void;
  /** Etkin katı değiştirir; başka kattaki öğeler seçimden düşer. */
  setActiveFloor: (floor: ActiveFloor) => void;
  setCanvasSize: (size: { width: number; height: number }) => void;
  toSaveInput: () => { tables: TableInput[]; decor: Decor };
};
