import { z } from "zod";
import { normalizeEmail, normalizePhone } from "./normalize";

export const NOTE_TYPES = ["pre_event", "during_event", "post_event", "general"] as const;
export type NoteType = (typeof NOTE_TYPES)[number];
export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  pre_event: "Etkinlik öncesi",
  during_event: "Etkinlik sırası",
  post_event: "Etkinlik sonrası",
  general: "Genel",
};

const PHONE_MESSAGE = "Geçerli bir telefon numarası giriniz (örn: 05551234567)";
const EMAIL_MESSAGE = "Geçerli bir e-posta adresi giriniz";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const fullName = z
  .string()
  .trim()
  .min(2, "İsim en az 2 karakter olmalıdır")
  .max(100, "İsim en fazla 100 karakter olabilir");
const phone = z
  .string()
  .trim()
  .refine((v) => normalizePhone(v) !== null, PHONE_MESSAGE);
const email = z
  .string()
  .trim()
  .max(255, "E-posta en fazla 255 karakter olabilir")
  .refine((v) => normalizeEmail(v) !== null, EMAIL_MESSAGE);
const notes = z.string().trim().max(1000, "Notlar en fazla 1000 karakter olabilir");
const noteContent = z.string().trim().min(1, "Not boş olamaz").max(2000, "Not en fazla 2000 karakter olabilir");
export const tagSchema = z.string().trim().min(1, "Etiket boş olamaz").max(50, "Etiket en fazla 50 karakter olabilir");
const id = z.uuid("Geçersiz kimlik");

export const createCustomerInput = z.object({
  fullName,
  phone: z.preprocess(blankToUndefined, phone.optional()),
  email: z.preprocess(blankToUndefined, email.optional()),
  tags: z.array(tagSchema).max(20, "En fazla 20 etiket eklenebilir").default([]),
  notes: z.preprocess(blankToUndefined, notes.optional()),
});
export type CreateCustomerInput = z.infer<typeof createCustomerInput>;

/** `null` alanı temizler, `undefined` (ya da eksik) alana dokunmaz. */
export const updateCustomerInput = z.object({
  id,
  fullName: fullName.optional(),
  phone: z.preprocess(blankToNull, phone.nullable().optional()),
  email: z.preprocess(blankToNull, email.nullable().optional()),
  vipScore: z
    .number()
    .int("VIP puanı tam sayı olmalıdır")
    .min(0, "VIP puanı 0 dan küçük olamaz")
    .max(100, "VIP puanı 100 den büyük olamaz")
    .optional(),
  notes: z.preprocess(blankToNull, notes.nullable().optional()),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerInput>;

export const customerIdInput = z.object({ id });
export const setBlacklistInput = z.object({ id, isBlacklisted: z.boolean() });
export const tagInput = z.object({ customerId: id, tag: tagSchema });

export const addNoteInput = z.object({
  customerId: id,
  content: noteContent,
  noteType: z.enum(NOTE_TYPES).default("general"),
  eventId: z.preprocess(blankToUndefined, id.optional()),
  reservationId: z.preprocess(blankToUndefined, id.optional()),
});
export type AddNoteInput = z.infer<typeof addNoteInput>;
export const updateNoteInput = z.object({ id, content: noteContent });
export const noteIdInput = z.object({ id });

export const searchCustomersInput = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type SearchCustomersInput = z.input<typeof searchCustomersInput>;
