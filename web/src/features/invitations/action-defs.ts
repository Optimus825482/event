import { z } from "zod";
import { db } from "@/db/client";
import type { ActionOptions } from "@/lib/action";
import { getWhatsAppLink, sendInvitationEmail } from "./delivery";
import { addEventImage, removeEventImage, saveEventInvitation } from "./event-invitation";
import {
  createTemplateSchema,
  removeImageSchema,
  reservationIdSchema,
  saveEventInvitationSchema,
  templateIdSchema,
  updateTemplateSchema,
} from "./schemas";
import { createTemplate, deleteTemplate, setDefaultTemplate, updateTemplate } from "./templates";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

const imageFormSchema = z
  .instanceof(FormData, { message: "Form verisi gerekli" })
  .transform((form) => ({ eventId: form.get("eventId"), file: form.get("file") }))
  .pipe(z.object({ eventId: z.uuid(), file: z.instanceof(File, { message: "Bir görüntü dosyası seçin" }) }));

/** `defineAction` seçenekleri; gerçek action'lar `actions.ts` içinde, testler `createAction` ile bunları çalıştırır. */
export const invitationActionDefs = {
  createTemplate: def({
    module: "invitations",
    verb: "create",
    input: createTemplateSchema,
    handler: async ({ actor, input }) => {
      const row = await createTemplate(db, actor, input);
      return { id: row.id };
    },
  }),
  updateTemplate: def({
    module: "invitations",
    verb: "edit",
    input: updateTemplateSchema,
    handler: async ({ actor, input }) => {
      const row = await updateTemplate(db, actor, input);
      return { id: row.id };
    },
  }),
  deleteTemplate: def({
    module: "invitations",
    verb: "delete",
    input: templateIdSchema,
    handler: ({ actor, input }) => deleteTemplate(db, actor, input),
  }),
  setDefaultTemplate: def({
    module: "invitations",
    verb: "edit",
    input: templateIdSchema,
    handler: ({ actor, input }) => setDefaultTemplate(db, actor, input),
  }),
  saveEventInvitation: def({
    module: "invitations",
    verb: "edit",
    input: saveEventInvitationSchema,
    handler: ({ actor, input }) => saveEventInvitation(db, actor, input),
  }),
  uploadImage: def({
    module: "invitations",
    verb: "edit",
    input: imageFormSchema,
    handler: ({ actor, input }) => addEventImage(db, actor, { eventId: input.eventId }, input.file),
  }),
  removeImage: def({
    module: "invitations",
    verb: "edit",
    input: removeImageSchema,
    handler: ({ actor, input }) => removeEventImage(db, actor, input),
  }),
  sendEmail: def({
    module: "invitations",
    verb: "edit",
    input: reservationIdSchema,
    handler: ({ actor, input }) => sendInvitationEmail(db, actor, input),
  }),
  whatsappLink: def({
    module: "invitations",
    verb: "view",
    input: reservationIdSchema,
    handler: ({ actor, input }) => getWhatsAppLink(db, actor, input),
  }),
};
