import { describe, expect, it } from "vitest";
import {
  COEFFICIENT_PATTERN,
  MONEY_PATTERN,
  addMoney,
  formatMoney,
  fromMinor,
  multiplyMoney,
  parseMoneyInput,
  toMilli,
  toMinor,
} from "@/features/finance/money";

describe("toMinor", () => {
  it.each([
    ["1.15", BigInt("115")],
    ["0.29", BigInt("29")],
    ["0.1", BigInt("10")],
    ["12500", BigInt("1250000")],
    ["9999999999.99", BigInt("999999999999")],
    ["123456789012.00", BigInt("12345678901200")],
    ["0", BigInt("0")],
    ["0.00", BigInt("0")],
    ["0.01", BigInt("1")],
    ["999999999.99", BigInt("99999999999")],
  ])("toMinor(%s) = %s", (s, n) => expect(toMinor(s)).toBe(n));

  it.each([
    "",
    "-1",
    "1,5",
    "1.234",
    "1e3",
    " 5",
    "abc",
    "1.2.3",
    "1.",
    ".5",
    "+5",
    "5 ",
  ])("toMinor(%j) RangeError", (s) =>
    expect(() => toMinor(s)).toThrow(RangeError),
  );

  it("aşırı uzun girdi sessizce bozulmaz", () => {
    expect(toMinor("9".repeat(40) + ".99")).toBe(BigInt("9".repeat(40) + "99"));
    expect(() => toMinor("9".repeat(40) + ".999")).toThrow(RangeError);
  });
});

describe("fromMinor", () => {
  it("iki ondalık yazar", () => {
    expect(
      [BigInt("0"), BigInt("5"), BigInt("115"), BigInt("1250050")].map(
        fromMinor,
      ),
    ).toEqual(["0.00", "0.05", "1.15", "12500.50"]);
    expect(() => fromMinor(-BigInt("1"))).toThrow(RangeError);
  });
  it("en büyük değer ve tek kuruş", () => {
    expect(fromMinor(BigInt("99999999999"))).toBe("999999999.99");
    expect(fromMinor(BigInt("1"))).toBe("0.01");
  });
  it("toMinor ile gidiş-dönüş tutarlıdır", () => {
    for (const s of [
      "0.00",
      "0.01",
      "10.10",
      "999999999.99",
      "9999999999.99",
    ]) {
      expect(fromMinor(toMinor(s))).toBe(s);
    }
  });
});

describe("addMoney", () => {
  it("kayan nokta kayması üretmez", () => {
    expect(addMoney("0.10", "0.20")).toBe("0.30");
    expect(addMoney(...Array<string>(1000).fill("0.01"))).toBe("10.00");
    expect(addMoney()).toBe("0.00");
  });
  it("tek terim kanonik biçime çevrilir; geçersiz terim RangeError", () => {
    expect(addMoney("5")).toBe("5.00");
    expect(() => addMoney("1.00", "x")).toThrow(RangeError);
  });
});

describe("multiplyMoney", () => {
  it("çarpar", () => {
    expect(multiplyMoney("1.15", 100)).toBe("115.00");
    expect(multiplyMoney("750.00", 0)).toBe("0.00");
    expect(multiplyMoney("750.50", 40)).toBe("30020.00");
    expect(multiplyMoney("0.01", 1)).toBe("0.01");
  });
  it("geçersiz adet RangeError", () => {
    expect(() => multiplyMoney("1.00", 1.5)).toThrow(RangeError);
    expect(() => multiplyMoney("1.00", -1)).toThrow(RangeError);
    expect(() => multiplyMoney("1.00", Number.NaN)).toThrow(RangeError);
    expect(() => multiplyMoney("1.00", Number.POSITIVE_INFINITY)).toThrow(
      RangeError,
    );
  });
});

describe("toMilli", () => {
  it("binde bire çevirir", () => {
    expect(["1", "1.5", "0.001", "2.125", "0", "0.000"].map(toMilli)).toEqual([
      BigInt("1000"),
      BigInt("1500"),
      BigInt("1"),
      BigInt("2125"),
      BigInt("0"),
      BigInt("0"),
    ]);
  });
  it.each(["", "-1", "1,5", "1.2345", "1e3", " 1", "abc"])(
    "toMilli(%j) RangeError",
    (s) => expect(() => toMilli(s)).toThrow(RangeError),
  );
});

describe("parseMoneyInput", () => {
  it.each([
    ["12500,5", "12500.50"],
    ["12500.50", "12500.50"],
    [" 300 ", "300.00"],
    ["0,07", "0.07"],
    ["0", "0.00"],
    ["999999999.99", "999999999.99"],
    ["999999999,99", "999999999.99"],
  ])("parseMoneyInput(%j) = %s", (t, s) => expect(parseMoneyInput(t)).toBe(s));

  it.each([
    "12.500,50",
    "1.250.000",
    "12,345",
    "-5",
    "",
    "   ",
    "1 000",
    "1234567890",
    "1e3",
    "abc",
    "1..5",
    "1,,5",
    "1.5.5",
    "5.",
    ".5",
    "+5",
    "1.234",
    "9".repeat(200),
  ])("parseMoneyInput(%j) = null", (t) =>
    expect(parseMoneyInput(t)).toBeNull(),
  );
});

describe("formatMoney", () => {
  it.each([
    ["0.00", "0,00"],
    ["0.05", "0,05"],
    ["999.90", "999,90"],
    ["1000.00", "1.000,00"],
    ["12500.50", "12.500,50"],
    ["1234567.00", "1.234.567,00"],
    ["999999999.99", "999.999.999,99"],
  ])("formatMoney(%s) = %s", (s, f) => expect(formatMoney(s)).toBe(f));

  it("geçersiz tutar RangeError", () => {
    expect(() => formatMoney("abc")).toThrow(RangeError);
  });
});

describe("kalıplar", () => {
  it("MONEY_PATTERN en fazla 9 tam basamak ve 2 ondalık", () => {
    expect(MONEY_PATTERN.test("999999999.99")).toBe(true);
    expect(MONEY_PATTERN.test("1000000000")).toBe(false);
    expect(MONEY_PATTERN.test("1.234")).toBe(false);
    expect(MONEY_PATTERN.test("-1")).toBe(false);
  });
  it("COEFFICIENT_PATTERN en fazla 3 tam basamak ve 3 ondalık", () => {
    expect(COEFFICIENT_PATTERN.test("999.999")).toBe(true);
    expect(COEFFICIENT_PATTERN.test("1000")).toBe(false);
    expect(COEFFICIENT_PATTERN.test("1.0000")).toBe(false);
  });
});
