"use server";

import { defineAction } from "@/lib/action";
import { seatingActionDefs } from "./action-defs";

export const saveSaleSettingsAction = defineAction(seatingActionDefs.saveSettings);
export const setSaleModeAction = defineAction(seatingActionDefs.setSaleMode);
export const classifyTablesAction = defineAction(seatingActionDefs.classify);
export const allocateToCasinoAction = defineAction(seatingActionDefs.allocateToCasino);
export const releaseFromCasinoAction = defineAction(seatingActionDefs.releaseFromCasino);
export const setSaleAllocationAction = defineAction(seatingActionDefs.setSaleAllocation);
export const seatingOverviewAction = defineAction(seatingActionDefs.overview);
export const casinoOverviewAction = defineAction(seatingActionDefs.casinoOverview);
