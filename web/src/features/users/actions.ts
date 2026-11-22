"use server";

import { defineAction } from "@/lib/action";
import { selfActionDefs, userActionDefs } from "./action-defs";
import {
  createUserSchema,
  resetPasswordSchema,
  setPermissionsSchema,
  setUserActiveSchema,
  updateUserSchema,
} from "./schemas";
import { createUser, resetUserPassword, setUserActive, setUserPermissions, updateUser } from "./service";
import { defineSelfAction } from "./self-action";

export const createUserAction = defineAction({
  module: "users",
  verb: "create",
  input: createUserSchema,
  handler: ({ actor, input, db }) => createUser(db, actor, input),
});

export const updateUserAction = defineAction({
  module: "users",
  verb: "edit",
  input: updateUserSchema,
  handler: ({ actor, input, db }) => updateUser(db, actor, input),
});

export const setUserActiveAction = defineAction({
  module: "users",
  verb: "edit",
  input: setUserActiveSchema,
  handler: ({ actor, input, db }) => setUserActive(db, actor, input),
});

export const resetPasswordAction = defineAction({
  module: "users",
  verb: "edit",
  input: resetPasswordSchema,
  handler: ({ actor, input, db }) => resetUserPassword(db, actor, input),
});

export const setPermissionsAction = defineAction({
  module: "users",
  verb: "edit",
  input: setPermissionsSchema,
  handler: ({ actor, input, db }) => setUserPermissions(db, actor, input),
});

export const deleteUserAction = defineAction(userActionDefs.deleteUser);

export const setOwnAvatarAction = defineSelfAction(selfActionDefs.setOwnAvatar);
