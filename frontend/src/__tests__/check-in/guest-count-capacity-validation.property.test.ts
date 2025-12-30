/**
 * Property Test: Guest Count Capacity Validation
 * **Property 13: Guest Count Capacity Validation**
 * **Validates: Requirements 12.3, 12.4, 12.5**
 *
 * For any guest count update:
 * - If the new count exceeds table capacity, a warning SHALL be returned
 *   but the update SHALL be allowed with explicit confirmation
 * - Stats SHALL be updated to reflect the new total guest count
 *
 * Feature: check-in-module, Property 13: Guest Count Capacity Validation
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// Types
interface Table {
  id: string;
  label: string;
  capacity: number;
}

interface Reservation {
  id: string;
  tableId: string;
  guestCount: number;
  status: "pending" | "confirmed" | "checked_in" | "cancelled" | "no_show";
}

interface GuestCountUpdateResult {
  success: boolean;
  warning?: string;
  requiresConfirmation: boolean;
  newGuestCount: number;
}

interface EventStats {
  totalExpected: number;
  checkedIn: number;
  remaining: number;
  totalGuestCount: number;
}

/**
 * Validate guest count against table capacity
 * Returns validation result with warning if capacity exceeded
 */
function validateGuestCount(
  newCount: number,
  table: Table
): { valid: boolean; warning?: string; requiresConfirmation: boolean } {
  // Guest count must be at least 1
  if (newCount < 1) {
    return {
      valid: false,
      warning: "Kişi sayısı en az 1 olmalıdır",
      requiresConfirmation: false,
    };
  }

  // Check if exceeds capacity
  if (newCount > table.capacity) {
    return {
      valid: true, // Still valid, but requires confirmation
      warning: `Kişi sayısı masa kapasitesini (${table.capacity}) aşıyor`,
      requiresConfirmation: true,
    };
  }

  return {
    valid: true,
    requiresConfirmation: false,
  };
}

/**
 * Update guest count for a reservation
 * Allows update even if capacity exceeded (with confirmation)
 */
function updateGuestCount(
  reservation: Reservation,
  newCount: number,
  table: Table,
  confirmed: boolean = false
): GuestCountUpdateResult {
  const validation = validateGuestCount(newCount, table);

  // Invalid count (e.g., < 1)
  if (!validation.valid) {
    return {
      success: false,
      warning: validation.warning,
      requiresConfirmation: false,
      newGuestCount: reservation.guestCount,
    };
  }

  // Requires confirmation but not confirmed
  if (validation.requiresConfirmation && !confirmed) {
    return {
      success: false,
      warning: validation.warning,
      requiresConfirmation: true,
      newGuestCount: reservation.guestCount,
    };
  }

  // Update allowed (either within capacity or confirmed override)
  return {
    success: true,
    warning: validation.warning,
    requiresConfirmation: false,
    newGuestCount: newCount,
  };
}

/**
 * Calculate event stats including total guest count
 */
function calculateEventStats(reservations: Reservation[]): EventStats {
  const activeReservations = reservations.filter(
    (r) =>
      r.status === "pending" ||
      r.status === "confirmed" ||
      r.status === "checked_in"
  );

  const checkedInReservations = reservations.filter(
    (r) => r.status === "checked_in"
  );

  const totalGuestCount = activeReservations.reduce(
    (sum, r) => sum + r.guestCount,
    0
  );
  const checkedInGuestCount = checkedInReservations.reduce(
    (sum, r) => sum + r.guestCount,
    0
  );

  return {
    totalExpected: activeReservations.length,
    checkedIn: checkedInReservations.length,
    remaining: activeReservations.length - checkedInReservations.length,
    totalGuestCount,
  };
}

/**
 * Update stats after guest count change
 */
function updateStatsAfterGuestCountChange(
  stats: EventStats,
  oldCount: number,
  newCount: number
): EventStats {
  const diff = newCount - oldCount;
  return {
    ...stats,
    totalGuestCount: stats.totalGuestCount + diff,
  };
}

// Arbitraries

const tableArb = fc.record({
  id: fc.uuid(),
  label: fc.string({ minLength: 1, maxLength: 5 }).map((s) => s || "A1"),
  capacity: fc.integer({ min: 1, max: 20 }),
});

const reservationStatusArb = fc.constantFrom<Reservation["status"]>(
  "pending",
  "confirmed",
  "checked_in",
  "cancelled",
  "no_show"
);

const reservationArb = fc.record({
  id: fc.uuid(),
  tableId: fc.uuid(),
  guestCount: fc.integer({ min: 1, max: 20 }),
  status: reservationStatusArb,
});

