import { z } from "zod";
import { MAX_RATING, RATING_KEYS, type RatingKey } from "./score";

const rating = z
  .number({ error: "Puan sayı olmalı" })
  .int("Puan tam sayı olmalı")
  .min(0, "Puan 0 ile 5 arasında olmalı")
  .max(MAX_RATING, "Puan 0 ile 5 arasında olmalı")
  .nullable()
  .optional();

export const ratingsSchema = z.object(
  Object.fromEntries(RATING_KEYS.map((key) => [key, rating])) as Record<RatingKey, typeof rating>,
);

const tagList = (label: string) =>
  z
    .array(z.string().trim().min(1).max(200, `${label} öğesi en fazla 200 karakter olabilir`))
    .max(20, `${label} en fazla 20 öğe içerebilir`)
    .default([]);

/** Form boş metin gönderebilir; boş değer "yok" demektir. */
const optionalNote = (label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(2000, `${label} en fazla 2000 karakter olabilir`).nullable().optional(),
  );

export const saveReviewSchema = z.object({
  eventId: z.uuid("Geçersiz etkinlik"),
  staffId: z.uuid("Geçersiz personel"),
  ratings: ratingsSchema,
  strengths: tagList("Güçlü yönler"),
  improvements: tagList("Geliştirilecek yönler"),
  recommendedTrainings: tagList("Önerilen eğitimler"),
  comment: optionalNote("Yorum"),
  privateNotes: optionalNote("Özel notlar"),
  nextEventNotes: optionalNote("Sonraki etkinlik notları"),
});
export type SaveReviewInput = z.input<typeof saveReviewSchema>;
export type ParsedSaveReviewInput = z.output<typeof saveReviewSchema>;

export const completeReviewSchema = z.object({
  eventId: z.uuid("Geçersiz etkinlik"),
  staffId: z.uuid("Geçersiz personel"),
});
export type CompleteReviewInput = z.infer<typeof completeReviewSchema>;

export const completeAllReviewsSchema = z.object({ eventId: z.uuid("Geçersiz etkinlik") });
export type CompleteAllReviewsInput = z.infer<typeof completeAllReviewsSchema>;
