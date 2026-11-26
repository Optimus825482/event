import { describe, expect, it } from "vitest";
import { quantityOptions } from "@/features/plan/quantity";

const rules = { maxSeatsPerOrder: 12, blockSingleLeftover: true };

describe("quantityOptions", () => {
  it.each([
    [{ free: 5, seats: 8, wholeOnly: false }, rules, [1, 2, 3, 5]],
    [{ free: 5, seats: 8, wholeOnly: false }, { ...rules, blockSingleLeftover: false }, [1, 2, 3, 4, 5]],
    [{ free: 8, seats: 8, wholeOnly: false }, { ...rules, maxSeatsPerOrder: 3 }, [1, 2, 3]],
    [{ free: 2, seats: 8, wholeOnly: false }, rules, [2]],
    [{ free: 1, seats: 8, wholeOnly: false }, rules, [1]],
    [{ free: 0, seats: 8, wholeOnly: false }, rules, []],
    [{ free: 6, seats: 6, wholeOnly: true }, rules, [6]],
    [{ free: 4, seats: 6, wholeOnly: true }, rules, []],
    [{ free: 6, seats: 6, wholeOnly: true }, { ...rules, maxSeatsPerOrder: 4 }, []],
  ])("quantityOptions(%o, %o) = %j", (table, r, out) => expect(quantityOptions(table, r)).toEqual(out));
});
