"use server";

import { z } from "zod";
import { DomainError, defineAction } from "@/lib/action";
import { ImageRejectedError } from "@/features/uploads/images";
import { replaceLogo } from "./logo";
import { updateSettingsSchema } from "./schemas";
import { updateSettings } from "./service";

export const updateSettingsAction = defineAction({
  module: "settings",
  verb: "edit",
  input: updateSettingsSchema,
  handler: ({ actor, input, db }) => updateSettings(db, actor, input),
});

const logoFormSchema = z
  .instanceof(FormData, { message: "Form verisi gerekli" })
  .transform((form) => form.get("file"))
  .pipe(z.instanceof(File, { message: "Bir görüntü dosyası seçin" }));

export const uploadLogoAction = defineAction({
  module: "settings",
  verb: "edit",
  input: logoFormSchema,
  handler: async ({ actor, input, db }) => {
    try {
      return await replaceLogo(db, actor, input);
    } catch (error) {
      if (error instanceof ImageRejectedError) throw new DomainError("conflict", error.message);
      throw error;
    }
  },
});
