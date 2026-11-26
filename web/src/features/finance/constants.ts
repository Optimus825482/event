// Finans sözlükleri. Saf modül: veritabanı ya da sunucu bağımlılığı yoktur.
// Veritabanı CHECK listeleri (`src/db/schema/finance.ts`) bu değerlerle aynı tutulur.

export const FINANCE_DIRECTIONS = ["expense", "income"] as const;
export type FinanceDirection = (typeof FINANCE_DIRECTIONS)[number];

export const FINANCE_DIRECTION_LABELS: Record<FinanceDirection, string> = {
  expense: "Gider",
  income: "Gelir",
};

export const FINANCE_CATEGORIES = [
  "artist_fee",
  "production",
  "fnb",
  "staff",
  "marketing",
  "sponsorship",
  "other",
] as const;
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

export const FINANCE_CATEGORY_LABELS: Record<FinanceCategory, string> = {
  artist_fee: "Sanatçı ücreti",
  production: "Prodüksiyon",
  fnb: "F&B maliyeti",
  staff: "Personel",
  marketing: "Pazarlama",
  sponsorship: "Sponsorluk",
  other: "Diğer",
};

/** Yöne göre izin verilen kategoriler; bilet geliri elle girilmez, sanatçı ücreti gelir olamaz. */
export const CATEGORIES_BY_DIRECTION: Record<FinanceDirection, readonly FinanceCategory[]> = {
  expense: ["artist_fee", "production", "fnb", "staff", "marketing", "other"],
  income: ["sponsorship", "other"],
};

export const CASINO_COST_MODES = ["free", "transfer"] as const;
export type CasinoCostMode = (typeof CASINO_COST_MODES)[number];

export const CASINO_COST_MODE_LABELS: Record<CasinoCostMode, string> = {
  free: "Bedelsiz",
  transfer: "İç transfer fiyatı",
};
