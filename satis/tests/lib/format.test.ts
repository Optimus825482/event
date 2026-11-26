import { describe, expect, it } from "vitest";
import { formatMoney, multiplyMoney } from "@/lib/format";

describe("formatMoney", () => {
  it.each([
    ["1250.00", "TRY", "1.250,00 ₺"],
    ["99.5", "EUR", "99,50 €"],
    ["10.00", "CHF", "10,00 CHF"],
  ])("formatMoney(%s, %s) = %s", (a, c, out) => expect(formatMoney(a, c)).toBe(out));
});

describe("multiplyMoney", () => {
  it.each([
    ["1250.50", 3, "3751.50"],
    ["0.10", 3, "0.30"],
    ["4000.00", 1, "4000.00"],
  ])("multiplyMoney(%s, %i) = %s", (a, q, out) => expect(multiplyMoney(a, q)).toBe(out));
});
