import type { z } from "zod";
import type { ActionOptions } from "@/lib/action";
import { currentSessionId } from "./current-session";
import { changeOwnPassword } from "./own-password";
import { setOwnAvatar } from "./profile";
import { changeOwnPasswordSchema, deleteUserSchema, setMembershipsSchema, setOwnAvatarSchema } from "./schemas";
import { selfDef } from "./self-action";
import { deleteUser, setUserMemberships } from "./service";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/** `defineAction` seçenekleri; gerçek action'lar `actions.ts` içinde, testler `createAction` ile çalıştırır. */
export const userActionDefs = {
  setUserMemberships: def({
    module: "users",
    verb: "edit",
    input: setMembershipsSchema,
    handler: ({ actor, input, db }) => setUserMemberships(db, actor, input),
  }),
  deleteUser: def({
    module: "users",
    verb: "delete",
    input: deleteUserSchema,
    handler: ({ actor, input, db }) => deleteUser(db, actor, input),
  }),
};

/** Kendi hesabı eylemleri (`defineSelfAction`): modül izni gerekmez, servis yalnızca `actor.id` satırına yazar. */
export const selfActionDefs = {
  setOwnAvatar: selfDef({
    scope: "avatar",
    input: setOwnAvatarSchema,
    handler: ({ actor, input, db }) => setOwnAvatar(db, actor, input),
  }),
  changeOwnPassword: selfDef({
    scope: "password",
    input: changeOwnPasswordSchema,
    handler: async ({ actor, input, db }) => changeOwnPassword(db, actor, input, await currentSessionId()),
  }),
};
