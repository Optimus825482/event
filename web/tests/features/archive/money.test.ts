import { describe, expect, it } from "vitest";
import { addMoney, fromCents, subMoney, toCents } from "@/features/archive/money";

describe("arşiv para yardımcıları", () => {
  it("kuruş kesinliğinde toplar", () => {
    expect(addMoney("0.10", "0.20")).toBe("0.30");
    expect(addMoney("9999999999.99", "0.01")).toBe("10000000000.00");
    expect(addMoney()).toBe("0.00");
    expect(addMoney("5", "1.5")).toBe("6.50");
  });
  it("çıkarma negatif sonucu işaretiyle verir", () => {
    expect(subMoney("550.50", "1680.00")).toBe("-1129.50");
    expect(subMoney("0.05", "0.10")).toBe("-0.05");
    expect(subMoney("1.00", "1.00")).toBe("0.00");
  });
  it("toCents / fromCents gidiş dönüşü", () => {
    expect(toCents("-879.25")).toBe(BigInt(-87925));
    expect(fromCents(BigInt(-5))).toBe("-0.05");
    expect(fromCents(BigInt(100))).toBe("1.00");
  });
  it.each(["", "abc", "1,50", "1.234", "1e3", " 1.00"])("geçersiz tutar %j hata verir", (v) => {
    expect(() => toCents(v)).toThrow("Geçersiz tutar");
  });
});
