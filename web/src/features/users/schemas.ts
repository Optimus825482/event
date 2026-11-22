import { z } from "zod";
import { ROLES } from "@/features/auth/roles";
import { isValidUsername } from "@/features/auth/username";

/** `MIN_PASSWORD_LENGTH` (features/auth/auth.ts) ile aynı; testle eşitliği doğrulanır. */
export const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 200;

/** `permission_module` enum'u (db/schema/people.ts) ile aynı 10 modül. */
export const PERMISSION_MODULES = [
  "events",
  "reservations",
  "check_in",
  "staff",
  "customers",
  "venues",
  "settings",
  "users",
  "invitations",
  "notifications",
] as const;

const id = z.uuid("Geçersiz kimlik");
const role = z.enum(ROLES, "Geçersiz rol");

const username = z
  .string()
  .refine(isValidUsername, "Kullanıcı adı 1–100 karakter olmalı; başında/sonunda boşluk ve kontrol karakteri içermemeli");

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Parola en az ${PASSWORD_MIN_LENGTH} karakter olmalı`)
  .max(PASSWORD_MAX_LENGTH, "Parola çok uzun");

const email = z.email("Geçerli bir e-posta girin").max(255);

/** Boş metin `null` (alanı temizle) olur; `undefined` değiştirme demektir. */
const clearableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === null || v === "" ? null : v));

export const createUserSchema = z.object({
  username,
  password,
  role,
  email: z.union([z.literal(""), email]).optional(),
  name: z.string().trim().max(255).optional(),
  staffId: id.nullable().optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  id,
  name: z.string().trim().min(1, "Ad gerekli").max(255).optional(),
  email: email.optional(),
  role: role.optional(),
  staffId: id.nullable().optional(),
  color: clearableText(50).optional(),
  phone: clearableText(50).optional(),
  position: clearableText(100).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const setUserActiveSchema = z.object({ id, active: z.boolean() });
export type SetUserActiveInput = z.infer<typeof setUserActiveSchema>;

export const resetPasswordSchema = z.object({ id, password });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const permissionRowSchema = z.object({
  module: z.enum(PERMISSION_MODULES, "Geçersiz modül"),
  canView: z.boolean(),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

export const setPermissionsSchema = z.object({
  id,
  permissions: z.array(permissionRowSchema).refine(
    (rows) => new Set(rows.map((r) => r.module)).size === rows.length,
    "Her modül en fazla bir kez verilebilir",
  ),
});
export type SetPermissionsInput = z.infer<typeof setPermissionsSchema>;
