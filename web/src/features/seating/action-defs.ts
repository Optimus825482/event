import { z } from "zod";
import { db } from "@/db/client";
import { publishNotifications } from "@/features/notifications/publish";
import type { ActionOptions } from "@/lib/action";
import { allocateToCasino, releaseFromCasino, setSaleAllocation } from "./allocation-service";
import { classifyTables } from "./classification-service";
import { allocationInputSchema, classifyTablesSchema, saleAllocationSchema, saleSettingsSchema } from "./schemas";
import { getSeatingOverview } from "./queries";
import { saveSaleSettings } from "./settings-service";

const overviewInput = z.object({ eventId: z.uuid("Geçersiz etkinlik") });

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
  allocateToCasino: def({
    module: "reservations",
    verb: "edit",
    input: allocationInputSchema,
    handler: async ({ actor, input }) => allocateToCasino(db, actor, input),
  }),
  /** Bildirim satırı işlem bittikten sonra yayılır; reddedilen istekte bildirim yoktur. */
  releaseFromCasino: def({
    module: "reservations",
    verb: "edit",
    input: allocationInputSchema,
    handler: async ({ actor, input }) => {
      const { updated, notification } = await releaseFromCasino(db, actor, input);
      if (notification) await publishNotifications([notification]);
      return { updated };
    },
  }),
  setSaleAllocation: def({
    module: "ticketing",
    verb: "edit",
    input: saleAllocationSchema,
    handler: async ({ actor, input }) => setSaleAllocation(db, actor, input),
  }),
  /** Entertainment ekranı: masa genel bakışı (`ticketing:view`). */
  overview: def({
    module: "ticketing",
    verb: "view",
    input: overviewInput,
    handler: async ({ actor, input }) => getSeatingOverview(db, actor, input.eventId),
  }),
  /** Casino ekranı: aynı genel bakış (`reservations:view`; Casino'nun `ticketing` izni yoktur). */
  casinoOverview: def({
    module: "reservations",
    verb: "view",
    input: overviewInput,
    handler: async ({ actor, input }) => getSeatingOverview(db, actor, input.eventId),
  }),
};
