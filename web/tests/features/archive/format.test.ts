import { describe, expect, it } from "vitest";
import { DEMO_NOTICE, formatMoney, formatRate, isNegativeAmount } from "@/features/archive/format";

describe("arşiv biçimleme", () => {
  it.each([
    ["0.00", "TRY", "0,00 TRY"],
    ["550.50", "TRY", "550,50 TRY"],
    ["1234567.8", "TRY", "1.234.567,80 TRY"],
    ["-879.25", "EUR", "-879,25 EUR"],
    ["9999999999.99", "TRY", "9.999.999.999,99 TRY"],
    ["1000", "TRY", "1.000,00 TRY"],
  ] as const)("formatMoney(%j, %j) = %j", (amount, currency, text) => expect(formatMoney(amount, currency)).toBe(text));

  it.each([
    [42.9, "%42,9"],
    [50, "%50"],
    [0, "%0"],
    [null, "—"],
  ] as const)("formatRate(%j) = %j", (rate, text) => expect(formatRate(rate)).toBe(text));

  it.each([["-879.25", true], ["-0.00", false], ["0.00", false], ["12.50", false]] as const)(
    "isNegativeAmount(%j) = %j",
    (amount, expected) => expect(isNegativeAmount(amount)).toBe(expected),
  );

  it("demo ibaresi sözleşmedeki metindir", () => expect(DEMO_NOTICE).toBe("DEMO - gerçek ödeme alınmadı"));
});
