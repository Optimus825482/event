import {
  Circle,
  Square,
  Star,
  Crown,
  Sofa,
  Mic2,
  Footprints,
  UtensilsCrossed,
  Settings,
  Users,
  Box,
} from "lucide-react";
import type { ElementType } from "./types";

// ==================== GRID SETTINGS ====================
export const GRID_COLS = 26;
export const GRID_ROWS = 20;
export const CELL_SIZE = 40;
export const CANVAS_WIDTH = GRID_COLS * CELL_SIZE;
export const CANVAS_HEIGHT = GRID_ROWS * CELL_SIZE;
export const HEADER_SIZE = 24;
export const DEFAULT_TABLE_SIZE = 40;
export const MAX_TABLE_COUNT = 100; // Maksimum masa sayısı

export const COLUMN_LETTERS = Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i)
);

// ==================== TABLE TYPE CONFIG ====================
export const TABLE_TYPE_CONFIG = {
  unassigned: {
    label: "Atanmamış",
    icon: Circle,
    color: "#6b7280",
    borderColor: "#9ca3af",
  },
  standard: {
    label: "Standart",
    icon: Square,
    color: "#3b82f6",
    borderColor: "#60a5fa",
  },
  premium: {
    label: "Premium",
    icon: Star,
    color: "#8b5cf6",
    borderColor: "#a78bfa",
  },
  vip: { label: "VIP", icon: Crown, color: "#f59e0b", borderColor: "#fbbf24" },
  loca: { label: "Loca", icon: Sofa, color: "#ec4899", borderColor: "#f472b6" },
} as const;

// ==================== AREA COLORS ====================
export const AREA_COLORS = [
  { id: "red", label: "Kırmızı", color: "#ef4444", borderColor: "#f87171" },
  { id: "orange", label: "Turuncu", color: "#f97316", borderColor: "#fb923c" },
  { id: "amber", label: "Sarı", color: "#f59e0b", borderColor: "#fbbf24" },
  { id: "green", label: "Yeşil", color: "#22c55e", borderColor: "#4ade80" },
  { id: "teal", label: "Turkuaz", color: "#14b8a6", borderColor: "#2dd4bf" },
  { id: "blue", label: "Mavi", color: "#3b82f6", borderColor: "#60a5fa" },
  { id: "purple", label: "Mor", color: "#8b5cf6", borderColor: "#a78bfa" },
  { id: "pink", label: "Pembe", color: "#ec4899", borderColor: "#f472b6" },
  { id: "slate", label: "Gri", color: "#64748b", borderColor: "#94a3b8" },
];

// ==================== AREA ICONS ====================
export const AREA_ICONS = [
  { id: "none", label: "Yok", icon: null },
  { id: "mic", label: "Mikrofon", icon: Mic2 },
  { id: "footprints", label: "Catwalk", icon: Footprints },
  { id: "utensils", label: "Yemek", icon: UtensilsCrossed },
  { id: "settings", label: "Kontrol", icon: Settings },
  { id: "users", label: "Kişiler", icon: Users },
  { id: "box", label: "Kutu", icon: Box },
  { id: "star", label: "Yıldız", icon: Star },
];

// ==================== FONT OPTIONS ====================
export const FONT_OPTIONS = [
  { id: "sans", label: "Sans", className: "font-sans" },
  {
    id: "roboto",
    label: "Roboto",
    className: "font-[family-name:var(--font-roboto)]",
  },
  {
    id: "playfair",
    label: "Playfair",
    className: "font-[family-name:var(--font-playfair)]",
  },
  {
    id: "oswald",
    label: "Oswald",
    className: "font-[family-name:var(--font-oswald)]",
  },
];

// ==================== SIZE OPTIONS ====================
export const SIZE_OPTIONS = [
  { id: "sm", label: "S", textClass: "text-[10px]", iconClass: "w-3 h-3" },
  { id: "md", label: "M", textClass: "text-xs", iconClass: "w-4 h-4" },
  { id: "lg", label: "L", textClass: "text-sm", iconClass: "w-5 h-5" },
  { id: "xl", label: "XL", textClass: "text-base", iconClass: "w-6 h-6" },
];

