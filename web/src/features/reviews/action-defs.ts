import type { z } from "zod";
import { db } from "@/db/client";
import { publishNotifications } from "@/features/notifications/publish";
import { withPermissions } from "@/features/auth/permissions";
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
const RESOURCE = ({ actor }: { actor: Actor }) => (actor.staffId ? { teamLeaderStaffId: actor.staffId } : {});
const EDIT_GATE = { module: "reviews", verb: "edit", resource: RESOURCE } as const;
/**
 * Kaydetme yeni taslak (`create`) ya da güncelleme (`edit`) olabilir; hangisi olduğunu servis kayda
 * bakarak belirler. Kapı yalnızca ortak gereksinimi (`view`) arar, asıl fiil serviste izin
 * satırlarını taşıyan aktörle denetlenir.
 */
const SAVE_GATE = { module: "reviews", verb: "view", resource: RESOURCE } as const;

export const reviewActionDefs = {
  save: def({
    ...SAVE_GATE,
    input: saveReviewSchema,
    handler: async ({ actor, input }) => {
      const review = await saveReviewDraft(db, await withPermissions(actor), input);
      return { id: review.id, score: review.score, band: review.rating, updatedAt: review.updatedAt.toISOString() };
    },
  }),
  complete: def({
    ...EDIT_GATE,
    input: completeReviewSchema,
    handler: async ({ actor, input }) => {
      const { review, notification } = await completeReview(db, actor, input);
      await publishNotifications([notification]);
      return { id: review.id };
    },
  }),
  completeAll: def({
    ...EDIT_GATE,
    input: completeAllReviewsSchema,
    handler: async ({ actor, input }) => {
      const { completed, incomplete, skipped, notification } = await completeAllReviews(db, actor, input);
      if (notification) await publishNotifications([notification]);
      return { completed, incomplete, skipped };
    },
  }),
};
