"use server";

import { defineAction } from "@/lib/action";
import { archiveActionDefs } from "./action-defs";

export const rebuildArchiveAction = defineAction(archiveActionDefs.rebuild);
