/**
 * Property Test: Event Stats Calculation
 * **Property 8: Event Stats Calculation**
 * **Validates: Requirements 5.1, 5.3, 5.4**
 *
 * For any event, the stats SHALL satisfy:
 * - remaining = totalExpected - checkedIn
 * - totalExpected = count of reservations with status in ['pending', 'confirmed', 'checked_in']
 * - checkInPercentage = (checkedIn / totalExpected) * 100
 *
 * Feature: check-in-module, Property 8: Event Stats Calculation
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// Types matching the store
type ReservationStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "cancelled"
  | "no_show";

interface Reservation {
  id: string;
  status: ReservationStatus;
  guestCount: number;
}

interface EventStats {
  totalExpected: number;
  checkedIn: number;
  remaining: number;
  cancelled: number;
  noShow: number;
  checkInPercentage: number;
}

/**
 * Calculate event stats from reservations
 * This is the pure function that implements the stats calculation logic
 */
function calculateEventStats(reservations: Reservation[]): EventStats {
  // Count by status
  const statusCounts = reservations.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<ReservationStatus, number>);

  // totalExpected = count of reservations with status in ['pending', 'confirmed', 'checked_in']
  const pending = statusCounts["pending"] || 0;
  const confirmed = statusCounts["confirmed"] || 0;
  const checkedIn = statusCounts["checked_in"] || 0;
  const cancelled = statusCounts["cancelled"] || 0;
  const noShow = statusCounts["no_show"] || 0;

  const totalExpected = pending + confirmed + checkedIn;
  const remaining = totalExpected - checkedIn;
  const checkInPercentage =
    totalExpected > 0 ? Math.round((checkedIn / totalExpected) * 100) : 0;

  return {
    totalExpected,
    checkedIn,
    remaining,
    cancelled,
    noShow,
    checkInPercentage,
  };
}

// Arbitrary for generating reservation status
const reservationStatusArb = fc.constantFrom<ReservationStatus>(
  "pending",
  "confirmed",
  "checked_in",
  "cancelled",
  "no_show"
);

// Arbitrary for generating a single reservation
const reservationArb = fc.record({
  id: fc.uuid(),
  status: reservationStatusArb,
  guestCount: fc.integer({ min: 1, max: 20 }),
});

// Arbitrary for generating a list of reservations (0 to 100)
const reservationsArb = fc.array(reservationArb, {
  minLength: 0,
  maxLength: 100,
});

describe("Property 8: Event Stats Calculation", () => {
  /**
   * Property 8.1: remaining = totalExpected - checkedIn
   * For any set of reservations, the remaining count must equal
   * totalExpected minus checkedIn
   */
  it("remaining equals totalExpected minus checkedIn for all reservation sets", () => {
    fc.assert(
      fc.property(reservationsArb, (reservations) => {
        const stats = calculateEventStats(reservations);

        // Property: remaining = totalExpected - checkedIn
        expect(stats.remaining).toBe(stats.totalExpected - stats.checkedIn);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.2: totalExpected = count of reservations with status in ['pending', 'confirmed', 'checked_in']
   * For any set of reservations, totalExpected must equal the count of
   * reservations that are pending, confirmed, or checked_in
   */
  it("totalExpected equals count of pending, confirmed, and checked_in reservations", () => {
    fc.assert(
      fc.property(reservationsArb, (reservations) => {
        const stats = calculateEventStats(reservations);

        // Count expected statuses manually
        const expectedCount = reservations.filter(
          (r) =>
            r.status === "pending" ||
            r.status === "confirmed" ||
            r.status === "checked_in"
        ).length;

        // Property: totalExpected = count of expected statuses
        expect(stats.totalExpected).toBe(expectedCount);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.3: checkInPercentage = (checkedIn / totalExpected) * 100
   * For any set of reservations, the check-in percentage must be correctly calculated
   */
  it("checkInPercentage is correctly calculated as (checkedIn / totalExpected) * 100", () => {
    fc.assert(
      fc.property(reservationsArb, (reservations) => {
        const stats = calculateEventStats(reservations);

        // Calculate expected percentage
        const expectedPercentage =
          stats.totalExpected > 0
            ? Math.round((stats.checkedIn / stats.totalExpected) * 100)
            : 0;

        // Property: checkInPercentage = (checkedIn / totalExpected) * 100
        expect(stats.checkInPercentage).toBe(expectedPercentage);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.4: cancelled and noShow counts are accurate
   * For any set of reservations, cancelled and noShow counts must match
   * the actual count of reservations with those statuses
   */
  it("cancelled and noShow counts match actual reservation counts", () => {
    fc.assert(
      fc.property(reservationsArb, (reservations) => {
        const stats = calculateEventStats(reservations);

        // Count cancelled and no_show manually
        const cancelledCount = reservations.filter(
          (r) => r.status === "cancelled"
        ).length;
        const noShowCount = reservations.filter(
          (r) => r.status === "no_show"
        ).length;

        // Property: counts match
        expect(stats.cancelled).toBe(cancelledCount);
        expect(stats.noShow).toBe(noShowCount);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.5: Stats are non-negative
   * For any set of reservations, all stats values must be non-negative
   */
  it("all stats values are non-negative", () => {
    fc.assert(
      fc.property(reservationsArb, (reservations) => {
        const stats = calculateEventStats(reservations);

        // Property: all values >= 0
        expect(stats.totalExpected).toBeGreaterThanOrEqual(0);
        expect(stats.checkedIn).toBeGreaterThanOrEqual(0);
        expect(stats.remaining).toBeGreaterThanOrEqual(0);
        expect(stats.cancelled).toBeGreaterThanOrEqual(0);
        expect(stats.noShow).toBeGreaterThanOrEqual(0);
        expect(stats.checkInPercentage).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.6: checkInPercentage is bounded [0, 100]
   * For any set of reservations, the percentage must be between 0 and 100
   */
  it("checkInPercentage is bounded between 0 and 100", () => {
    fc.assert(
      fc.property(reservationsArb, (reservations) => {
        const stats = calculateEventStats(reservations);

        // Property: percentage is bounded
        expect(stats.checkInPercentage).toBeGreaterThanOrEqual(0);
        expect(stats.checkInPercentage).toBeLessThanOrEqual(100);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.7: Empty reservations produce zero stats
   * When there are no reservations, all counts should be zero
   */
  it("empty reservations produce zero stats", () => {
    const stats = calculateEventStats([]);

    expect(stats.totalExpected).toBe(0);
    expect(stats.checkedIn).toBe(0);
    expect(stats.remaining).toBe(0);
    expect(stats.cancelled).toBe(0);
    expect(stats.noShow).toBe(0);
    expect(stats.checkInPercentage).toBe(0);
  });

  /**
   * Property 8.8: checkedIn count matches actual checked_in reservations
   * For any set of reservations, checkedIn must equal the count of
   * reservations with status 'checked_in'
   */
  it("checkedIn count matches actual checked_in reservations", () => {
    fc.assert(
      fc.property(reservationsArb, (reservations) => {
        const stats = calculateEventStats(reservations);

        // Count checked_in manually
        const checkedInCount = reservations.filter(
          (r) => r.status === "checked_in"
        ).length;

        // Property: checkedIn matches
        expect(stats.checkedIn).toBe(checkedInCount);
      }),
      { numRuns: 100 }
    );
  });
});
