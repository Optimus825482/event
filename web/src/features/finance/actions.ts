"use server";

import { defineAction } from "@/lib/action";
import { financeActionDefs } from "./action-defs";

export const createFinanceItemAction = defineAction(financeActionDefs.createItem);
export const updateFinanceItemAction = defineAction(financeActionDefs.updateItem);
export const deleteFinanceItemAction = defineAction(financeActionDefs.deleteItem);
export const saveFinancePlanAction = defineAction(financeActionDefs.savePlan);
export const saveCoefficientsAction = defineAction(financeActionDefs.saveCoefficients);
export const computeRecommendationAction = defineAction(financeActionDefs.computeRecommendation);
export const saveFinalPricesAction = defineAction(financeActionDefs.saveFinalPrices);
