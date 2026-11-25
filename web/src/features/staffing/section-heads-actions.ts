"use server";

import { defineAction } from "@/lib/action";
import { sectionHeadActionDefs } from "./section-heads-action-defs";

export const setSectionHeadsAction = defineAction(sectionHeadActionDefs.set);
