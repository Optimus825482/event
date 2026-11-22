import { z } from "zod";
import {
  SIZE_KEYS,
  cssColorSchema,
  cssGradientSchema,
  invitationElementsSchema,
  uploadPathSchema,
} from "./elements";

const optionalColor = cssColorSchema.nullish().transform((v) => v ?? null);
const optionalGradient = cssGradientSchema.nullish().transform((v) => v ?? null);
const optionalUpload = uploadPathSchema.nullish().transform((v) => v ?? null);

const dimension = z.number().int().min(100).max(3000);

const designFields = {
  size: z.enum(SIZE_KEYS),
  width: dimension,
  height: dimension,
  backgroundColor: optionalColor,
  backgroundImage: optionalUpload,
  backgroundGradient: optionalGradient,
};

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, "Ad zorunludur").max(120),
  description: z.string().trim().max(500).optional(),
  ...designFields,
  elements: invitationElementsSchema,
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = createTemplateSchema.extend({ id: z.uuid() });
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const templateIdSchema = z.object({ id: z.uuid() });
export type TemplateIdInput = z.infer<typeof templateIdSchema>;

/** `customElements` verilmezse etkinlik seçili şablonu kullanır. */
export const saveEventInvitationSchema = z.object({
  eventId: z.uuid(),
  templateId: z.uuid().nullish().transform((v) => v ?? null),
  customElements: invitationElementsSchema.nullish().transform((v) => v ?? null),
  ...designFields,
  companyLogo: optionalUpload,
});
export type SaveEventInvitationInput = z.infer<typeof saveEventInvitationSchema>;

export const eventIdSchema = z.object({ eventId: z.uuid() });
export type EventIdInput = z.infer<typeof eventIdSchema>;

export const removeImageSchema = z.object({ eventId: z.uuid(), path: uploadPathSchema });
export type RemoveImageInput = z.infer<typeof removeImageSchema>;

export const reservationIdSchema = z.object({ reservationId: z.uuid() });
export type ReservationIdInput = z.infer<typeof reservationIdSchema>;
