import { z } from "zod";
import { notificationPriority, notificationTargetRole, notificationType } from "@/db/schema";

export const PRIORITIES = notificationPriority.enumValues;
export const TARGET_ROLES = notificationTargetRole.enumValues;
export const NOTIFICATION_TYPES = notificationType.enumValues;

/** Yalnızca uygulama içi yol: `/x` evet; `//x`, `https://x`, `javascript:` hayır. */
const internalPath = z
  .string()
  .trim()
  .max(500, "Bağlantı en fazla 500 karakter olabilir")
  .refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//") && !v.includes("\\")), {
    message: "Bağlantı uygulama içi bir yol olmalı (ör. /events)",
  })
  .transform((v) => (v === "" ? undefined : v))
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
