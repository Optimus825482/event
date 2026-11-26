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

/** Satılabilir sandalye sayısı: `sellableSeats` boşsa masanın kapasitesi. */
export function effectiveSellable(t: { capacity: number; sellableSeats: number | null }): number {
  return t.sellableSeats ?? t.capacity;
}
