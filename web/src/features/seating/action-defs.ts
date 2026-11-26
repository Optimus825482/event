import type { z } from "zod";
import { db } from "@/db/client";
import type { ActionOptions } from "@/lib/action";
import { classifyTables } from "./classification-service";
import { classifyTablesSchema, saleSettingsSchema } from "./schemas";
import { saveSaleSettings } from "./settings-service";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/** `defineAction` seçenekleri; `actions.ts` bunları sarmalar, testler aynı tanımları oturumsuz çalıştırır. */
export const seatingActionDefs = {
  saveSettings: def({
    module: "ticketing",
    verb: "edit",
    input: saleSettingsSchema,
    handler: async ({ actor, input }) => saveSaleSettings(db, actor, input),
  }),
  classify: def({
    module: "ticketing",
    verb: "edit",
    input: classifyTablesSchema,
    handler: async ({ actor, input }) => classifyTables(db, actor, input),
  }),
};
