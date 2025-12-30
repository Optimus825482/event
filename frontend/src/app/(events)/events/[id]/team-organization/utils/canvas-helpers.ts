/**
 * Canvas Helper Functions
 * Masa gruplandırma ve canvas işlemleri için yardımcı fonksiyonlar
 */

import { TableData, TableGroup, DEFAULT_COLORS } from "../types";

// Canvas sabitleri
export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 680;
export const TABLE_SIZE = 32;
export const LOCA_WIDTH = 56;
export const LOCA_HEIGHT = 32;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Lasso seçim alanındaki masaları bulur
 */
export function calculateLassoSelection(
  start: Point,
  end: Point,
  tables: TableData[]
): string[] {
  const rect = getLassoRect(start, end);

  return tables
    .filter((table) => {
      const centerX = table.x + TABLE_SIZE / 2;
      const centerY = table.y + TABLE_SIZE / 2;
      return (
        centerX >= rect.minX &&
        centerX <= rect.maxX &&
        centerY >= rect.minY &&
        centerY <= rect.maxY
      );
    })
    .map((t) => t.id);
}

/**
 * Lasso dikdörtgenini hesaplar
 */
export function getLassoRect(start: Point, end: Point): Rect {
  return {
    minX: Math.min(start.x, end.x),
    maxX: Math.max(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxY: Math.max(start.y, end.y),
  };
}

/**
 * Seçili masalardan otomatik grup ismi oluşturur
 * Grup-1, Grup-2, Grup-3 formatında isim verir
 */
export function generateAutoGroupName(
  tableIds: string[],
  tables: TableData[],
  existingGroups?: TableGroup[]
): string {
  // Mevcut grup sayısına göre sıradaki numarayı bul
  const existingCount = existingGroups?.length || 0;
  return `Grup-${existingCount + 1}`;
}

/**
 * Sonraki grup rengini döndürür
 */
export function getNextGroupColor(existingGroups: TableGroup[]): string {
  const usedColors = new Set(existingGroups.map((g) => g.color));
  const availableColor = DEFAULT_COLORS.find((c) => !usedColors.has(c));
  return (
    availableColor ||
    DEFAULT_COLORS[existingGroups.length % DEFAULT_COLORS.length]
  );
}

/**
 * Masa ID'sinden numara çıkarır
 */
export function extractTableNumber(tableId: string): number | null {
  const matches = tableId.match(/(\d+)$/);
  if (!matches) return null;
  const num = parseInt(matches[1], 10);
  return isNaN(num) ? null : num;
}

/**
 * Masa numaralarını formatlar (1-5, 8, 10-12 gibi)
 */
export function formatTableNumbers(
  tableIds: string[],
  tables: TableData[]
): string {
  const numbers = tableIds
    .map((id) => {
      const table = tables.find((t) => t.id === id);
      if (!table) return null;
      const num = parseInt(table.label, 10);
      return isNaN(num) ? null : num;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  if (numbers.length === 0) return "-";

  // Ardışık grupları bul
  const ranges: string[] = [];
  let rangeStart = numbers[0];
  let rangeEnd = numbers[0];

  for (let i = 1; i <= numbers.length; i++) {
    if (i < numbers.length && numbers[i] === rangeEnd + 1) {
      rangeEnd = numbers[i];
    } else {
      if (rangeStart === rangeEnd) {
        ranges.push(`${rangeStart}`);
      } else {
        ranges.push(`${rangeStart}-${rangeEnd}`);
      }
      if (i < numbers.length) {
        rangeStart = numbers[i];
        rangeEnd = numbers[i];
      }
    }
  }

  return ranges.join(", ");
}

/**
 * Canvas koordinatlarını hesaplar (mouse event'ten)
 */
export function getCanvasCoordinates(
  e: React.MouseEvent,
  canvasRect: DOMRect,
  offset: Point,
  zoom: number
): Point {
  return {
    x: (e.clientX - canvasRect.left - offset.x) / zoom,
    y: (e.clientY - canvasRect.top - offset.y) / zoom,
  };
}

/**
 * Zoom sınırlarını kontrol eder
 */
export function clampZoom(zoom: number, min = 0.5, max = 2): number {
  return Math.min(Math.max(zoom, min), max);
}

/**
 * İki nokta arasındaki mesafeyi hesaplar
 */
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}
