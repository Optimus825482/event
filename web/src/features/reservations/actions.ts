"use server";

import { defineAction } from "@/lib/action";
import { reservationActionDefs } from "./action-defs";

export const createReservationAction = defineAction(reservationActionDefs.create);
export const updateReservationAction = defineAction(reservationActionDefs.update);
export const changeReservationStatusAction = defineAction(reservationActionDefs.changeStatus);
export const cancelReservationAction = defineAction(reservationActionDefs.cancel);
export const markNoShowsAction = defineAction(reservationActionDefs.markNoShows);
export const bulkCancelReservationsAction = defineAction(reservationActionDefs.bulkCancel);