// ==================== BORDER WIDTH OPTIONS ====================
export const BORDER_WIDTH_OPTIONS = [
  { id: 1, label: "1" },
  { id: 2, label: "2" },
  { id: 3, label: "3" },
  { id: 4, label: "4" },
  { id: 5, label: "5" },
  { id: 6, label: "6" },
];

// ==================== BORDER COLORS ====================
export const BORDER_COLORS = [
  { id: "white", label: "Beyaz", color: "#ffffff" },
  { id: "black", label: "Siyah", color: "#000000" },
  { id: "red", label: "Kırmızı", color: "#f87171" },
  { id: "orange", label: "Turuncu", color: "#fb923c" },
  { id: "amber", label: "Sarı", color: "#fbbf24" },
  { id: "green", label: "Yeşil", color: "#4ade80" },
  { id: "teal", label: "Turkuaz", color: "#2dd4bf" },
  { id: "blue", label: "Mavi", color: "#60a5fa" },
  { id: "purple", label: "Mor", color: "#a78bfa" },
  { id: "pink", label: "Pembe", color: "#f472b6" },
  { id: "slate", label: "Gri", color: "#94a3b8" },
];

// ==================== TEXT DIRECTION OPTIONS ====================
export const TEXT_DIRECTION_OPTIONS = [
  { id: "horizontal" as const, label: "Yatay", icon: "↔" },
  { id: "vertical-down" as const, label: "Dikey ↓", icon: "↓" },
  { id: "vertical-up" as const, label: "Dikey ↑", icon: "↑" },
];

// ==================== CONTEXT MENU ITEMS ====================
export const CONTEXT_MENU_ITEMS = [
  {
    type: "stage" as ElementType,
    label: "Sahne Ekle",
    icon: Mic2,
    color: "#ef4444",
  },
  {
    type: "area" as ElementType,
    label: "Alan Ekle",
    icon: Box,
    color: "#3b82f6",
  },
  {
    type: "table" as ElementType,
    label: "Masa Ekle",
    icon: Circle,
    color: "#3b82f6",
  },
  {
    type: "loca" as ElementType,
    label: "Loca Ekle",
    icon: Sofa,
    color: "#ec4899",
  },
];

// ==================== GRID UTILITIES ====================
export const gridToPixel = (col: string, row: number) => {
  const colIndex = col.charCodeAt(0) - 65;
  return {
    x: colIndex * CELL_SIZE,
    y: (row - 1) * CELL_SIZE,
  };
};

export const pixelToGrid = (x: number, y: number) => {
  const colIndex = Math.floor(x / CELL_SIZE);
  const rowIndex = Math.floor(y / CELL_SIZE);
  return {
    col: COLUMN_LETTERS[Math.min(Math.max(colIndex, 0), 25)],
    row: Math.min(Math.max(rowIndex + 1, 1), 20),
  };
};

export const getGridCellCenter = (col: string, row: number) => {
  const { x, y } = gridToPixel(col, row);
  return {
    x: x + CELL_SIZE / 2 - 16,
    y: y + CELL_SIZE / 2 - 16,
  };
};

// ==================== DEFAULT VALUES ====================
export const DEFAULT_AREA_EDIT = {
  isOpen: false,
  stageId: null,
  label: "",
  displayText: "",
  color: "#3b82f6",
  borderColor: "#60a5fa",
  borderWidth: 2,
  iconId: "none",
  fontSize: "md",
  fontFamily: "sans",
  textDirection: "horizontal" as const,
};

// ==================== DEFAULT WIZARD STATE ====================
export const DEFAULT_ADD_WIZARD = {
  isOpen: false,
  elementType: null as "table" | "loca" | null,
  step: 1 as 1 | 2 | 3 | 4,
  count: 1,
  tableType: "standard" as const,
  capacity: 10,
  floor: 1, // Kat numarası (localar için)
  startPosition: { x: 0, y: 0, col: "A", row: 1 },
};

// ==================== CAPACITY OPTIONS ====================
export const CAPACITY_OPTIONS = [4, 6, 8, 10, 12, 14, 16, 20];
