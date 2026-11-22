import type { z } from "zod";
import { db } from "@/db/client";
import type { ActionOptions } from "@/lib/action";
import { publishNotifications } from "./publish";
import { createNotificationSchema, markAllReadSchema, markReadSchema } from "./schemas";
import { createNotification, markAllNotificationsRead, markNotificationRead } from "./service";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/** `defineAction` seçenekleri; testler aynı tanımları oturumsuz `createAction` ile çalıştırır. */
export const notificationActionDefs = {
  create: def({
    module: "notifications",
    verb: "create",
    input: createNotificationSchema,
    handler: async ({ actor, input }) => {
      const row = await createNotification(db, actor, input);
      await publishNotifications([row]);
      return { id: row.id };
    },
  }),
  markRead: def({
    module: "notifications",
    verb: "view",
    input: markReadSchema,
    handler: async ({ actor, input }) => markNotificationRead(db, actor, input),
  }),
  markAllRead: def({
    module: "notifications",
    verb: "view",
    input: markAllReadSchema,
    handler: async ({ actor }) => markAllNotificationsRead(db, actor),
  }),
};
