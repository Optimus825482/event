// ==================== VENUE PLANNER TYPES ====================

export type TableType = "standard" | "premium" | "vip" | "loca" | "unassigned";
export type CanvasTool = "select" | "pan" | "lasso";
export type ElementType = "stage" | "area" | "table" | "loca";
export type TextDirection = "horizontal" | "vertical-down" | "vertical-up";

export interface PlacedTable {
  id: string;
  tableNumber: number;
  type: TableType;
  capacity: number;
  x: number;
  y: number;
  isLoca: boolean;
  locaName?: string;
  isLocked: boolean;
  gridCol?: string;
  gridRow?: number;
  size?: number; // Masa boyutu (default: 32)
  floor?: number; // Kat numarası (default: 1, localar için 2. kat vb.)
}

// ==================== LASSO SELECTION ====================
export interface LassoState {
  isActive: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// ==================== TABLE RESIZE MODAL ====================
export interface TableResizeState {
  isOpen: boolean;
  targetIds: string[];
  currentSize: number;
}

export interface StageElement {
  id: string;
  type: "stage" | "area";
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  displayText?: string;
  isLocked: boolean;
  gridCol?: string;
  gridRow?: number;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  iconId?: string;
  fontSize?: string;
  fontFamily?: string;
  textDirection?: TextDirection;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  gridCol: string;
  gridRow: number;
  targetId: string | null;
  targetType: "table" | "stage" | "canvas" | null;
}

export interface AreaEditState {
  isOpen: boolean;
  stageId: string | null;
  label: string;
  displayText: string;
  color: string;
  borderColor: string;
  borderWidth: number;
  iconId: string;
  fontSize: string;
  fontFamily: string;
  textDirection: TextDirection;
}

export interface HistoryState {
  placedTables: PlacedTable[];
  stageElements: StageElement[];
}

export interface VenueEvent {
  id: string;
  name: string;
  eventDate: string;
  eventType?: string;
  venueLayout?: {
    placedTables?: PlacedTable[];
    stageElements?: StageElement[];
    dimensions?: { width: number; height: number };
  };
}

export interface ResizingState {
  id: string;
  edge: "right" | "bottom" | "corner" | "left" | "top";
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startPosX: number;
  startPosY: number;
}

export interface DragState {
  id: string;
  type: "table" | "stage";
  offsetX: number;
  offsetY: number;
  // Çoklu seçim için başlangıç pozisyonları
  initialPositions?: Map<string, { x: number; y: number }>;
  // Taşınacak masaların ID'leri (seçim değişse bile sabit kalır)
  tablesToMove?: string[];
}

// ==================== ADD ELEMENT WIZARD ====================
export interface AddElementWizardState {
  isOpen: boolean;
  elementType: "table" | "loca" | null;
  step: 1 | 2 | 3 | 4; // 1: Adet, 2: Tip (masa), 3: Kapasite, 4: Kat (loca)
  count: number;
  tableType: TableType;
  capacity: number;
  floor: number; // Kat numarası (localar için)
  startPosition: { x: number; y: number; col: string; row: number };
}

// ==================== SPACING ADJUSTMENT ====================
export interface SpacingState {
  isOpen: boolean;
  targetIds: string[];
  currentSpacing: number; // Masalar arası mesafe (px)
}

// ==================== LOCA NAME EDIT ====================
export interface LocaNameEditState {
  isOpen: boolean;
  locaId: string | null;
  locaName: string;
}
