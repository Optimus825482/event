import { describe, expect, it } from "vitest";
import {
  DEMO_BADGE,
  formatMoney,
  occupancyLabel,
  occupancyTone,
  orderStatusLabel,
} from "@/features/ticketing/view-model";

describe("siparişler görünüm modeli", () => {
  it.each([
    [{ held: 2, issued: 3, seats: 8 }, "5/8", "partial"],
    [{ held: 0, issued: 0, seats: 6 }, "0/6", "empty"],
    [{ held: 0, issued: 8, seats: 8 }, "8/8", "full"],
  ] as const)("doluluk %j → %s (%s)", (row, label, tone) => {
    expect(occupancyLabel(row)).toBe(label);
    expect(occupancyTone(row)).toBe(tone);
  });

  it("durum etiketleri ve demo rozeti", () => {
    expect(orderStatusLabel("pending")).toBe("Tutuluyor");
    expect(orderStatusLabel("paid")).toBe("Ödendi");
    expect(DEMO_BADGE).toBe("DEMO");
  });

  it.each([
    ["3000.00", "3.000,00 TRY"],
    ["1234567.50", "1.234.567,50 TRY"],
    ["0.00", "0,00 TRY"],
    ["999.90", "999,90 TRY"],
    ["100000.00", "100.000,00 TRY"],
  ])("formatMoney(%s) = %s", (amount, text) => {
    expect(formatMoney(amount, "TRY")).toBe(text);
  });
});
