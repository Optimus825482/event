"use server";

import { defineAction } from "@/lib/action";
import { notificationActionDefs } from "./action-defs";

export const createNotificationAction = defineAction(notificationActionDefs.create);
export const markNotificationReadAction = defineAction(notificationActionDefs.markRead);
export const markAllNotificationsReadAction = defineAction(notificationActionDefs.markAllRead);
