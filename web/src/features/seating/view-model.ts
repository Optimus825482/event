// "Masalar ve Satış" ekranının saf görünüm modeli (veritabanı ve React yok).
import {
  SALE_CATEGORIES,
  TABLE_ALLOCATIONS,
  type SaleCategory,
  type TableAllocation,
} from "@/domain/seating";
import type { SeatingTable } from "./queries";
import type { SaleSettings } from "./settings-service";

/** Plan dolguları (`#RRGGBB`); plan koyu zemindedir. Etiket metni her zaman renk açıklamasıyla birlikte gösterilir. */
export const ALLOCATION_COLORS: Record<TableAllocation, string> = {
  pending: "#94a3b8",
  casino: "#a78bfa",
  online: "#34d399",
  closed: "#f87171",
};

export const CATEGORY_COLORS: Record<SaleCategory, string> = {
  standard: "#60a5fa",
  premium: "#fbbf24",
  vip: "#f472b6",
};

type Count = { tables: number; seats: number };

export type SeatingTotals = {
  byAllocation: Record<TableAllocation, Count>;
  byCategory: Record<SaleCategory, Count>;
};

function zeroed<K extends string>(keys: readonly K[]): Record<K, Count> {
  return Object.fromEntries(keys.map((k) => [k, { tables: 0, seats: 0 }])) as Record<K, Count>;
}

/** Tahsise ve kategoriye göre masa ile satılabilir sandalye toplamı; kategori yalnızca `online` ve `pending` masaları sayar. */
export function seatingTotals(tables: readonly SeatingTable[]): SeatingTotals {
  const byAllocation = zeroed(TABLE_ALLOCATIONS);
  const byCategory = zeroed(SALE_CATEGORIES);
  for (const table of tables) {
    byAllocation[table.allocation].tables += 1;
    byAllocation[table.allocation].seats += table.effectiveSellable;
    if (table.allocation === "online" || table.allocation === "pending") {
      byCategory[table.category].tables += 1;
      byCategory[table.category].seats += table.effectiveSellable;
    }
  }
  return { byAllocation, byCategory };
}

export type SaleMove = "online" | "pending" | "closed";

/** Önden bilgi amaçlı engel nedeni; karar sunucunundur. Engel yoksa `null`. */
export function saleMoveBlocker(
  table: Pick<SeatingTable, "allocation" | "isLoca">,
  move: SaleMove,
  settings: Pick<SaleSettings, "locaOnline">,
): string | null {
  if (table.allocation === "casino") return "Casino'ya ayrılmış";
  if (table.isLoca && move === "online" && !settings.locaOnline) return "Localar online satışa kapalı";
  if (table.allocation === move) return "Zaten bu durumda";
  return null;
}

/** Masa kimliği -> plan dolgusu, seçilen kipe göre. */
export function planColors(tables: readonly SeatingTable[], mode: "allocation" | "category"): Record<string, string> {
  return Object.fromEntries(
    tables.map((t) => [t.id, mode === "allocation" ? ALLOCATION_COLORS[t.allocation] : CATEGORY_COLORS[t.category]]),
  );
}

/** Yalnızca rakamlardan oluşan metni sayıya çevirir; boş ya da geçersizse `undefined` (sunucu şeması sayı bekler). */
export function parseWholeNumber(text: string): number | undefined {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
}

/** Satılabilir sandalye alanı: boş = kapasitenin tamamı (`null`); aksi halde 1..`max` arası tam sayı. */
export function parseSellableInput(
  text: string,
  max: number,
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (text.trim() === "") return { ok: true, value: null };
  const value = parseWholeNumber(text);
  if (value === undefined || value < 1 || value > max) {
    return { ok: false, message: `1 ile ${max} arasında bir sayı girin` };
  }
  return { ok: true, value };
}
