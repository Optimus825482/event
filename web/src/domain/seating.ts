// Masa satış sözlükleri (saf): kategori, tahsis ve satılabilir sandalye kuralı.

export const SALE_CATEGORIES = ["standard", "premium", "vip"] as const;
export type SaleCategory = (typeof SALE_CATEGORIES)[number];

export const SALE_CATEGORY_LABELS: Record<SaleCategory, string> = {
  standard: "Standart",
  premium: "Premium",
  vip: "VIP",
};

export const TABLE_ALLOCATIONS = ["pending", "casino", "online", "closed"] as const;
export type TableAllocation = (typeof TABLE_ALLOCATIONS)[number];

export const ALLOCATION_LABELS: Record<TableAllocation, string> = {
  pending: "Beklemede",
  casino: "Casino",
  online: "Online satış",
  closed: "Kapalı",
};

export const SALE_MODES = ["table", "seat"] as const;
export type SaleMode = (typeof SALE_MODES)[number];

export const SALE_MODE_LABELS: Record<SaleMode, string> = {
  table: "Masa bazlı",
  seat: "Sandalye bazlı",
};

/** Masanın yalnızca bütün olarak satılıp satılamayacağı. */
export function wholeOnlyOf(i: { saleMode: SaleMode; sharedTables: boolean; isLoca: boolean }): boolean {
  return i.saleMode === "table" || !i.sharedTables || i.isLoca;
}

/** Bilette sandalye numarasının gösterilip gösterilmeyeceği. */
export function seatNoShown(i: { saleMode: SaleMode; isLoca: boolean }): boolean {
  return i.saleMode === "seat" && !i.isLoca;
}

/** Masa ve (varsa) sandalye numarasını tek biçimde yazar. */
export function seatLabel(tableLabel: string, seatNo: number | null): string {
  return seatNo === null ? `Masa ${tableLabel}` : `Masa ${tableLabel} · Sandalye ${seatNo}`;
}

/** Satılabilir sandalye sayısı: `sellableSeats` boşsa masanın kapasitesi. */
export function effectiveSellable(t: { capacity: number; sellableSeats: number | null }): number {
  return t.sellableSeats ?? t.capacity;
}
