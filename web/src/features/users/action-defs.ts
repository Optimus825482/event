import type { z } from "zod";
import type { ActionOptions } from "@/lib/action";
import { setOwnAvatar } from "./profile";
import { deleteUserSchema, setOwnAvatarSchema } from "./schemas";
import { selfDef } from "./self-action";
import { deleteUser } from "./service";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/** `defineAction` seçenekleri; gerçek action'lar `actions.ts` içinde, testler `createAction` ile çalıştırır. */
export const userActionDefs = {
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
};
