import { z } from "zod";

/** Boş dizgeyi `null`a çeviren, kırpılmış isteğe bağlı metin. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `En fazla ${max} karakter olabilir`)
    .nullish()
    .transform((v) => (v ? v : null));
}

const requiredText = (max: number) =>
  z.string().trim().min(1, "Bu alan zorunludur").max(max, `En fazla ${max} karakter olabilir`);

const optionalId = z
  .uuid("Geçersiz seçim")
  .nullish()
  .transform((v) => v ?? null);

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Renk #rrggbb biçiminde olmalıdır");
const optionalColor = hexColor.nullish().transform((v) => v ?? null);

const optionalDate = z.iso
  .date("Tarih YYYY-AA-GG biçiminde olmalıdır")
  .nullish()
  .transform((v) => v ?? null);

const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .transform((v) => (v ? v : null))
  .pipe(z.email("Geçerli bir e-posta girin").nullable());

export const idSchema = z.object({ id: z.uuid() });
export type IdInput = z.infer<typeof idSchema>;

const sortOrder = z.number().int().min(0).max(9999).default(0);

// ---- Personel ----

export const STAFF_STATUSES = ["active", "inactive", "terminated"] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const staffInputSchema = z.object({
  sicilNo: requiredText(50),
  fullName: requiredText(200),
  email: optionalEmail,
  phone: optionalText(30),
  departmentId: optionalId,
  positionId: optionalId,
  workLocationId: optionalId,
  mentor: optionalText(200),
  color: optionalColor,
  gender: z.enum(["male", "female"]).nullish().transform((v) => v ?? null),
  birthDate: optionalDate,
  bloodType: optionalText(10),
  shoeSize: z
    .number()
    .int("Tam sayı girin")
    .min(15, "Geçersiz numara")
    .max(60, "Geçersiz numara")
    .nullish()
    .transform((v) => v ?? null),
  sockSize: optionalText(20),
  hireDate: optionalDate,
});
export type StaffInput = z.output<typeof staffInputSchema>;

export const updateStaffSchema = staffInputSchema.extend({ id: z.uuid() });
export type UpdateStaffInput = z.output<typeof updateStaffSchema>;

export const setStaffStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(STAFF_STATUSES),
  terminationDate: optionalDate,
  terminationReason: optionalText(500),
});
export type SetStaffStatusInput = z.output<typeof setStaffStatusSchema>;

export const staffFilterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(STAFF_STATUSES).optional(),
  departmentId: z.uuid().optional(),
  positionId: z.uuid().optional(),
  workLocationId: z.uuid().optional(),
});
export type StaffFilter = z.infer<typeof staffFilterSchema>;

// ---- Kataloglar ----

const catalogBase = {
  name: requiredText(100),
  description: optionalText(500),
  sortOrder,
  isActive: z.boolean().default(true),
};

export const departmentInputSchema = z.object({ ...catalogBase, color: optionalColor });
export const updateDepartmentSchema = departmentInputSchema.extend({ id: z.uuid() });
export type DepartmentInput = z.output<typeof departmentInputSchema>;
export type UpdateDepartmentInput = z.output<typeof updateDepartmentSchema>;

export const positionInputSchema = z.object(catalogBase);
export const updatePositionSchema = positionInputSchema.extend({ id: z.uuid() });
export type PositionInput = z.output<typeof positionInputSchema>;
export type UpdatePositionInput = z.output<typeof updatePositionSchema>;

export const workLocationInputSchema = z.object({ ...catalogBase, address: optionalText(300) });
export const updateWorkLocationSchema = workLocationInputSchema.extend({ id: z.uuid() });
export type WorkLocationInput = z.output<typeof workLocationInputSchema>;
export type UpdateWorkLocationInput = z.output<typeof updateWorkLocationSchema>;

export const staffRoleInputSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Bu alan zorunludur")
    .max(50)
    .regex(/^[a-z0-9_-]+$/, "Yalnızca küçük harf, rakam, - ve _ kullanılabilir"),
  label: requiredText(100),
  color: hexColor.default("#3b82f6"),
  badgeColor: z.string().trim().max(200).default("bg-blue-500/20 text-blue-400 border-blue-500/30"),
  bgColor: z.string().trim().max(100).default("bg-blue-500"),
  sortOrder,
  isActive: z.boolean().default(true),
});
export const updateStaffRoleSchema = staffRoleInputSchema.omit({ key: true }).extend({ id: z.uuid() });
export type StaffRoleInput = z.output<typeof staffRoleInputSchema>;
export type UpdateStaffRoleInput = z.output<typeof updateStaffRoleSchema>;

const timeOfDay = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat SS:DD biçiminde olmalıdır");

// Gece vardiyası (18:00 → 02:00) geçerlidir; yalnızca başlangıç = bitiş reddedilir.
export const shiftInputSchema = z
  .object({
    name: requiredText(100),
    startTime: timeOfDay,
    endTime: timeOfDay,
    color: hexColor.default("#3b82f6"),
    sortOrder,
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.startTime !== v.endTime, {
    path: ["endTime"],
    message: "Bitiş saati başlangıçtan farklı olmalıdır",
  });
export const updateShiftSchema = z
  .object({
    id: z.uuid(),
    name: requiredText(100),
    startTime: timeOfDay,
    endTime: timeOfDay,
    color: hexColor.default("#3b82f6"),
    sortOrder,
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.startTime !== v.endTime, {
    path: ["endTime"],
    message: "Bitiş saati başlangıçtan farklı olmalıdır",
  });
export type ShiftInput = z.output<typeof shiftInputSchema>;
export type UpdateShiftInput = z.output<typeof updateShiftSchema>;