describe("Property 13: Guest Count Capacity Validation", () => {
  /**
   * Property 13.1: Guest count within capacity is allowed without warning
   * For any guest count <= table capacity, update SHALL succeed without warning
   */
  it("guest count within capacity succeeds without warning", () => {
    fc.assert(
      fc.property(
        tableArb,
        fc.integer({ min: 1, max: 20 }),
        (table, currentCount) => {
          // Generate new count within capacity
          const newCount = fc.sample(
            fc.integer({ min: 1, max: table.capacity }),
            1
          )[0];

          const reservation: Reservation = {
            id: "res-1",
            tableId: table.id,
            guestCount: currentCount,
            status: "checked_in",
          };

          const result = updateGuestCount(reservation, newCount, table);

          // Property: update succeeds without warning when within capacity
          expect(result.success).toBe(true);
          expect(result.warning).toBeUndefined();
          expect(result.requiresConfirmation).toBe(false);
          expect(result.newGuestCount).toBe(newCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.2: Guest count exceeding capacity returns warning
   * For any guest count > table capacity, a warning SHALL be returned
   */
  it("guest count exceeding capacity returns warning", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // table capacity
        fc.integer({ min: 1, max: 10 }), // excess amount
        (capacity, excess) => {
          const table: Table = {
            id: "table-1",
            label: "A1",
            capacity,
          };

          const newCount = capacity + excess; // Exceeds capacity

          const reservation: Reservation = {
            id: "res-1",
            tableId: table.id,
            guestCount: 1,
            status: "checked_in",
          };

          const result = updateGuestCount(reservation, newCount, table, false);

          // Property: warning is returned when exceeding capacity
          expect(result.warning).toBeDefined();
          expect(result.warning).toContain("kapasitesini");
          expect(result.requiresConfirmation).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.3: Exceeding capacity is allowed with confirmation
   * For any guest count > table capacity, update SHALL be allowed with explicit confirmation
   */
  it("exceeding capacity is allowed with explicit confirmation", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // table capacity
        fc.integer({ min: 1, max: 10 }), // excess amount
        (capacity, excess) => {
          const table: Table = {
            id: "table-1",
            label: "A1",
            capacity,
          };

          const newCount = capacity + excess;

          const reservation: Reservation = {
            id: "res-1",
            tableId: table.id,
            guestCount: 1,
            status: "checked_in",
          };

          // With confirmation = true
          const result = updateGuestCount(reservation, newCount, table, true);

          // Property: update succeeds with confirmation
          expect(result.success).toBe(true);
          expect(result.newGuestCount).toBe(newCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.4: Guest count < 1 is rejected
   * For any guest count < 1, update SHALL fail
   */
  it("guest count less than 1 is rejected", () => {
    fc.assert(
      fc.property(
        tableArb,
        fc.integer({ min: -100, max: 0 }),
        (table, invalidCount) => {
          const reservation: Reservation = {
            id: "res-1",
            tableId: table.id,
            guestCount: 5,
            status: "checked_in",
          };

          const result = updateGuestCount(
            reservation,
            invalidCount,
            table,
            true
          );

          // Property: update fails for count < 1
          expect(result.success).toBe(false);
          expect(result.warning).toBeDefined();
          expect(result.newGuestCount).toBe(reservation.guestCount); // Unchanged
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.5: Stats reflect guest count changes
   * For any guest count update, stats SHALL be updated to reflect the new total
   */
  it("stats reflect guest count changes immediately", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // initial total
        fc.integer({ min: 1, max: 20 }), // old count
        fc.integer({ min: 1, max: 20 }), // new count
        (initialTotal, oldCount, newCount) => {
          const initialStats: EventStats = {
            totalExpected: 10,
            checkedIn: 5,
            remaining: 5,
            totalGuestCount: initialTotal,
          };

          const updatedStats = updateStatsAfterGuestCountChange(
            initialStats,
            oldCount,
            newCount
          );

          // Property: totalGuestCount reflects the change
          const expectedTotal = initialTotal + (newCount - oldCount);
          expect(updatedStats.totalGuestCount).toBe(expectedTotal);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.6: Stats calculation includes all active reservations
   * For any set of reservations, totalGuestCount SHALL sum guest counts
   * of pending, confirmed, and checked_in reservations
   */
  it("stats totalGuestCount sums active reservation guest counts", () => {
    fc.assert(
      fc.property(
        fc.array(reservationArb, { minLength: 0, maxLength: 50 }),
        (reservations) => {
          const stats = calculateEventStats(reservations);

          // Calculate expected total manually
          const expectedTotal = reservations
            .filter(
              (r) =>
                r.status === "pending" ||
                r.status === "confirmed" ||
                r.status === "checked_in"
            )
            .reduce((sum, r) => sum + r.guestCount, 0);

          // Property: totalGuestCount matches sum of active reservations
          expect(stats.totalGuestCount).toBe(expectedTotal);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.7: Cancelled and no_show reservations don't affect guest count
   * For any set of reservations, cancelled and no_show SHALL NOT be included in totalGuestCount
   */
  it("cancelled and no_show reservations excluded from guest count", () => {
    fc.assert(
      fc.property(
        fc.array(reservationArb, { minLength: 1, maxLength: 50 }),
        (reservations) => {
          const stats = calculateEventStats(reservations);

          // Calculate total including cancelled/no_show
          const totalIncludingInactive = reservations.reduce(
            (sum, r) => sum + r.guestCount,
            0
          );

          // Calculate cancelled/no_show total
          const inactiveTotal = reservations
            .filter((r) => r.status === "cancelled" || r.status === "no_show")
            .reduce((sum, r) => sum + r.guestCount, 0);

          // Property: totalGuestCount excludes inactive reservations
          expect(stats.totalGuestCount).toBe(
            totalIncludingInactive - inactiveTotal
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.8: Validation result is consistent
   * For any guest count and table, validation result is deterministic
   */
  it("validation result is deterministic", () => {
    fc.assert(
      fc.property(
        tableArb,
        fc.integer({ min: -10, max: 30 }),
        (table, guestCount) => {
          const result1 = validateGuestCount(guestCount, table);
          const result2 = validateGuestCount(guestCount, table);

          // Property: same input produces same output
          expect(result1.valid).toBe(result2.valid);
          expect(result1.warning).toBe(result2.warning);
          expect(result1.requiresConfirmation).toBe(
            result2.requiresConfirmation
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
