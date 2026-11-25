import { z } from "zod";

/** Boş / yalnızca boşluk metni `null`'a çevirir. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === null || v === "" ? null : v));

const count = z.number().int().min(1).max(100);

/**
 * Sistem ayarları güncelleme girdisi (hepsi isteğe bağlı). `logo` ve şifreli alan bilerek
 * yoktur: logo yalnızca yükleme akışıyla, şifre yalnızca `smtpPassword` ile değişir.
 * `smtpPassword`: verilmezse mevcut korunur; `null` ya da boş metin siler.
 */
export const updateSettingsSchema = z.object({
  companyName: z.string().trim().min(1, "Firma adı gerekli").max(255).optional(),
  language: z.string().trim().min(1).max(10).optional(),
  defaultGridSize: count.optional(),
  snapToGrid: z.boolean().optional(),
  showGridByDefault: z.boolean().optional(),
  defaultGuestCount: count.optional(),
  allowOverbooking: z.boolean().optional(),
  requirePhoneNumber: z.boolean().optional(),
  requireEmail: z.boolean().optional(),
  autoCheckInEnabled: z.boolean().optional(),
  checkInSoundEnabled: z.boolean().optional(),
  showTableDirections: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  qrCodeSystemEnabled: z.boolean().optional(),
  invitationSystemEnabled: z.boolean().optional(),
  smtpHost: optionalText(255).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: optionalText(255).optional(),
  smtpFromEmail: z
    .union([z.literal(""), z.email().max(255)])
    .nullable()
    .transform((v) => (v === null || v === "" ? null : v))
    .optional(),
  smtpFromName: optionalText(255).optional(),
  smtpSecure: z.boolean().optional(),
  smtpPassword: z.string().max(500).nullable().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
