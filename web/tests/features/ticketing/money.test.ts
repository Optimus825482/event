import { describe, expect, it } from "vitest";
import { lineTotal, minMoney, sumMoney } from "@/features/ticketing/money";

describe("money", () => {
  it.each([
    ["1250.50", 3, "3751.50"],
    ["0.10", 3, "0.30"],
    ["1500", 2, "3000.00"],
    ["99999999.99", 50, "4999999999.50"],
  ])("lineTotal(%s, %i) = %s", (unit, qty, total) => expect(lineTotal(unit, qty)).toBe(total));
  it("toplam kayan nokta hatası üretmez", () => expect(sumMoney(["0.10", "0.20"])).toBe("0.30"));
  it("boş toplam 0.00", () => expect(sumMoney([])).toBe("0.00"));
  it("en küçük tutar sayısal karşılaştırılır (dizgi sırası değil)", () =>
    expect(minMoney(["1250.00", "900.50", "10000.00"])).toBe("900.50"));
  it("boş listede en küçük yoktur", () => expect(minMoney([])).toBeNull());
  it.each([
    ["12.345", 1],
    ["-5.00", 1],
    ["abc", 1],
    ["10.00", 0],
    ["10.00", 1.5],
  ])("geçersiz girdi (%s, %s) hata verir", (unit, qty) => expect(() => lineTotal(unit, qty)).toThrow());
  it("numeric(12,2) sınırını aşan sonuç RangeError verir", () => {
    expect(lineTotal("99999999.99", 100)).toBe("9999999999.00");
    expect(() => lineTotal("9999999999.99", 2)).toThrow(RangeError);
    expect(sumMoney(["9999999999.99", "0.00"])).toBe("9999999999.99");
    expect(() => sumMoney(["9999999999.99", "0.01"])).toThrow(RangeError);
  });
});
