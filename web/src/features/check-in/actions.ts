"use server";

import { defineAction } from "@/lib/action";
import { checkInActionDefs } from "./action-defs";

export const checkInAction = defineAction(checkInActionDefs.checkIn);
export const registerWalkInAction = defineAction(checkInActionDefs.walkIn);
export const updateGuestCountAction = defineAction(checkInActionDefs.updateGuestCount);
export const eventStatsAction = defineAction(checkInActionDefs.stats);
export const searchGuestsAction = defineAction(checkInActionDefs.searchGuests);
export const recentCheckInsAction = defineAction(checkInActionDefs.recentCheckIns);
export const freeTablesAction = defineAction(checkInActionDefs.freeTables);
