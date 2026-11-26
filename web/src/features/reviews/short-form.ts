import { z } from "zod";
import { ratingBand, RATING_KEYS, type RatingBand, type RatingKey } from "./score";

/** Boş ya da verilmeyen metin "yok" demektir; en fazla 500 karakter. */
const shortNote = (message: string) =>
  z.preprocess(
    (v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v),
    z.string().trim().max(500, message).nullable(),
  );

export const shortReviewSchema = z.object({
  eventId: z.uuid("Geçersiz etkinlik"),
  staffId: z.uuid("Geçersiz personel"),
  overallRating: z
    .number({ error: "Puan sayı olmalı" })
    .int("Genel puan 1 ile 5 arasında olmalı")
    .min(1, "Genel puan 1 ile 5 arasında olmalı")
    .max(5, "Genel puan 1 ile 5 arasında olmalı")
    .nullable(),
  comment: shortNote("Kısa not en fazla 500 karakter olabilir"),
  nextEventNotes: shortNote("Sonraki etkinlik notu en fazla 500 karakter olabilir"),
});
export type ShortReviewInput = z.output<typeof shortReviewSchema>;

/** Genel puan (0–100) = yıldız × 20; puansız form 0. */
export function shortScore(overall: number | null): number {
  return overall === null ? 0 : overall * 20;
}

export type ShortReviewValues = {
  formKind: "short";
  overallRating: number | null;
  score: number;
  rating: RatingBand;
  strengths: string[];
  improvements: string[];
  recommendedTrainings: string[];
  comment: string | null;
  nextEventNotes: string | null;
} & Record<RatingKey, null>;

/** Kısa form satır değerleri: kategori puanları ve listeler temizlenir; `privateNotes` dokunulmaz. */
export function shortReviewValues(input: ShortReviewInput): ShortReviewValues {
  const score = shortScore(input.overallRating);
  return {
    ...(Object.fromEntries(RATING_KEYS.map((key) => [key, null])) as Record<RatingKey, null>),
    formKind: "short",
    overallRating: input.overallRating,
    score,
    rating: ratingBand(score),
    strengths: [],
    improvements: [],
    recommendedTrainings: [],
    comment: input.comment,
    nextEventNotes: input.nextEventNotes,
  };
}

/** Tamamlanabilirlik: kısa formda genel puan, ayrıntılı formda 8 kategorinin hepsi dolu olmalı. */
export function isReviewComplete(
  row: { formKind: string; overallRating: number | null } & Record<RatingKey, number | null>,
): boolean {
  if (row.formKind === "short") return row.overallRating !== null;
  return RATING_KEYS.every((key) => row[key] !== null);
}
