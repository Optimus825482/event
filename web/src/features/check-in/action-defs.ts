import type { z } from "zod";
import { availableTables } from "@/features/reservations/read-service";
import type { ActionOptions } from "@/lib/action";
import {
  checkInInput,
  eventIdInput,
  findOrderInput,
  searchGuestsInput,
  updateGuestCountInput,
  walkInInput,
  walkInOnceInput,
} from "./schemas";
import { findOrderAtDoor } from "./order-lookup";
import {
  checkIn,
  eventStats,
  recentCheckIns,
  registerWalkIn,
  registerWalkInOnce,
  searchGuests,
  updateGuestCount,
} from "./service";

function def<S extends z.ZodType, T>(options: ActionOptions<S, T>): ActionOptions<S, T> {
  return options;
}

/**
 * `defineAction` seçenekleri: `actions.ts` bunları sarar, `POST /api/check-in` aynı tanımı
 * (aynı oturum → izin → Zod → servis sırasıyla) `createAction` üzerinden çalıştırır.
 * Kapı personeli (`controller`) yalnızca `check_in:view/create` iznine sahip olduğu için
 * walk-in ve kişi sayısı güncellemesi de `check_in:create` ister (spec §12).
 */
export const checkInActionDefs = {
  checkIn: def({
    module: "check_in",
    verb: "create",
    input: checkInInput,
    handler: async ({ actor, input, db }) => checkIn(db, actor, input),
  }),
  walkIn: def({
    module: "check_in",
    verb: "create",
    input: walkInInput,
    handler: async ({ actor, input, db }) => registerWalkIn(db, actor, input),
  }),
  walkInOnce: def({
    module: "check_in",
    verb: "create",
    input: walkInOnceInput,
    handler: async ({ actor, input, db }) => registerWalkInOnce(db, actor, input),
  }),
  updateGuestCount: def({
    module: "check_in",
    verb: "create",
    input: updateGuestCountInput,
    handler: async ({ actor, input, db }) => updateGuestCount(db, actor, input),
  }),
  stats: def({
    module: "check_in",
    verb: "view",
    input: eventIdInput,
    handler: async ({ actor, input, db }) => eventStats(db, actor, input.eventId),
  }),
  searchGuests: def({
    module: "check_in",
    verb: "view",
    input: searchGuestsInput,
    handler: async ({ actor, input, db }) => searchGuests(db, actor, input),
  }),
  findOrder: def({
    module: "check_in",
    verb: "view",
    input: findOrderInput,
    handler: async ({ actor, input, db }) => findOrderAtDoor(db, actor, input),
  }),
  recentCheckIns: def({
    module: "check_in",
    verb: "view",
    input: eventIdInput,
    handler: async ({ actor, input, db }) => recentCheckIns(db, actor, input.eventId),
  }),
  freeTables: def({
    module: "check_in",
    verb: "view",
    input: eventIdInput,
    handler: async ({ actor, input, db }) =>
      (await availableTables(db, actor, { eventId: input.eventId })).filter((t) => t.available),
  }),
};
