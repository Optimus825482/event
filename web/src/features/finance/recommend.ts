// Tavsiye fiyat hesabı. Saf modül: yalnızca `bigint` (bkz. money.ts).
import { SALE_CATEGORIES, type SaleCategory } from "@/domain/seating";
import type { CasinoCostMode } from "./constants";
import { fromMinor, multiplyMoney, toMilli, toMinor } from "./money";

export type RecommendInput = {
  estimatedExpense: string;
  estimatedOtherIncome: string;
  targetProfit: string;
  casinoShare: string;
  seats: Record<SaleCategory, number>;
  coefficients: Record<SaleCategory, string>;
};

export type RecommendResult = {
  prices: Record<SaleCategory, string | null>;
  base: string;
  reason: "ok" | "no_seats";
};

const ZERO = BigInt(0);
const ONE = BigInt(1);
const HUNDRED = BigInt(100);
const THOUSAND = BigInt(1000);

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - ONE) / denominator;
}

/** Dağıtılacak tutar: gider + hedef kâr − Casino payı − diğer gelir; negatifse 0. */
export function distributableAmount(input: {
  estimatedExpense: string;
  estimatedOtherIncome: string;
  targetProfit: string;
  casinoShare: string;
}): string {
  const need = toMinor(input.estimatedExpense) + toMinor(input.targetProfit);
  const covered =
    toMinor(input.casinoShare) + toMinor(input.estimatedOtherIncome);
  return fromMinor(need > covered ? need - covered : ZERO);
}

export function casinoShare(input: {
  mode: CasinoCostMode;
  transferPrice: string;
  casinoCapacity: number;
}): string {
  return input.mode === "free"
    ? "0.00"
    : multiplyMoney(input.transferPrice, input.casinoCapacity);
}

export function recommendPrices(input: RecommendInput): RecommendResult {
  const need = toMinor(distributableAmount(input));

  let weighted = ZERO;
  const milli = {} as Record<SaleCategory, bigint>;
  const seats = {} as Record<SaleCategory, bigint>;
  for (const category of SALE_CATEGORIES) {
    const count = input.seats[category];
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError(
        `Geçersiz sandalye sayısı (${category}): ${String(count)}`,
      );
    }
    seats[category] = BigInt(count);
    milli[category] = toMilli(input.coefficients[category]);
    weighted += seats[category] * milli[category];
  }

  const prices = {} as Record<SaleCategory, string | null>;
  if (weighted === ZERO) {
    for (const category of SALE_CATEGORIES) {
      prices[category] = null;
    }
    return { prices, base: "0.00", reason: "no_seats" };
  }

  for (const category of SALE_CATEGORIES) {
    prices[category] =
      seats[category] > ZERO
        ? `${ceilDiv(need * milli[category], HUNDRED * weighted)}.00`
        : null;
  }
  return {
    prices,
    base: fromMinor(ceilDiv(need * THOUSAND, weighted)),
    reason: "ok",
  };
}
