import { z } from "zod";
import { RESERVATION_STATUSES } from "@/domain/reservation-status";
import { normalizeEmail, normalizePhone } from "@/features/customers/normalize";

/** Veritabanı kısıtı `reservations_guest_count_range` ile aynı üst sınır. */
export const MAX_GUEST_COUNT = 50;

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const id = z.uuid("Geçersiz kimlik");
const guestCount = z.coerce
  .number("Kişi sayısı giriniz")
  .int("Kişi sayısı tam sayı olmalıdır")
  .min(1, "Kişi sayısı en az 1 olmalıdır")
  .max(MAX_GUEST_COUNT, `Kişi sayısı en fazla ${MAX_GUEST_COUNT} olabilir`);
const guestName = z
  .string()
  .trim()
  .min(2, "İsim en az 2 karakter olmalıdır")
  .max(100, "İsim en fazla 100 karakter olabilir");
const guestPhone = z
  .string()
  .trim()
  .refine((v) => normalizePhone(v) !== null, "Geçerli bir telefon numarası giriniz (örn: 05551234567)");
const guestEmail = z
  .string()
  .trim()
  .max(255, "E-posta en fazla 255 karakter olabilir")
  .refine((v) => normalizeEmail(v) !== null, "Geçerli bir e-posta adresi giriniz");
const specialRequests = z.string().trim().max(1000, "Özel istek en fazla 1000 karakter olabilir");
const flag = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const createReservationInput = z
  .object({
    eventId: id,
    tableId: z.uuid("Masa seçiniz"),
    guestCount,
    customerId: z.preprocess(blankToUndefined, id.optional()),
    guestName: z.preprocess(blankToUndefined, guestName.optional()),
    guestPhone: z.preprocess(blankToUndefined, guestPhone.optional()),
    guestEmail: z.preprocess(blankToUndefined, guestEmail.optional()),
    specialRequests: z.preprocess(blankToUndefined, specialRequests.optional()),
    overrideBlacklist: flag.optional(),
  })
  .refine((v) => v.customerId !== undefined || v.guestName !== undefined, {
    path: ["guestName"],
    message: "Müşteri seçin ya da misafir adı girin",
  });
export type CreateReservationInput = z.infer<typeof createReservationInput>;

/** Verilmeyen alan değişmez; `null` (ya da boş metin) misafir alanını temizler. */
export const updateReservationInput = z.object({
  id,
  tableId: z.preprocess(blankToUndefined, id.optional()),
  guestCount: z.preprocess(blankToUndefined, guestCount.optional()),
  guestName: z.preprocess(blankToNull, guestName.nullable().optional()),
  guestPhone: z.preprocess(blankToNull, guestPhone.nullable().optional()),
  guestEmail: z.preprocess(blankToNull, guestEmail.nullable().optional()),
  specialRequests: z.preprocess(blankToNull, specialRequests.nullable().optional()),
});
export type UpdateReservationInput = z.infer<typeof updateReservationInput>;

export const changeReservationStatusInput = z.object({
  id,
  status: z.enum(RESERVATION_STATUSES, "Geçersiz durum"),
  overrideBlacklist: flag.optional(),
});
export type ChangeReservationStatusInput = z.infer<typeof changeReservationStatusInput>;

export const reservationIdInput = z.object({ id });
export type ReservationIdInput = z.infer<typeof reservationIdInput>;

/** Toplu iptal: en fazla 200 rezervasyon; tekrar eden kimlikler tek sayılır. */
export const bulkCancelReservationsInput = z.object({
  ids: z
    .array(id)
    .min(1, "En az bir rezervasyon seçin")
    .max(200, "Tek seferde en fazla 200 rezervasyon iptal edilebilir")
    .transform((list) => [...new Set(list)]),
});
export type BulkCancelReservationsInput = z.infer<typeof bulkCancelReservationsInput>;

export const eventIdInput = z.object({ eventId: id });
export type EventIdInput = z.infer<typeof eventIdInput>;

export const listReservationsInput = z.object({
  eventId: id,
  // URL'den gelir: geçersiz değer hata değil, süzgeçsiz liste demektir.
  q: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()).catch(undefined),
  status: z.preprocess(blankToUndefined, z.enum(RESERVATION_STATUSES).optional()).catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).catch(50).default(50),
});
export type ListReservationsInput = z.input<typeof listReservationsInput>;
