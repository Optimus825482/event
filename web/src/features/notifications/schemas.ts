import { z } from "zod";
import { notificationPriority, notificationTargetRole, notificationType } from "@/db/schema";

export const PRIORITIES = notificationPriority.enumValues;
export const TARGET_ROLES = notificationTargetRole.enumValues;
export const NOTIFICATION_TYPES = notificationType.enumValues;

const URL_BASE = "https://app.invalid";
// Denetim karakterleri ve her türlü boşluk (tarayıcılar sekme/satır sonunu sessizce siler).
const FORBIDDEN_CHARS = /[\p{Cc}\s]/u;

/** Güvenli uygulama içi yolu normalleştirir (`pathname + search + hash`); geçersizse `null`. */
export function normalizeInternalPath(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || FORBIDDEN_CHARS.test(value)) {
    return null;
  }
  try {
    const url = new URL(value, URL_BASE);
    if (url.origin !== URL_BASE) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Yalnızca uygulama içi yol: `/x` evet; `//x`, `https://x`, `javascript:`, boşluk/denetim karakteri hayır. */
const internalPath = z
  .string()
  .trim()
  .max(500, "Bağlantı en fazla 500 karakter olabilir")
  .transform((v, ctx) => {
    if (v === "") return undefined;
    const normalized = normalizeInternalPath(v);
    if (normalized === null) {
      ctx.addIssue({ code: "custom", message: "Bağlantı uygulama içi bir yol olmalı (ör. /events)" });
      return z.NEVER;
    }
    return normalized;
  })
  .optional();

const optionalUuid = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.uuid("Geçersiz etkinlik").optional(),
);

export const createNotificationSchema = z.object({
  title: z.string({ error: "Başlık gerekli" }).trim().min(1, "Başlık gerekli").max(200, "Başlık en fazla 200 karakter olabilir"),
  message: z
    .string({ error: "Mesaj gerekli" })
    .trim()
    .min(1, "Mesaj gerekli")
    .max(2000, "Mesaj en fazla 2000 karakter olabilir"),
  priority: z.enum(PRIORITIES, { error: "Geçersiz öncelik" }),
  targetRole: z.enum(TARGET_ROLES, { error: "Geçersiz hedef rol" }),
  eventId: optionalUuid,
  actionUrl: internalPath,
});
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export const markReadSchema = z.object({ id: z.uuid("Geçersiz bildirim") });
export type MarkReadInput = z.infer<typeof markReadSchema>;

export const markAllReadSchema = z.object({});

export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  unreadOnly: z.boolean().optional(),
});
export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;
