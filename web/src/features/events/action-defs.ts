import type { z } from "zod";
import { db } from "@/db/client";
import type { ActionOptions } from "@/lib/action";
import {
  changeEventStatusSchema,
  createEventSchema,
  deleteEventSchema,
  reviewSettingsSchema,
  updateEventSchema,
} from "./schemas";
import { changeEventStatus, createEvent, deleteEvent, setReviewSettings, updateEvent } from "./service";

/** Seçenek nesnesine bağlam türlerini verir (handler parametreleri çıkarılır). */
function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/**
 * `defineAction` seçenekleri. Gerçek action'lar `actions.ts` içinde bunlarla tanımlanır;
 * testler aynı tanımları oturumsuz `createAction` ile çalıştırır.
 */
export const eventActionDefs = {
  create: def({
    module: "events",
    verb: "create",
    input: createEventSchema,
    handler: async ({ actor, input }) => {
      const event = await createEvent(db, actor, input);
      return { id: event.id };
    },
  }),
  update: def({
    module: "events",
    verb: "edit",
    input: updateEventSchema,
    handler: async ({ actor, input }) => {
      const event = await updateEvent(db, actor, input);
      return { id: event.id };
    },
  }),
  changeStatus: def({
    module: "events",
    verb: "edit",
    input: changeEventStatusSchema,
    handler: async ({ actor, input }) => {
      const event = await changeEventStatus(db, actor, input);
      return { id: event.id, status: event.status };
    },
  }),
  reviewSettings: def({
    module: "events",
    verb: "edit",
    input: reviewSettingsSchema,
    handler: async ({ actor, input }) => {
      const event = await setReviewSettings(db, actor, input);
      return { id: event.id, reviewEnabled: event.reviewEnabled, reviewHistoryVisible: event.reviewHistoryVisible };
    },
  }),
  remove: def({
    module: "events",
    verb: "delete",
    input: deleteEventSchema,
    handler: async ({ actor, input }) => deleteEvent(db, actor, input),
  }),
};
