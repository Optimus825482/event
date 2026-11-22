import type { z } from "zod";
import type { ActionOptions } from "@/lib/action";
import {
  bulkCancelReservationsInput,
  changeReservationStatusInput,
  createReservationInput,
  eventIdInput,
  reservationIdInput,
  updateReservationInput,
} from "./schemas";
import {
  cancelReservation,
  cancelReservations,
  changeReservationStatus,
  createReservation,
  markNoShows,
  updateReservation,
} from "./service";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/**
 * `defineAction` seçenekleri (`actions.ts` bunları sarar; testler aynı tanımları `createAction` ile çalıştırır).
 * Modül izni `defineAction` içinde; etkinlik sahipliği servis içinde uygulanır.
 */
export const reservationActionDefs = {
  create: def({
    module: "reservations",
    verb: "create",
    input: createReservationInput,
    handler: async ({ actor, input, db }) => {
      const row = await createReservation(db, actor, input);
      return { id: row.id, eventId: row.eventId };
    },
  }),
  update: def({
    module: "reservations",
    verb: "edit",
    input: updateReservationInput,
    handler: async ({ actor, input, db }) => {
      const row = await updateReservation(db, actor, input);
      return { id: row.id, tableId: row.tableId, guestCount: row.guestCount };
    },
  }),
  changeStatus: def({
    module: "reservations",
    verb: "edit",
    input: changeReservationStatusInput,
    handler: async ({ actor, input, db }) => {
      const row = await changeReservationStatus(db, actor, input);
      return { id: row.id, status: row.status };
    },
  }),
  cancel: def({
    module: "reservations",
    verb: "edit",
    input: reservationIdInput,
    handler: async ({ actor, input, db }) => {
      const row = await cancelReservation(db, actor, input);
      return { id: row.id, status: row.status };
    },
  }),
  bulkCancel: def({
    module: "reservations",
    verb: "edit",
    input: bulkCancelReservationsInput,
    handler: async ({ actor, input, db }) => cancelReservations(db, actor, input),
  }),
  markNoShows: def({
    module: "reservations",
    verb: "edit",
    input: eventIdInput,
    handler: async ({ actor, input, db }) => markNoShows(db, actor, input),
  }),
};
