"use server";

import { defineAction } from "@/lib/action";
import { seatingActionDefs } from "./action-defs";

export const saveSaleSettingsAction = defineAction(seatingActionDefs.saveSettings);
export const classifyTablesAction = defineAction(seatingActionDefs.classify);
export const allocateToCasinoAction = defineAction(seatingActionDefs.allocateToCasino);
export const releaseFromCasinoAction = defineAction(seatingActionDefs.releaseFromCasino);
export const setSaleAllocationAction = defineAction(seatingActionDefs.setSaleAllocation);
