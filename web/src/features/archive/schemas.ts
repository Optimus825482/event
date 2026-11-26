import { z } from "zod";

export const rebuildArchiveSchema = z.object({
  eventId: z.uuid("Geçersiz etkinlik"),
});

export type RebuildArchiveInput = z.infer<typeof rebuildArchiveSchema>;
