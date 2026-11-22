"use server";

import { defineAction } from "@/lib/action";
import { setStaffStatusSchema, idSchema, staffInputSchema, updateStaffSchema } from "../schemas";
import * as service from "../service";

export const createStaff = defineAction({
  module: "staff",
  verb: "create",
  input: staffInputSchema,
  handler: ({ db, actor, input }) => service.createStaff(db, actor, input),
});

export const updateStaff = defineAction({
  module: "staff",
  verb: "edit",
  input: updateStaffSchema,
  handler: ({ db, actor, input }) => service.updateStaff(db, actor, input),
});

export const setStaffStatus = defineAction({
  module: "staff",
  verb: "edit",
  input: setStaffStatusSchema,
  handler: ({ db, actor, input }) => service.setStaffStatus(db, actor, input),
});

export const deleteStaff = defineAction({
  module: "staff",
  verb: "delete",
  input: idSchema,
  handler: ({ db, actor, input }) => service.deleteStaff(db, actor, input),
});
