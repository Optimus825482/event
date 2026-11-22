"use server";

import { defineAction } from "@/lib/action";
import { importActionDefs } from "./action-defs";

export const previewReservationImportAction = defineAction(importActionDefs.previewReservations);
export const importReservationsAction = defineAction(importActionDefs.importReservations);
export const previewAssignmentImportAction = defineAction(importActionDefs.previewAssignments);
export const importAssignmentsAction = defineAction(importActionDefs.importAssignments);
