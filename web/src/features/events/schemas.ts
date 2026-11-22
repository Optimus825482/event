import { z } from "zod";
import { EVENT_STATUSES } from "@/domain/event-status";

/** Form alanları boş string gönderebilir; boş değer "yok" demektir. */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const optionalText = (max: number, tooLong: string) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max, tooLong).optional());

const requiredDate = (message: string) =>
  z.preprocess(emptyToUndefined, z.coerce.date({ error: message }));

const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date({ error: "Geçerli bir tarih girin" }).optional());

const baseShape = {
  name: z
    .string({ error: "Etkinlik adı gerekli" })
    .trim()
    .min(1, "Etkinlik adı gerekli")
    .max(200, "Etkinlik adı en fazla 200 karakter olabilir"),
  description: optionalText(2000, "Açıklama en fazla 2000 karakter olabilir"),
  startsAt: requiredDate("Başlangıç tarihi gerekli"),
  endsAt: optionalDate,
  eventType: optionalText(100, "Etkinlik türü en fazla 100 karakter olabilir"),
  reservationEnabled: z.boolean().optional(),
};

type Timed = { startsAt: Date; endsAt?: Date | undefined };

function endsAfterStarts({ startsAt, endsAt }: Timed): boolean {
  return endsAt === undefined || endsAt.getTime() > startsAt.getTime();
}

const END_AFTER_START = {
  path: ["endsAt"],
  error: "Bitiş, başlangıçtan sonra olmalı",
};

/** Oluşturmada başlangıç geçmişte olamaz (güncellemede kontrol edilmez: devam eden etkinlik düzenlenebilir). */
export const createEventSchema = z
  .object({
    ...baseShape,
    startsAt: z.preprocess(
      emptyToUndefined,
      z.coerce
        .date({ error: "Başlangıç tarihi gerekli" })
        .refine((d) => d.getTime() >= Date.now(), "Başlangıç geçmişte olamaz"),
    ),
  })
  .refine(endsAfterStarts, END_AFTER_START);

export const updateEventSchema = z
  .object({
    ...baseShape,
    id: z.uuid(),
    reviewEnabled: z.boolean().optional(),
    reviewHistoryVisible: z.boolean().optional(),
  })
  .refine(endsAfterStarts, END_AFTER_START);

export const changeEventStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(EVENT_STATUSES, { error: "Geçersiz durum" }),
});

/** Değerlendirme anahtarları: en az biri verilmeli. */
export const reviewSettingsSchema = z
  .object({
    id: z.uuid(),
    reviewEnabled: z.boolean().optional(),
    reviewHistoryVisible: z.boolean().optional(),
  })
  .refine((v) => v.reviewEnabled !== undefined || v.reviewHistoryVisible !== undefined, {
    path: ["reviewEnabled"],
    error: "En az bir ayar verilmeli",
  });

export const deleteEventSchema = z.object({ id: z.uuid() });

export const listEventsFilterSchema = z.object({
  status: z.enum(EVENT_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ChangeEventStatusInput = z.infer<typeof changeEventStatusSchema>;
export type ReviewSettingsInput = z.infer<typeof reviewSettingsSchema>;
export type DeleteEventInput = z.infer<typeof deleteEventSchema>;
export type ListEventsFilter = z.infer<typeof listEventsFilterSchema>;
