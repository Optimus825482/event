"use server";

import { defineAction } from "@/lib/action";
import { eventActionDefs } from "./action-defs";

export const createEventAction = defineAction(eventActionDefs.create);
export const updateEventAction = defineAction(eventActionDefs.update);
export const changeEventStatusAction = defineAction(eventActionDefs.changeStatus);
export const deleteEventAction = defineAction(eventActionDefs.remove);
