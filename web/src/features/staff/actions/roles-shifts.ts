"use server";

import { defineAction } from "@/lib/action";
import {
  idSchema,
  shiftInputSchema,
  staffRoleInputSchema,
  updateShiftSchema,
  updateStaffRoleSchema,
} from "../schemas";
import * as service from "../role-shift-service";

export const createStaffRole = defineAction({
  module: "staff",
  verb: "create",
  input: staffRoleInputSchema,
  handler: ({ db, actor, input }) => service.createStaffRole(db, actor, input),
});

export const updateStaffRole = defineAction({
  module: "staff",
  verb: "edit",
  input: updateStaffRoleSchema,
  handler: ({ db, actor, input }) => service.updateStaffRole(db, actor, input),
});

export const deleteStaffRole = defineAction({
  module: "staff",
  verb: "delete",
  input: idSchema,
  handler: ({ db, actor, input }) => service.deleteStaffRole(db, actor, input),
});

export const createShift = defineAction({
  module: "staff",
  verb: "create",
  input: shiftInputSchema,
  handler: ({ db, actor, input }) => service.createShift(db, actor, input),
});

export const updateShift = defineAction({
  module: "staff",
  verb: "edit",
  input: updateShiftSchema,
  handler: ({ db, actor, input }) => service.updateShift(db, actor, input),
});

export const deleteShift = defineAction({
  module: "staff",
  verb: "delete",
  input: idSchema,
  handler: ({ db, actor, input }) => service.deleteShift(db, actor, input),
});
