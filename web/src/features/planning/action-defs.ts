import type { z } from "zod";
import { db } from "@/db/client";
import { publishNotifications } from "@/features/notifications/publish";
import type { ActionOptions } from "@/lib/action";
import { stageTransitionSchema } from "./schemas";
import { transitionStage } from "./stage-service";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

export const planningActionDefs = {
  /**
   * Kapı yalnızca ortak gereksinimi (`events:view`) arar; asıl yetki (aşamaya göre modülün `edit`
   * fiili) serviste, kilitli satırın güncel aşamasına göre denetlenir.
   */
  transition: def({
    module: "events",
    verb: "view",
    input: stageTransitionSchema,
    handler: async ({ actor, input }) => {
      const { eventId, stage, notification } = await transitionStage(db, actor, input);
      await publishNotifications([notification]);
      return { eventId, stage };
    },
  }),
};
