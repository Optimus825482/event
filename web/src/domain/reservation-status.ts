export const RESERVATION_STATUSES = ["pending", "confirmed", "checked_in", "cancelled", "no_show"] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const ACTIVE_RESERVATION_STATUSES = ["pending", "confirmed", "checked_in"] as const;

const RESERVATION_TRANSITIONS: Readonly<Record<ReservationStatus, readonly ReservationStatus[]>> = {
  pending: ["confirmed", "cancelled", "no_show", "checked_in"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: [],
  cancelled: ["confirmed"],
  no_show: ["checked_in"],
};

export function canTransitionReservation(from: ReservationStatus, to: ReservationStatus): boolean {
  return RESERVATION_TRANSITIONS[from].includes(to);
}
