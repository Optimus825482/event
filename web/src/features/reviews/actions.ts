"use server";

import { defineAction } from "@/lib/action";
import { reviewActionDefs } from "./action-defs";
import { shortReviewActionDefs } from "./short-review-action-defs";

export const saveReviewAction = defineAction(reviewActionDefs.save);
export const saveShortReviewAction = defineAction(shortReviewActionDefs.save);
export const completeReviewAction = defineAction(reviewActionDefs.complete);
export const completeAllReviewsAction = defineAction(reviewActionDefs.completeAll);
