/** Rezervasyon durumlarının etkinlik içindeki sayıları (istatistik sorgusunun ham çıktısı). */
export type StatusCounts = {
  pending: number;
  confirmed: number;
  checkedIn: number;
  cancelled: number;
  noShow: number;
  expectedGuests: number;
  checkedInGuests: number;
};

export type EventStats = StatusCounts & {
  /** Beklenen = bekleyen + onaylı + giriş yaptı. */
  totalExpected: number;
  /** Kalan = bekleyen + onaylı. */
  remaining: number;
  /** Giriş yapanların beklenenlere oranı, yuvarlanmış yüzde (beklenen yoksa 0). */
  checkInPercentage: number;
};

export function toEventStats(counts: StatusCounts): EventStats {
  const totalExpected = counts.pending + counts.confirmed + counts.checkedIn;
  return {
    ...counts,
    totalExpected,
    remaining: counts.pending + counts.confirmed,
    checkInPercentage: totalExpected > 0 ? Math.round((counts.checkedIn / totalExpected) * 100) : 0,
  };
}

/** Kişi sayısı denetimi: 1 ile masa kapasitesi arası. Kapasite aşımı onayla da geçmez (spec §13 madde 4). */
export function guestCountProblem(guestCount: number, capacity: number): string | null {
  if (!Number.isInteger(guestCount) || guestCount < 1) return "Kişi sayısı en az 1 olmalıdır";
  if (guestCount > capacity) return `Kişi sayısı (${guestCount}) masa kapasitesini (${capacity}) aşıyor`;
  return null;
}
