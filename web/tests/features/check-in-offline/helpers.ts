import type { CheckInSuccess } from "@/features/check-in/internal";
import { createItem, type QueueItem } from "@/features/check-in/offline/queue-core";

export const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const OTHER_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const EVENT_ID = "11111111-1111-4111-8111-111111111111";

let counter = 0;
export function uuid(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
}

export function item(overrides: { now?: number; token?: string; key?: string; ownerId?: string; eventEndsAt?: string } = {}): QueueItem {
  return createItem({
    idempotencyKey: overrides.key ?? uuid(),
    ownerId: overrides.ownerId ?? USER_ID,
    eventId: EVENT_ID,
    target: { token: overrides.token ?? "a.b" },
    clientTimestamp: new Date(overrides.now ?? 1_000).toISOString(),
    now: overrides.now ?? 1_000,
    eventEndsAt: overrides.eventEndsAt,
  });
}

export function walkInItem(walkIn: { tableId: string; guestName: string; guestCount: number; guestPhone?: string }): QueueItem {
  return createItem({
    idempotencyKey: uuid(),
    ownerId: USER_ID,
    eventId: EVENT_ID,
    target: { walkIn },
    clientTimestamp: new Date(1_000).toISOString(),
    now: 1_000,
  });
}

export function success(reservationId = "r1", outcome: CheckInSuccess["outcome"] = "checked_in"): CheckInSuccess {
  return {
    outcome,
    kind: "reservation",
    reservationId,
    ticketId: null,
    pnr: null,
    gate: null,
    eventId: EVENT_ID,
    guestName: "Ayşe",
    guestCount: 2,
    tableId: "t1",
    tableLabel: "A1",
    seatNo: null,
    checkedInAt: new Date(1_000).toISOString(),
    checkedInBy: null,
  };
}

export function ticketItem(overrides: { ticketId: string; gate?: number | null; key?: string }): QueueItem {
  return createItem({
    idempotencyKey: overrides.key ?? uuid(),
    ownerId: USER_ID,
    eventId: EVENT_ID,
    target: { ticketId: overrides.ticketId },
    clientTimestamp: new Date(1_000).toISOString(),
    now: 1_000,
    gate: overrides.gate ?? null,
  });
}
