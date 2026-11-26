import { z } from "zod";
import { PLANNING_STAGES, STAGE_TRANSITION_KINDS } from "@/domain/planning-stage";

/** Aşama geçişi isteği. `expected`, istemcinin gördüğü aşamadır (eşzamanlı değişikliği yakalamak için). */
export const stageTransitionSchema = z
  .object({
    eventId: z.uuid("Geçersiz etkinlik"),
    expected: z.enum(PLANNING_STAGES, { error: "Geçersiz aşama" }),
    kind: z.enum(STAGE_TRANSITION_KINDS, { error: "Geçersiz geçiş" }),
    note: z.string().trim().max(500, "Gerekçe en fazla 500 karakter olabilir").optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "revert" && !value.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Geri alma nedeni gerekli" });
    }
  });

export type StageTransitionInput = z.infer<typeof stageTransitionSchema>;
