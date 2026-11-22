"use server";

import { defineAction } from "@/lib/action";
import {
  departmentInputSchema,
  idSchema,
  positionInputSchema,
  updateDepartmentSchema,
  updatePositionSchema,
  updateWorkLocationSchema,
  workLocationInputSchema,
} from "../schemas";
import * as service from "../catalog-service";

export const createDepartment = defineAction({
  module: "staff",
  verb: "create",
  input: departmentInputSchema,
  handler: ({ db, actor, input }) => service.createDepartment(db, actor, input),
});

export const updateDepartment = defineAction({
  module: "staff",
  verb: "edit",
  input: updateDepartmentSchema,
  handler: ({ db, actor, input }) => service.updateDepartment(db, actor, input),
});

export const deleteDepartment = defineAction({
  module: "staff",
  verb: "delete",
  input: idSchema,
  handler: ({ db, actor, input }) => service.deleteDepartment(db, actor, input),
});

export const createPosition = defineAction({
  module: "staff",
  verb: "create",
  input: positionInputSchema,
  handler: ({ db, actor, input }) => service.createPosition(db, actor, input),
});

export const updatePosition = defineAction({
  module: "staff",
  verb: "edit",
  input: updatePositionSchema,
  handler: ({ db, actor, input }) => service.updatePosition(db, actor, input),
});

export const deletePosition = defineAction({
  module: "staff",
  verb: "delete",
  input: idSchema,
  handler: ({ db, actor, input }) => service.deletePosition(db, actor, input),
});

export const createWorkLocation = defineAction({
  module: "staff",
  verb: "create",
  input: workLocationInputSchema,
  handler: ({ db, actor, input }) => service.createWorkLocation(db, actor, input),
});

export const updateWorkLocation = defineAction({
  module: "staff",
  verb: "edit",
  input: updateWorkLocationSchema,
  handler: ({ db, actor, input }) => service.updateWorkLocation(db, actor, input),
});

export const deleteWorkLocation = defineAction({
  module: "staff",
  verb: "delete",
  input: idSchema,
  handler: ({ db, actor, input }) => service.deleteWorkLocation(db, actor, input),
});
