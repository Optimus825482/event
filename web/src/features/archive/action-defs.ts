import type { z } from "zod";
import { db } from "@/db/client";
import type { ActionOptions } from "@/lib/action";
import { rebuildArchiveSchema } from "./schemas";
import { rebuildArchive } from "./service";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/** `defineAction` seçenekleri; `actions.ts` bunları sarmalar, testler aynı tanımları oturumsuz çalıştırır. */
export const archiveActionDefs = {
  rebuild: def({
    module: "archive",
    verb: "edit",
    input: rebuildArchiveSchema,
    handler: async ({ actor, input }) => rebuildArchive(db, actor, input),
  }),
};
