"use server";

import { defineAction } from "@/lib/action";
import { securityActionDefs } from "./security-action-defs";

export const revokeSessionAction = defineAction(securityActionDefs.revokeSession);

export const revokeOtherSessionsAction = defineAction(securityActionDefs.revokeOtherSessions);

export const clearLockoutAction = defineAction(securityActionDefs.clearLockout);
