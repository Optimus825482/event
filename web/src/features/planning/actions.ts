"use server";

import { defineAction } from "@/lib/action";
import { planningActionDefs } from "./action-defs";

export const transitionStageAction = defineAction(planningActionDefs.transition);
