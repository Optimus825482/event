import { z } from "zod";
import { db } from "@/db/client";
import type { ActionOptions } from "@/lib/action";
import { saveSiteContent } from "./content-service";
import { IMAGE_SLOTS } from "./image-status";
import { removeSiteImage, replaceSiteImage } from "./images-service";
import { saveSiteContentSchema, siteImageSchema } from "./schemas";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

const uploadImageFormSchema = z
  .instanceof(FormData, { message: "Form verisi gerekli" })
  .transform((form) => ({
    eventId: form.get("eventId"),
    slot: form.get("slot"),
    file: form.get("file"),
  }))
  .pipe(
    z.object({
      eventId: z.uuid(),
      slot: z.enum(IMAGE_SLOTS),
      file: z.instanceof(File, { message: "Bir görüntü dosyası seçin" }),
    }),
  );

export const salesSiteActionDefs = {
  saveContent: def({
    module: "events",
    verb: "edit",
    input: saveSiteContentSchema,
    handler: ({ actor, input }) => saveSiteContent(db, actor, input),
  }),
  uploadImage: def({
    module: "events",
    verb: "edit",
    input: uploadImageFormSchema,
    handler: ({ actor, input }) =>
      replaceSiteImage(db, actor, { eventId: input.eventId, slot: input.slot }, input.file),
  }),
  removeImage: def({
    module: "events",
    verb: "edit",
    input: siteImageSchema,
    handler: ({ actor, input }) => removeSiteImage(db, actor, input),
  }),
};
