import type { z } from "zod";
import type { ActionOptions } from "@/lib/action";
import { currentSessionId } from "@/features/users/current-session";
import { clearLockoutSchema, revokeOtherSessionsSchema, revokeSessionSchema } from "./security-schemas";
import { clearLockout, revokeOtherSessions, revokeSession } from "./security-service";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/** `defineAction` seçenekleri; gerçek action'lar `security-actions.ts` içinde. */
export const securityActionDefs = {
  revokeSession: def({
    module: "settings",
    verb: "edit",
    input: revokeSessionSchema,
    handler: async ({ actor, input, db }) => revokeSession(db, actor, input, await currentSessionId()),
  }),
  revokeOtherSessions: def({
    module: "settings",
    verb: "edit",
    input: revokeOtherSessionsSchema,
    handler: async ({ actor, db }) => revokeOtherSessions(db, actor, await currentSessionId()),
  }),
  clearLockout: def({
    module: "settings",
    verb: "edit",
    input: clearLockoutSchema,
    handler: ({ actor, input, db }) => clearLockout(db, actor, input),
  }),
};
