"use server";

import { defineAction } from "@/lib/action";
import { venueActionDefs } from "./action-defs";

export const saveLayoutAction = defineAction(venueActionDefs.saveLayout);
export const applyVenueTemplateAction = defineAction(venueActionDefs.applyTemplate);
export const saveAsTemplateAction = defineAction(venueActionDefs.saveAsTemplate);
export const updateVenueTemplateAction = defineAction(venueActionDefs.updateTemplate);
export const deleteVenueTemplateAction = defineAction(venueActionDefs.deleteTemplate);
export const duplicateVenueTemplateAction = defineAction(venueActionDefs.duplicateTemplate);
export const createTableTypeAction = defineAction(venueActionDefs.createTableType);
export const updateTableTypeAction = defineAction(venueActionDefs.updateTableType);
export const deleteTableTypeAction = defineAction(venueActionDefs.deleteTableType);
