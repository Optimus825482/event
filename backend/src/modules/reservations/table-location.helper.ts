/**
 * Table Location Helper
 * Tekrarlayan masa lokasyonu hesaplama kodunu merkezileştirir.
 */

export interface TableLocation {
  x: number;
  y: number;
  label: string;
}

/**
 * Event venueLayout üzerinden masa lokasyonunu bul
 * @param venueLayout Event'in venueLayout JSONB'si
 * @param tableId Masa ID
 * @returns Masa lokasyonu veya null
 */
export function findTableLocation(
  venueLayout:
    | {
        tables?: Array<{
          id: string;
          x: number;
          y: number;
          label?: string;
          capacity?: number;
          section?: string;
        }>;
      }
    | null
    | undefined,
  tableId: string,
): TableLocation | null {
  if (!venueLayout?.tables) return null;

  const table = venueLayout.tables.find((t) => t.id === tableId);
  if (!table) return null;

  return {
    x: table.x,
    y: table.y,
    label: table.label || tableId,
  };
}

/**
 * Masa etiketini bul (label yoksa tableId döner)
 */
export function findTableLabel(
  venueLayout:
    | { tables?: Array<{ id: string; label?: string }> }
    | null
    | undefined,
  tableId: string,
): string {
  if (!venueLayout?.tables) return tableId;

  const table = venueLayout.tables.find((t) => t.id === tableId);
  return table?.label || tableId;
}
