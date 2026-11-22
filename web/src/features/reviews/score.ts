/** Saf puan hesabı: veritabanı ya da Next'e bağımlı değildir (istemci de kullanır). */

export const RATING_KEYS = [
  "communication",
  "punctuality",
  "teamwork",
  "customerService",
  "technicalSkills",
  "initiative",
  "appearance",
  "stressManagement",
] as const;

export type RatingKey = (typeof RATING_KEYS)[number];

/** Kategori ağırlıkları (toplam 100). */
export const RATING_WEIGHTS: Record<RatingKey, number> = {
  communication: 15,
  punctuality: 15,
  teamwork: 15,
  customerService: 20,
  technicalSkills: 10,
  initiative: 10,
  appearance: 5,
  stressManagement: 10,
};

export const MAX_RATING = 5;

/** Her kategori 0–5; verilmeyen (null/undefined) kategori hem toplamdan hem paydadan çıkar. */
export type Ratings = Partial<Record<RatingKey, number | null | undefined>>;

export type RatingBand = "very_bad" | "bad" | "average" | "good" | "successful" | "excellent";

/**
 * Genel puan (0–100, tam sayı) = Σ(puan/5 × ağırlık) / Σağırlık × 100; yalnızca verilen
 * kategoriler sayılır. Hiç puan yoksa 0.
 */
export function computeScore(ratings: Ratings): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const key of RATING_KEYS) {
    const value = ratings[key];
    if (value === null || value === undefined) continue;
    weighted += value * RATING_WEIGHTS[key];
    totalWeight += RATING_WEIGHTS[key];
  }
  if (totalWeight === 0) return 0;
  // (weighted / (5 × totalWeight)) × 100 = weighted × 20 / totalWeight; tam sayı bölmesi, ondalık hatası yok.
  return Math.round((weighted * (100 / MAX_RATING)) / totalWeight);
}

/** Eşikler: ≥90, ≥80, ≥60, ≥40, ≥20. */
export function ratingBand(score: number): RatingBand {
  if (score >= 90) return "excellent";
  if (score >= 80) return "successful";
  if (score >= 60) return "good";
  if (score >= 40) return "average";
  if (score >= 20) return "bad";
  return "very_bad";
}
