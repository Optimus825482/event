"use server";

import { defineAction } from "@/lib/action";
import { staffingActionDefs } from "./action-defs";

export const saveTeamsAction = defineAction(staffingActionDefs.saveTeams);
export const saveTableGroupsAction = defineAction(staffingActionDefs.saveTableGroups);
export const assignTeamToGroupAction = defineAction(staffingActionDefs.assignTeamToGroup);
export const groupUngroupedLocasAction = defineAction(staffingActionDefs.groupUngroupedLocas);
export const saveAssignmentsAction = defineAction(staffingActionDefs.saveAssignments);
export const autoAssignAction = defineAction(staffingActionDefs.autoAssign);
export const saveExtraStaffAction = defineAction(staffingActionDefs.saveExtraStaff);
export const saveOrganizationAction = defineAction(staffingActionDefs.saveOrganization);
export const createTemplateAction = defineAction(staffingActionDefs.createTemplate);
export const applyTemplateAction = defineAction(staffingActionDefs.applyTemplate);
export const deleteTemplateAction = defineAction(staffingActionDefs.deleteTemplate);
