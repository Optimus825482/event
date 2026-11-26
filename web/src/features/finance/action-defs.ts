import { z } from "zod";
import { db } from "@/db/client";
import type { ActionOptions } from "@/lib/action";
import { createFinanceItem, deleteFinanceItem, updateFinanceItem } from "./items-service";
import { saveFinancePlan } from "./plan-service";
import { coefficientsSchema, finalPricesSchema } from "./price-schemas";
import { saveCoefficients, saveFinalPrices } from "./price-service";
import { computeRecommendation } from "./recommendation-service";
import { createFinanceItemSchema, deleteFinanceItemSchema, financePlanSchema, updateFinanceItemSchema } from "./schemas";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

const eventIdSchema = z.object({ eventId: z.uuid("Geçersiz etkinlik") });

/** `defineAction` seçenekleri; `actions.ts` bunları sarmalar, testler aynı tanımları oturumsuz çalıştırır. */
export const financeActionDefs = {
  createItem: def({
    module: "finance",
    verb: "create",
    input: createFinanceItemSchema,
    handler: async ({ actor, input }) => {
      const row = await createFinanceItem(db, actor, input);
      return { id: row.id };
    },
  }),
  updateItem: def({
    module: "finance",
    verb: "edit",
    input: updateFinanceItemSchema,
    handler: async ({ actor, input }) => {
      const row = await updateFinanceItem(db, actor, input);
      return { id: row.id };
    },
  }),
  deleteItem: def({
    module: "finance",
    verb: "delete",
    input: deleteFinanceItemSchema,
    handler: async ({ actor, input }) => {
      const { id } = await deleteFinanceItem(db, actor, input);
      return { id };
    },
  }),
  savePlan: def({
    module: "finance",
    verb: "edit",
    input: financePlanSchema,
    handler: async ({ actor, input }) => {
      await saveFinancePlan(db, actor, input);
      return { eventId: input.eventId };
    },
  }),
  saveCoefficients: def({
    module: "finance",
    verb: "edit",
    input: coefficientsSchema,
    handler: async ({ actor, input }) => {
      await saveCoefficients(db, actor, input);
      return { eventId: input.eventId };
    },
  }),
  computeRecommendation: def({
    module: "finance",
    verb: "edit",
    input: eventIdSchema,
    handler: async ({ actor, input }) => computeRecommendation(db, actor, input),
  }),
  saveFinalPrices: def({
    module: "finance",
    verb: "edit",
    input: finalPricesSchema,
    handler: async ({ actor, input }) => {
      await saveFinalPrices(db, actor, input);
      return { eventId: input.eventId };
    },
  }),
};
