import { describe, expect, it } from "vitest";
import { formatMoney, multiplyMoney } from "@/lib/format";

describe("formatMoney", () => {
  it.each([
    ["1250.00", "TRY", "1.250,00 ₺"],
    ["99.5", "EUR", "99,50 €"],
    ["10.00", "CHF", "10,00 CHF"],
  ])("formatMoney(%s, %s) = %s", (a, c, out) => expect(formatMoney(a, c)).toBe(out));
});

describe("büyük, negatif ve geçersiz tutarlar", () => {
  it("2^53 üstü tutarda hassasiyet kaybolmaz", () => {
    expect(multiplyMoney("90071992547409.93", 3)).toBe("270215977642229.79");
    expect(formatMoney("90071992547409.93", "TRY")).toBe("90.071.992.547.409,93 ₺");
  });
  it("negatif tutar işaretini korur", () => {
    expect(formatMoney("-5.5", "TRY")).toBe("-5,50 ₺");
    expect(multiplyMoney("-0.10", 3)).toBe("-0.30");
  });
  it.each(["", "abc", "1,5", "1.234", "--1", "1e3"])("geçersiz tutar %j reddedilir", (a) => {
    expect(() => formatMoney(a, "TRY")).toThrow(/Geçersiz tutar/);
    expect(() => multiplyMoney(a, 1)).toThrow(/Geçersiz tutar/);
  });
  it("geçersiz adet reddedilir", () => expect(() => multiplyMoney("1.00", 1.5)).toThrow(/Geçersiz adet/));
});

describe("multiplyMoney", () => {
  it.each([
    ["1250.50", 3, "3751.50"],
    ["0.10", 3, "0.30"],
    ["4000.00", 1, "4000.00"],
  ])("multiplyMoney(%s, %i) = %s", (a, q, out) => expect(multiplyMoney(a, q)).toBe(out));
});
