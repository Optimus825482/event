/**
 * Property Test: Walk-in Registration Validation
 * **Property 12: Walk-in Registration Validation**
 * **Validates: Requirements 11.2, 11.3, 11.4**
 *
 * For any walk-in registration:
 * - guestName and guestCount SHALL be required
 * - The created reservation SHALL have status 'checked_in' and checkInTime set to creation time
 * - The selected table SHALL be available (no active reservation)
 *
 * Feature: check-in-module, Property 12: Walk-in Registration Validation
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// Types matching the store
interface WalkInData {
  guestName: string;
  guestCount: number;
  tableId: string;
  phone?: string;
}

interface AvailableTable {
  id: string;
  label: string;
  capacity: number;
  hasActiveReservation: boolean;
}

interface WalkInReservation {
  id: string;
  guestName: string;
  guestCount: number;
  tableId: string;
  phone?: string;
  status: "checked_in";
  checkInTime: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface WalkInResult {
  success: boolean;
  reservation?: WalkInReservation;
  error?: string;
}

/**
 * Validate walk-in registration data
 * This is the pure validation function
 */
function validateWalkInData(data: WalkInData): ValidationResult {
  const errors: string[] = [];

  // guestName is required and must not be empty/whitespace
  if (!data.guestName || data.guestName.trim().length === 0) {
    errors.push("Misafir adı zorunludur");
  }

  // guestCount is required and must be >= 1
  if (data.guestCount === undefined || data.guestCount === null) {
    errors.push("Kişi sayısı zorunludur");
  } else if (data.guestCount < 1) {
    errors.push("Kişi sayısı en az 1 olmalıdır");
  }

  // tableId is required
  if (!data.tableId || data.tableId.trim().length === 0) {
    errors.push("Masa seçimi zorunludur");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if table is available for walk-in
 */
function isTableAvailable(table: AvailableTable, guestCount: number): boolean {
  // Table must not have active reservation and must have enough capacity
  return !table.hasActiveReservation && table.capacity >= guestCount;
}

/**
 * Process walk-in registration
 * Returns a reservation with status 'checked_in' and checkInTime set
 */
function processWalkIn(
  data: WalkInData,
  availableTables: AvailableTable[]
): WalkInResult {
  // Validate input
  const validation = validateWalkInData(data);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors[0],
    };
  }

  // Find selected table
  const table = availableTables.find((t) => t.id === data.tableId);
  if (!table) {
    return {
      success: false,
      error: "Masa bulunamadı",
    };
  }

  // Check table availability
  if (!isTableAvailable(table, data.guestCount)) {
    return {
      success: false,
      error: table.hasActiveReservation
        ? "Bu masa zaten dolu"
        : "Masa kapasitesi yetersiz",
    };
  }

  // Create reservation with checked_in status
  const now = new Date().toISOString();
  const reservation: WalkInReservation = {
    id: `walkin-${Date.now()}`,
    guestName: data.guestName.trim(),
    guestCount: data.guestCount,
    tableId: data.tableId,
    phone: data.phone?.trim() || undefined,
    status: "checked_in",
    checkInTime: now,
  };

  return {
    success: true,
    reservation,
  };
}

// Arbitraries for generating test data

// Valid guest name (non-empty string)
const validGuestNameArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

// Invalid guest name (empty or whitespace only)
const invalidGuestNameArb = fc.constantFrom("", "   ", "\t", "\n", "  \t  ");

// Valid guest count (1-20)
const validGuestCountArb = fc.integer({ min: 1, max: 20 });

// Invalid guest count (0 or negative)
const invalidGuestCountArb = fc.integer({ min: -100, max: 0 });

// Table ID
const tableIdArb = fc.uuid();

// Phone number (optional)
const phoneArb = fc.option(fc.stringMatching(/^05[0-9]{9}$/), {
  nil: undefined,
});

// Available table
const availableTableArb = fc.record({
  id: tableIdArb,
  label: fc.string({ minLength: 1, maxLength: 3 }).map((s) => s || "A1"),
  capacity: fc.integer({ min: 1, max: 20 }),
  hasActiveReservation: fc.boolean(),
});

// List of available tables
const availableTablesArb = fc.array(availableTableArb, {
  minLength: 1,
  maxLength: 20,
});

