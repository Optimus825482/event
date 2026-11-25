import type { z } from "zod";
import type { ActionOptions } from "@/lib/action";
import { setSectionHeads, setSectionHeadsSchema } from "./section-heads-service";

/** Seçenek nesnesine bağlam türlerini verir (handler parametreleri çıkarılır). */
function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/** Kısım sorumlusu atamasının `defineAction` seçenekleri; testler aynı tanımları oturumsuz çalıştırır. */
export const sectionHeadActionDefs = {
  set: def({
    module: "staff",
    verb: "edit",
    input: setSectionHeadsSchema,
    handler: async ({ actor, input, db }) => setSectionHeads(db, actor, input),
  }),
};
