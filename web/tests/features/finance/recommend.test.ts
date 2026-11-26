import { describe, expect, it } from "vitest";
import {
  casinoShare,
  distributableAmount,
  recommendPrices,
} from "@/features/finance/recommend";

const base = {
  estimatedExpense: "100000.00",
  estimatedOtherIncome: "20000.00",
  targetProfit: "20000.00",
  casinoShare: "0.00",
};
const ones = { standard: "1.000", premium: "1.000", vip: "1.000" };

describe("recommendPrices", () => {
  it("tek kategori, tam bölünen: fazladan lira eklenmez", () =>
    expect(
      recommendPrices({
        ...base,
        seats: { standard: 8, premium: 0, vip: 0 },
        coefficients: ones,
      }),
    ).toEqual({
      prices: { standard: "12500.00", premium: null, vip: null },
      base: "12500.00",
      reason: "ok",
    }));

  it("katsayılı dağıtım yukarı tam sayıya yuvarlanır", () =>
    expect(
      recommendPrices({
        ...base,
        seats: { standard: 100, premium: 50, vip: 20 },
        coefficients: { standard: "1.000", premium: "1.500", vip: "2.500" },
      }),
    ).toEqual({
      prices: { standard: "445.00", premium: "667.00", vip: "1112.00" },
      base: "444.45",
      reason: "ok",
    }));

  it("Casino payı ve diğer gelir düşülür", () =>
    expect(
      recommendPrices({
        ...base,
        casinoShare: "30000.00",
        seats: { standard: 10, premium: 0, vip: 0 },
        coefficients: ones,
      }).prices.standard,
    ).toBe("7000.00"));

  it("satılabilir sandalye yoksa öneri üretilmez", () =>
    expect(
      recommendPrices({
        ...base,
        seats: { standard: 0, premium: 0, vip: 0 },
        coefficients: ones,
      }),
    ).toEqual({
      prices: { standard: null, premium: null, vip: null },
      base: "0.00",
      reason: "no_seats",
    }));

  it("sandalye sayısı 0 iken bölme hatası vermez, katsayı 0 olsa da", () =>
    expect(
      recommendPrices({
        ...base,
        seats: { standard: 0, premium: 0, vip: 0 },
        coefficients: { standard: "0.000", premium: "0.000", vip: "0.000" },
      }).reason,
    ).toBe("no_seats"));

  it("sandalye var ama ağırlıklı toplam 0 ise öneri üretilmez", () =>
    expect(
      recommendPrices({
        ...base,
        seats: { standard: 5, premium: 0, vip: 0 },
        coefficients: { standard: "0.000", premium: "1.000", vip: "1.000" },
      }),
    ).toEqual({
      prices: { standard: null, premium: null, vip: null },
      base: "0.00",
      reason: "no_seats",
    }));

  it("gelirler gideri aşarsa öneri 0 olur (negatif olmaz)", () =>
    expect(
      recommendPrices({
        ...base,
        casinoShare: "500000.00",
        seats: { standard: 10, premium: 0, vip: 0 },
        coefficients: ones,
      }),
    ).toEqual({
      prices: { standard: "0.00", premium: null, vip: null },
      base: "0.00",
      reason: "ok",
    }));

  it("kuruşlu pay: 0.10 + 0.20, 3 sandalye → birim 0.10, öneri 1 lira", () =>
    expect(
      recommendPrices({
        estimatedExpense: "0.10",
        targetProfit: "0.20",
        estimatedOtherIncome: "0.00",
        casinoShare: "0.00",
        seats: { standard: 3, premium: 0, vip: 0 },
        coefficients: ones,
      }),
    ).toMatchObject({ prices: { standard: "1.00" }, base: "0.10" }));

  it("tek kuruş: tek sandalye, 0.01 → 1 lira, taban 0.01", () =>
    expect(
      recommendPrices({
        estimatedExpense: "0.01",
        targetProfit: "0.00",
        estimatedOtherIncome: "0.00",
        casinoShare: "0.00",
        seats: { standard: 1, premium: 0, vip: 0 },
        coefficients: ones,
      }),
    ).toMatchObject({ prices: { standard: "1.00" }, base: "0.01" }));

  it("en büyük değerler taşmaz", () =>
    expect(
      recommendPrices({
        estimatedExpense: "999999999.99",
        targetProfit: "999999999.99",
        estimatedOtherIncome: "0.00",
        casinoShare: "0.00",
        seats: { standard: 1, premium: 0, vip: 0 },
        coefficients: { standard: "1.000", premium: "1.000", vip: "1.000" },
      }),
    ).toMatchObject({
      prices: { standard: "2000000000.00" },
      base: "1999999999.98",
      reason: "ok",
    }));

  it("bölmede kalan: toplam gelir dağıtılacak tutarın altına düşmez", () => {
    const seats = { standard: 7, premium: 3, vip: 1 };
    const coefficients = { standard: "1.000", premium: "1.333", vip: "2.717" };
    const r = recommendPrices({ ...base, seats, coefficients });
    const lira = (s: string | null) =>
      s === null ? BigInt("0") : BigInt(s.replace(".00", ""));
    const gelir =
      BigInt("7") * lira(r.prices.standard) +
      BigInt("3") * lira(r.prices.premium) +
      BigInt("1") * lira(r.prices.vip);
    // dağıtılacak 100000.00 TL
    expect(gelir >= BigInt("100000")).toBe(true);
  });

  it("katsayıların toplamı: eşit katsayıda fiyatlar eşittir", () => {
    const r = recommendPrices({
      ...base,
      seats: { standard: 3, premium: 3, vip: 3 },
      coefficients: ones,
    });
    expect(r.prices.standard).toBe(r.prices.premium);
    expect(r.prices.premium).toBe(r.prices.vip);
    expect(r.prices.standard).toBe("11112.00");
  });

  it("geçersiz sandalye sayısı RangeError", () => {
    expect(() =>
      recommendPrices({
        ...base,
        seats: { standard: -1, premium: 0, vip: 0 },
        coefficients: ones,
      }),
    ).toThrow(RangeError);
    expect(() =>
      recommendPrices({
        ...base,
        seats: { standard: 1.5, premium: 0, vip: 0 },
        coefficients: ones,
      }),
    ).toThrow(RangeError);
  });
});

describe("distributableAmount ve casinoShare", () => {
  it("dağıtılacak tutar", () => {
    expect(distributableAmount(base)).toBe("100000.00");
    expect(distributableAmount({ ...base, casinoShare: "500000.00" })).toBe(
      "0.00",
    );
  });
  it("tam sıfıra denk gelen tutar 0.00 olur", () => {
    expect(
      distributableAmount({
        estimatedExpense: "10.00",
        targetProfit: "0.00",
        estimatedOtherIncome: "10.00",
        casinoShare: "0.00",
      }),
    ).toBe("0.00");
  });
  it("casinoShare", () => {
    expect(
      casinoShare({
        mode: "free",
        transferPrice: "750.00",
        casinoCapacity: 40,
      }),
    ).toBe("0.00");
    expect(
      casinoShare({
        mode: "transfer",
        transferPrice: "750.50",
        casinoCapacity: 40,
      }),
    ).toBe("30020.00");
    expect(
      casinoShare({
        mode: "transfer",
        transferPrice: "750.50",
        casinoCapacity: 0,
      }),
    ).toBe("0.00");
  });
});
