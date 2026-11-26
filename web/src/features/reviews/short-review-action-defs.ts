import type { z } from "zod";
import { db } from "@/db/client";
import type { Actor } from "@/features/auth/session";
import type { ActionOptions } from "@/lib/action";
import { saveShortReview } from "./short-review-service";
import { shortReviewSchema } from "./short-form";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/** `action-defs.ts` ile aynı kapı kaynağı: aktörün kendisi değerlendirici olarak verilir; asıl denetim serviste (`assertCanReview`). */
const RESOURCE = ({ actor }: { actor: Actor }) => (actor.staffId ? { reviewerStaffIds: [actor.staffId] } : {});

export const shortReviewActionDefs = {
  save: def({
    module: "reviews",
    verb: "view",
    resource: RESOURCE,
    input: shortReviewSchema,
    handler: async ({ actor, input }) => {
      const review = await saveShortReview(db, actor, input);
      return { id: review.id, score: review.score, band: review.rating, updatedAt: review.updatedAt.toISOString() };
    },
  }),
};
