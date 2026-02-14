import type { GroupLine, PlacedTable } from "../types";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  AREA_COLORS,
  CELL_SIZE,
} from "../constants";

export interface AutoGroupResult {
  name: string;
  color: string;
  tableIds: string[];
}

/**
 * Çizgilere göre canvas'ı dikdörtgen bölgelere ayırır ve
 * her masayı merkez noktasına göre bir bölgeye atar.
 */
export function autoGroupTables(
  groupLines: GroupLine[],
  placedTables: PlacedTable[],
): AutoGroupResult[] {
  // Yatay ve dikey çizgilerin pozisyonlarını topla (segment bazlı → unique pixel pozisyonları)
  const hPositions = [
    ...new Set(
      groupLines
        .filter((l) => l.orientation === "horizontal")
        .map((l) => l.gridIndex * CELL_SIZE),
    ),
  ].sort((a, b) => a - b);

  const vPositions = [
    ...new Set(
      groupLines
        .filter((l) => l.orientation === "vertical")
        .map((l) => l.gridIndex * CELL_SIZE),
    ),
  ].sort((a, b) => a - b);

  // Canvas sınırlarını ekle
  const yBounds = [0, ...hPositions, CANVAS_HEIGHT];
  const xBounds = [0, ...vPositions, CANVAS_WIDTH];

  // Bölgeleri oluştur
  const regions: Array<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    tableIds: string[];
  }> = [];

  for (let yi = 0; yi < yBounds.length - 1; yi++) {
    for (let xi = 0; xi < xBounds.length - 1; xi++) {
      regions.push({
        minX: xBounds[xi],
        maxX: xBounds[xi + 1],
        minY: yBounds[yi],
        maxY: yBounds[yi + 1],
        tableIds: [],
      });
    }
  }

  // Her masayı merkez noktasına göre bölgeye ata
  for (const table of placedTables) {
    const size = table.size || 40;
    const cx = table.x + size / 2;
    const cy = table.y + size / 2;

    for (const region of regions) {
      if (
        cx >= region.minX &&
        cx < region.maxX &&
        cy >= region.minY &&
        cy < region.maxY
      ) {
        region.tableIds.push(table.id);
        break;
      }
    }
  }

  // Boş olmayan bölgeleri gruplara dönüştür
  const groups: AutoGroupResult[] = [];
  let groupIndex = 0;

  for (const region of regions) {
    if (region.tableIds.length === 0) continue;

    const colorObj = AREA_COLORS[groupIndex % AREA_COLORS.length];
    groups.push({
      name: `Grup ${groupIndex + 1}`,
      color: colorObj.color,
      tableIds: region.tableIds,
    });
    groupIndex++;
  }

  return groups;
}
