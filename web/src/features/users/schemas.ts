import { z } from "zod";
import { DEPARTMENT_LEVELS, DEPARTMENTS } from "@/features/auth/departments";
import { ROLES } from "@/features/auth/roles";
import { MIN_PASSWORD_LENGTH, passwordPolicyError } from "@/features/auth/password-policy";
import { isValidUsername } from "@/features/auth/username";
import { checkAvatarDataUrl } from "./avatar";

export const PASSWORD_MIN_LENGTH = MIN_PASSWORD_LENGTH;
const PASSWORD_MAX_LENGTH = 200;

/** `permission_module` enum'unun, departman tavanında yer alabilen alt kümesi (`users` ve `settings` yalnızca admin). */
export const PERMISSION_MODULES = [
  "events",
  "invitations",
  "notifications",
  "venues",
  "staff",
  "reviews",
  "reservations",
  "customers",
  "check_in",
] as const;

const id = z.uuid("Geçersiz kimlik");
const role = z.enum(ROLES, "Geçersiz rol");

const username = z
  .string()
  .refine(isValidUsername, "Kullanıcı adı 1–100 karakter olmalı; başında/sonunda boşluk ve kontrol karakteri içermemeli");

const password = z
  .string()
  .max(PASSWORD_MAX_LENGTH, "Parola çok uzun")
  .superRefine((value, ctx) => {
    const error = passwordPolicyError(value);
    if (error) ctx.addIssue({ code: "custom", message: error });
  });

const email = z.email("Geçerli bir e-posta girin").max(255);

/** Boş metin `null` (alanı temizle) olur; `undefined` değiştirme demektir. */
const clearableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === null || v === "" ? null : v));

export const membershipSchema = z.object({
  department: z.enum(DEPARTMENTS, "Geçersiz departman"),
  level: z.enum(DEPARTMENT_LEVELS, "Geçersiz düzey"),
});

const membershipsSchema = z
  .array(membershipSchema)
  .refine(
    (rows) => new Set(rows.map((r) => r.department)).size === rows.length,
    "Her departman en fazla bir kez seçilebilir",
  );

export const permissionRowSchema = z.object({
  module: z.enum(PERMISSION_MODULES, "Geçersiz modül"),
  canView: z.boolean(),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

const permissionRowsSchema = z
  .array(permissionRowSchema)
  .refine((rows) => new Set(rows.map((r) => r.module)).size === rows.length, "Her modül en fazla bir kez verilebilir");

export const createUserSchema = z.object({
  username,
  password,
  role,
  memberships: membershipsSchema,
  permissions: permissionRowsSchema,
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
  memberships: membershipsSchema.optional(),
  permissions: permissionRowsSchema.optional(),
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

export const setPermissionsSchema = z.object({ id, permissions: permissionRowsSchema });
export type SetPermissionsInput = z.infer<typeof setPermissionsSchema>;

export const setMembershipsSchema = z.object({ id, memberships: membershipsSchema });
export type SetMembershipsInput = z.infer<typeof setMembershipsSchema>;

export const deleteUserSchema = z.object({ id });
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;

/** Kendi profil fotoğrafı: doğrulanmış `data:` URL ya da `null` (kaldır). Ayrıntılı denetim `avatar.ts`. */
export const setOwnAvatarSchema = z.object({
  image: z
    .string()
    .superRefine((value, ctx) => {
      const check = checkAvatarDataUrl(value);
      if (!check.ok) ctx.addIssue({ code: "custom", message: check.message });
    })
    .nullable(),
});
export type SetOwnAvatarInput = z.infer<typeof setOwnAvatarSchema>;

/** Kendi parolasını değiştirme: yeni parola yönetici parola sıfırlamayla aynı kuralları izler. */
export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mevcut parolayı girin").max(PASSWORD_MAX_LENGTH, "Parola çok uzun"),
    newPassword: password,
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Yeni parola mevcut parolayla aynı olamaz",
  });
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;
