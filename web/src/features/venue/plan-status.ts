import { ACTIVE_RESERVATION_STATUSES, type ReservationStatus } from "@/domain/reservation-status";

/** Haritadaki masa durumu: boş ya da aktif bir rezervasyonun durumu. */
export type PlanStatus = "free" | "pending" | "confirmed" | "checked_in";

/** Eski sistemin renkleri: Boş yeşil, Beklemede amber, Onaylı kırmızı, Giriş yapıldı mavi. */
export const PLAN_STATUS_COLORS: Record<PlanStatus, string> = {
  free: "#22c55e",
  pending: "#f59e0b",
  confirmed: "#ef4444",
  checked_in: "#3b82f6",
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  free: "Boş",
  pending: "Beklemede",
  confirmed: "Onaylı",
  checked_in: "Giriş yapıldı",
};

export const PLAN_STATUS_ORDER: readonly PlanStatus[] = ["free", "pending", "confirmed", "checked_in"];

const ACTIVE = new Set<string>(ACTIVE_RESERVATION_STATUSES);

/** Aktif olmayan (iptal/gelmedi) durum masayı boş bırakır. */
export function planStatusOf(status: ReservationStatus | null | undefined): PlanStatus {
  return status && ACTIVE.has(status) ? (status as PlanStatus) : "free";
}

export function statusColor(status: PlanStatus | undefined): string | undefined {
  return status ? PLAN_STATUS_COLORS[status] : undefined;
}

/** Masa kimliği -> durum. Aynı masada birden çok kayıt varsa aktif olan kazanır. */
export function statusByTable(rows: ReadonlyArray<{ tableId: string; status: ReservationStatus }>): Record<string, PlanStatus> {
  const out: Record<string, PlanStatus> = {};
  for (const row of rows) {
    const status = planStatusOf(row.status);
    if (status !== "free" || out[row.tableId] === undefined) out[row.tableId] = status;
  }
  return out;
}

/**
 * Plandan seçilebilir mi: masa müsait olmalı (müsaitlik kuralı rezervasyon servisinindir) ve
 * kişi sayısı belirliyse masaya sığmalı. Yazmada karar yine sunucunundur.
 */
export function isTableSelectable(table: { available: boolean; capacity: number }, guestCount?: number): boolean {
  if (!table.available) return false;
  return guestCount === undefined || !Number.isFinite(guestCount) || guestCount <= table.capacity;
}

/**
 * Masanın dolgu rengi: çağıranın verdiği masa rengi (ör. ekip organizasyonunda grup rengi)
 * önce gelir, sonra durum rengi, en son masa tipinin rengi.
 */
export function planTableFill(
  tableId: string,
  fallback: string,
  statuses?: Readonly<Record<string, PlanStatus>>,
  colorByTable?: Readonly<Record<string, string>>,
): string {
  return colorByTable?.[tableId] ?? statusColor(statuses?.[tableId]) ?? fallback;
}
