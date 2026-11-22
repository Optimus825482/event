import { RATING_KEYS, type RatingKey } from "./score";

export type Trend = "up" | "down" | "flat";

export const TREND_LABELS: Record<Trend, string> = { up: "Yükseliyor", down: "Düşüyor", flat: "Sabit" };

/** Ortalama, en yakın tam sayıya yuvarlanır; boş dizi için null. */
export function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Eskiden yeniye sıralı puanların eğilimi: yeni yarının ortalaması ile eski yarınınki
 * karşılaştırılır (±3 puan "sabit"). İki puandan azsa eğilim yoktur.
 */
export function trendOf(scoresOldestFirst: readonly number[]): Trend | null {
  if (scoresOldestFirst.length < 2) return null;
  const half = Math.floor(scoresOldestFirst.length / 2);
  const older = scoresOldestFirst.slice(0, half);
  const newer = scoresOldestFirst.slice(scoresOldestFirst.length - half);
  const diff = (average(newer) ?? 0) - (average(older) ?? 0);
  if (diff > 3) return "up";
  if (diff < -3) return "down";
  return "flat";
}

/** Kategori başına ortalama puan (0-5, bir ondalık); hiç puan yoksa null. */
export function categoryAverages(
  rows: ReadonlyArray<Record<RatingKey, number | null>>,
): Record<RatingKey, number | null> {
  const out = {} as Record<RatingKey, number | null>;
  for (const key of RATING_KEYS) {
    const values = rows.flatMap((r) => (r[key] === null ? [] : [r[key]]));
    out[key] = values.length === 0 ? null : Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
  }
  return out;
}

/** Hedefe kalan tam gün + saat; hedef geçmişse null. */
export function countdownParts(target: Date, now: Date): { days: number; hours: number } | null {
  const ms = target.getTime() - now.getTime();
  if (ms < 0) return null;
  const totalHours = Math.floor(ms / 3_600_000);
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24 };
}
