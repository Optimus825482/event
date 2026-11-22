import type { z } from "zod";
import { db } from "@/db/client";
import { publishNotifications } from "@/features/notifications/publish";
import type { Actor } from "@/features/auth/session";
import type { ActionOptions } from "@/lib/action";
import { completeAllReviewsSchema, completeReviewSchema, saveReviewSchema } from "./schemas";
import { completeAllReviews, completeReview, saveReviewDraft } from "./service";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/**
 * Lider `reviews` modülünde yalnızca kendi ekibi için yetkilidir; eylem kapısında aktörün kendi
 * ekibi kaynak olarak verilir. Hedef personelin gerçekten o ekipte olduğu serviste denetlenir.
 */
const GATE = {
  module: "reviews",
  verb: "edit",
  resource: ({ actor }: { actor: Actor }) => (actor.staffId ? { teamLeaderStaffId: actor.staffId } : {}),
} as const;

export const reviewActionDefs = {
  save: def({
    ...GATE,
    input: saveReviewSchema,
    handler: async ({ actor, input }) => {
      const review = await saveReviewDraft(db, actor, input);
      return { id: review.id, score: review.score, band: review.rating, updatedAt: review.updatedAt.toISOString() };
    },
  }),
  complete: def({
    ...GATE,
    input: completeReviewSchema,
    handler: async ({ actor, input }) => {
      const { review, notification } = await completeReview(db, actor, input);
      await publishNotifications([notification]);
      return { id: review.id };
    },
  }),
  completeAll: def({
    ...GATE,
    input: completeAllReviewsSchema,
    handler: async ({ actor, input }) => {
      const { completed, incomplete, notification } = await completeAllReviews(db, actor, input);
      if (notification) await publishNotifications([notification]);
      return { completed, incomplete };
    },
  }),
};
