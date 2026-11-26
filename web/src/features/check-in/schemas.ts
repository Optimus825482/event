import { z } from "zod";
import { normalizePhone } from "@/features/customers/normalize";
import { MAX_GUEST_COUNT } from "@/features/reservations/schemas";

/** `POST /api/check-in` tek istekte en çok bu kadar öğe kabul eder. */
export const CHECK_IN_BATCH_MAX = 50;

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const id = z.uuid("Geçersiz kimlik");

const gate = z
  .number("Kapı numarası 1 ile 9 arasında olmalıdır")
  .int("Kapı numarası 1 ile 9 arasında olmalıdır")
  .min(1, "Kapı numarası 1 ile 9 arasında olmalıdır")
  .max(9, "Kapı numarası 1 ile 9 arasında olmalıdır")
  .optional();

const guestCount = z.coerce
  .number("Kişi sayısı giriniz")
  .int("Kişi sayısı tam sayı olmalıdır")
  .min(1, "Kişi sayısı en az 1 olmalıdır")
  .max(MAX_GUEST_COUNT, `Kişi sayısı en fazla ${MAX_GUEST_COUNT} olabilir`);

/**
 * Check-in isteği. Rezervasyon tam olarak bir yoldan belirtilir: imzalı QR belirteci (`token`),
 * eski sistemin QR hash'i (`legacyHash`) ya da manuel aramadan rezervasyon kimliği (`reservationId`).
 * `idempotencyKey` istemcinin ürettiği UUID'dir; çevrimdışı kuyruk tekrarlarında aynı kalır.
 */
export const checkInInput = z
  .object({
    eventId: id,
    idempotencyKey: z.uuid("Geçersiz istek anahtarı"),
    token: z.string().trim().min(1, "QR kod boş").max(200, "QR kod çok uzun").optional(),
    legacyHash: z.string().trim().min(1, "QR kod boş").max(128, "QR kod çok uzun").optional(),
    reservationId: id.optional(),
    ticketId: id.optional(),
    gate,
    clientTimestamp: z.iso.datetime({ offset: true, message: "Geçersiz zaman damgası" }).optional(),
  })
  .refine((v) => [v.token, v.legacyHash, v.reservationId, v.ticketId].filter((x) => x !== undefined).length === 1, {
    path: ["token"],
    message: "QR kod, eski QR hash'i, rezervasyon kimliği ya da bilet kimliğinden tam olarak biri verilmelidir",
  });
export type CheckInInput = z.input<typeof checkInInput>;

export const walkInInput = z.object({
  eventId: id,
  tableId: z.uuid("Masa seçiniz"),
  guestName: z
    .string("Misafir adı zorunludur")
    .trim()
    .min(1, "Misafir adı zorunludur")
    .max(100, "Misafir adı en fazla 100 karakter olabilir"),
  guestCount,
  gate,
  guestPhone: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .refine((v) => normalizePhone(v) !== null, "Geçerli bir telefon numarası giriniz (örn: 05551234567)")
      .optional(),
  ),
});
export type WalkInInput = z.infer<typeof walkInInput>;

/**
 * Çevrimdışı kuyruğun walk-in öğesi: aynı alanlar + istemcinin ürettiği `idempotencyKey` (tekrarlarda
 * aynı kalır) ve tarama anı. `kind` yalnızca toplu istekte öğe türünü ayırır; burada yok sayılır.
 */
export const walkInOnceInput = walkInInput.extend({
  idempotencyKey: z.uuid("Geçersiz istek anahtarı"),
  clientTimestamp: z.iso.datetime({ offset: true, message: "Geçersiz zaman damgası" }).optional(),
});
export type WalkInOnceInput = z.input<typeof walkInOnceInput>;

export const updateGuestCountInput = z.object({
  eventId: id,
  reservationId: id,
  guestCount,
});
export type UpdateGuestCountInput = z.infer<typeof updateGuestCountInput>;

export const eventIdInput = z.object({ eventId: id });
export type EventIdInput = z.infer<typeof eventIdInput>;

export const searchGuestsInput = z.object({
  eventId: id,
  q: z.preprocess(blankToUndefined, z.string().trim().max(100, "Arama en fazla 100 karakter olabilir").optional()),
});
export type SearchGuestsInput = z.infer<typeof searchGuestsInput>;
