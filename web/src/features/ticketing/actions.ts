"use server";

import { defineAction } from "@/lib/action";
import { ticketingActionDefs } from "./action-defs";

export const resendOrderEmailAction = defineAction(ticketingActionDefs.resendEmail);
export const ordersOverviewAction = defineAction(ticketingActionDefs.overview);
