"use server";

import { defineAction } from "@/lib/action";
import { deleteDemoDataDef, resetDemoDataDef, setSalesDemoDef } from "./action-defs";

export const setSalesDemoAction = defineAction(setSalesDemoDef);
export const resetDemoDataAction = defineAction(resetDemoDataDef);
export const deleteDemoDataAction = defineAction(deleteDemoDataDef);
