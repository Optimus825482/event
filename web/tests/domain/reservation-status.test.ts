import { describe, expect, it } from "vitest";
import {
  ACTIVE_RESERVATION_STATUSES,
  canTransitionReservation,
  RESERVATION_STATUSES,
  type ReservationStatus,
} from "@/domain/reservation-status";

// Her satır: [from, to, beklenen]. 5x5 = 25 çiftin tamamı, elle yazılmış.
const TABLE: ReadonlyArray<readonly [ReservationStatus, ReservationStatus, boolean]> = [
  ["pending", "pending", false],
  ["pending", "confirmed", true],
  ["pending", "checked_in", true],
  ["pending", "cancelled", true],
  ["pending", "no_show", true],
  ["confirmed", "pending", false],
  ["confirmed", "confirmed", false],
  ["confirmed", "checked_in", true],
  ["confirmed", "cancelled", true],
  ["confirmed", "no_show", true],
  ["checked_in", "pending", false],
  ["checked_in", "confirmed", false],
  ["checked_in", "checked_in", false],
  ["checked_in", "cancelled", false],
  ["checked_in", "no_show", false],
  ["cancelled", "pending", false],
  ["cancelled", "confirmed", true],
  ["cancelled", "checked_in", false],
  ["cancelled", "cancelled", false],
  ["cancelled", "no_show", false],
  ["no_show", "pending", false],
  ["no_show", "confirmed", false],
  ["no_show", "checked_in", true],
  ["no_show", "cancelled", false],
  ["no_show", "no_show", false],
];

describe("reservation-status", () => {
  it("RESERVATION_STATUSES sabit listesi doğru", () => {
    expect(RESERVATION_STATUSES).toEqual(["pending", "confirmed", "checked_in", "cancelled", "no_show"]);
  });

  it("ACTIVE_RESERVATION_STATUSES sabit listesi doğru", () => {
    expect(ACTIVE_RESERVATION_STATUSES).toEqual(["pending", "confirmed", "checked_in"]);
  });

  it("tablo 25 çift içerir", () => {
    expect(TABLE).toHaveLength(25);
  });

  it.each(TABLE)("canTransitionReservation(%s, %s) === %s", (from, to, expected) => {
    expect(canTransitionReservation(from, to)).toBe(expected);
  });

  it("no_show → checked_in izinli", () => {
    expect(canTransitionReservation("no_show", "checked_in")).toBe(true);
  });

  it("checked_in → cancelled izinli değil", () => {
    expect(canTransitionReservation("checked_in", "cancelled")).toBe(false);
  });

  it("aynı duruma geçiş her zaman false", () => {
    for (const status of RESERVATION_STATUSES) {
      expect(canTransitionReservation(status, status)).toBe(false);
    }
  });
});