describe("Property 12: Walk-in Registration Validation", () => {
  /**
   * Property 12.1: guestName is required
   * For any walk-in data with empty/whitespace guestName, validation SHALL fail
   */
  it("validation fails when guestName is empty or whitespace", () => {
    fc.assert(
      fc.property(
        invalidGuestNameArb,
        validGuestCountArb,
        tableIdArb,
        (guestName, guestCount, tableId) => {
          const data: WalkInData = { guestName, guestCount, tableId };
          const result = validateWalkInData(data);

          // Property: validation must fail for empty/whitespace guestName
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.includes("Misafir adı"))).toBe(
            true
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.2: guestCount is required and must be >= 1
   * For any walk-in data with guestCount < 1, validation SHALL fail
   */
  it("validation fails when guestCount is less than 1", () => {
    fc.assert(
      fc.property(
        validGuestNameArb,
        invalidGuestCountArb,
        tableIdArb,
        (guestName, guestCount, tableId) => {
          const data: WalkInData = { guestName, guestCount, tableId };
          const result = validateWalkInData(data);

          // Property: validation must fail for guestCount < 1
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.includes("Kişi sayısı"))).toBe(
            true
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.3: tableId is required
   * For any walk-in data with empty tableId, validation SHALL fail
   */
  it("validation fails when tableId is empty", () => {
    fc.assert(
      fc.property(
        validGuestNameArb,
        validGuestCountArb,
        fc.constantFrom("", "   "),
        (guestName, guestCount, tableId) => {
          const data: WalkInData = { guestName, guestCount, tableId };
          const result = validateWalkInData(data);

          // Property: validation must fail for empty tableId
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.includes("Masa"))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.4: Valid data passes validation
   * For any walk-in data with valid guestName, guestCount >= 1, and tableId,
   * validation SHALL pass
   */
  it("validation passes for valid walk-in data", () => {
    fc.assert(
      fc.property(
        validGuestNameArb,
        validGuestCountArb,
        tableIdArb,
        phoneArb,
        (guestName, guestCount, tableId, phone) => {
          const data: WalkInData = { guestName, guestCount, tableId, phone };
          const result = validateWalkInData(data);

          // Property: validation must pass for valid data
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.5: Created reservation has status 'checked_in'
   * For any successful walk-in registration, the reservation status SHALL be 'checked_in'
   */
  it("successful walk-in creates reservation with checked_in status", () => {
    fc.assert(
      fc.property(
        validGuestNameArb,
        fc.integer({ min: 1, max: 10 }),
        (guestName, guestCount) => {
          // Create an available table with enough capacity
          const table: AvailableTable = {
            id: "table-1",
            label: "A1",
            capacity: guestCount + 5, // Ensure enough capacity
            hasActiveReservation: false,
          };

          const data: WalkInData = {
            guestName,
            guestCount,
            tableId: table.id,
          };

          const result = processWalkIn(data, [table]);

          // Property: successful registration has checked_in status
          expect(result.success).toBe(true);
          expect(result.reservation?.status).toBe("checked_in");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.6: Created reservation has checkInTime set
   * For any successful walk-in registration, checkInTime SHALL be set to creation time
   */
  it("successful walk-in sets checkInTime to creation time", () => {
    fc.assert(
      fc.property(
        validGuestNameArb,
        fc.integer({ min: 1, max: 10 }),
        (guestName, guestCount) => {
          const table: AvailableTable = {
            id: "table-1",
            label: "A1",
            capacity: guestCount + 5,
            hasActiveReservation: false,
          };

          const beforeTime = new Date().toISOString();
          const data: WalkInData = {
            guestName,
            guestCount,
            tableId: table.id,
          };

          const result = processWalkIn(data, [table]);
          const afterTime = new Date().toISOString();

          // Property: checkInTime is set and within expected range
          expect(result.success).toBe(true);
          expect(result.reservation?.checkInTime).toBeDefined();
          expect(result.reservation!.checkInTime >= beforeTime).toBe(true);
          expect(result.reservation!.checkInTime <= afterTime).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.7: Table with active reservation is not available
   * For any table with hasActiveReservation=true, walk-in SHALL fail
   */
  it("walk-in fails when table has active reservation", () => {
    fc.assert(
      fc.property(
        validGuestNameArb,
        fc.integer({ min: 1, max: 5 }),
        (guestName, guestCount) => {
          // Create a table with active reservation
          const table: AvailableTable = {
            id: "table-1",
            label: "A1",
            capacity: 20, // Large capacity
            hasActiveReservation: true, // Already occupied
          };

          const data: WalkInData = {
            guestName,
            guestCount,
            tableId: table.id,
          };

          const result = processWalkIn(data, [table]);

          // Property: walk-in must fail for occupied table
          expect(result.success).toBe(false);
          expect(result.error).toContain("dolu");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.8: Phone is optional
   * For any valid walk-in data, phone can be undefined and registration SHALL succeed
   */
  it("phone is optional for walk-in registration", () => {
    fc.assert(
      fc.property(
        validGuestNameArb,
        fc.integer({ min: 1, max: 10 }),
        (guestName, guestCount) => {
          const table: AvailableTable = {
            id: "table-1",
            label: "A1",
            capacity: guestCount + 5,
            hasActiveReservation: false,
          };

          // No phone provided
          const data: WalkInData = {
            guestName,
            guestCount,
            tableId: table.id,
            phone: undefined,
          };

          const result = processWalkIn(data, [table]);

          // Property: registration succeeds without phone
          expect(result.success).toBe(true);
          expect(result.reservation?.phone).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.9: Guest name is trimmed in reservation
   * For any walk-in with whitespace-padded name, the reservation name SHALL be trimmed
   */
  it("guest name is trimmed in created reservation", () => {
    fc.assert(
      fc.property(
        validGuestNameArb,
        fc.integer({ min: 1, max: 10 }),
        (guestName, guestCount) => {
          const paddedName = `  ${guestName}  `;
          const table: AvailableTable = {
            id: "table-1",
            label: "A1",
            capacity: guestCount + 5,
            hasActiveReservation: false,
          };

          const data: WalkInData = {
            guestName: paddedName,
            guestCount,
            tableId: table.id,
          };

          const result = processWalkIn(data, [table]);

          // Property: name is trimmed (paddedName.trim() should equal the result)
          expect(result.success).toBe(true);
          expect(result.reservation?.guestName).toBe(paddedName.trim());
        }
      ),
      { numRuns: 100 }
    );
  });
});
