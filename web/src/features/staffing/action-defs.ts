import type { z } from "zod";
import type { ActionOptions } from "@/lib/action";
import { autoAssign, saveAssignments } from "./assignments-service";
import { saveExtraStaff } from "./extra-staff-service";
import { assignTeamToGroup, saveTableGroups } from "./groups-service";
import { saveOrganization } from "./organization-service";
import {
  applyTemplateSchema,
  assignTeamToGroupSchema,
  autoAssignSchema,
  createTemplateSchema,
  deleteTemplateSchema,
  saveAssignmentsSchema,
  saveExtraStaffSchema,
  saveOrganizationSchema,
  saveTableGroupsSchema,
  saveTeamsSchema,
} from "./schemas";
import { saveTeams } from "./teams-service";
import { applyOrganizationTemplate, createOrganizationTemplate, deleteOrganizationTemplate } from "./templates-service";

/** Seçenek nesnesine bağlam türlerini verir (handler parametreleri çıkarılır). */
function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/**
 * `defineAction` seçenekleri. Gerçek action'lar `actions.ts` içinde bunlarla tanımlanır;
 * testler aynı tanımları oturumsuz `createAction` ile çalıştırır. Organizatör sahipliği ve
 * etkinlik kilidi servis katmanındadır.
 */
export const staffingActionDefs = {
  saveTeams: def({
    module: "events",
    verb: "edit",
    input: saveTeamsSchema,
    handler: async ({ actor, input, db }) => saveTeams(db, actor, input),
  }),
  saveTableGroups: def({
    module: "events",
    verb: "edit",
    input: saveTableGroupsSchema,
    handler: async ({ actor, input, db }) => saveTableGroups(db, actor, input),
  }),
  assignTeamToGroup: def({
    module: "events",
    verb: "edit",
    input: assignTeamToGroupSchema,
    handler: async ({ actor, input, db }) => assignTeamToGroup(db, actor, input),
  }),
  saveAssignments: def({
    module: "events",
    verb: "edit",
    input: saveAssignmentsSchema,
    handler: async ({ actor, input, db }) => saveAssignments(db, actor, input),
  }),
  autoAssign: def({
    module: "events",
    verb: "edit",
    input: autoAssignSchema,
    handler: async ({ actor, input, db }) => autoAssign(db, actor, input),
  }),
  saveExtraStaff: def({
    module: "events",
    verb: "edit",
    input: saveExtraStaffSchema,
    handler: async ({ actor, input, db }) => saveExtraStaff(db, actor, input),
  }),
  saveOrganization: def({
    module: "events",
    verb: "edit",
    input: saveOrganizationSchema,
    handler: async ({ actor, input, db }) => saveOrganization(db, actor, input),
  }),
  createTemplate: def({
    module: "events",
    verb: "create",
    input: createTemplateSchema,
    handler: async ({ actor, input, db }) => createOrganizationTemplate(db, actor, input),
  }),
  applyTemplate: def({
    module: "events",
    verb: "edit",
    input: applyTemplateSchema,
    handler: async ({ actor, input, db }) => applyOrganizationTemplate(db, actor, input),
  }),
  deleteTemplate: def({
    module: "events",
    verb: "delete",
    input: deleteTemplateSchema,
    handler: async ({ actor, input, db }) => deleteOrganizationTemplate(db, actor, input),
  }),
};
