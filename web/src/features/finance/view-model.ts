// Finans ekranının saf görünüm modeli: biçimleme ve form → eylem girdisi dönüşümü.
// Para yalnızca `formatMoney` / `parseMoneyInput` ile işlenir; kayan nokta kullanılmaz.
import { SALE_CATEGORIES, SALE_CATEGORY_LABELS, type SaleCategory } from "@/domain/seating";
import type { FinanceCategory, FinanceDirection } from "./constants";
import { formatMoney, parseMoneyInput, toMilli } from "./money";
import type { FinanceOverview } from "./overview";
import type { RecommendationView } from "./recommendation-service";

export const AMOUNT_INPUT_ERROR = "Tutarı binlik ayırıcı olmadan yazın (örn. 12500,50)";

export type SummaryCard = {
  key: "estimatedExpense" | "actualExpense" | "estimatedOtherIncome" | "actualOtherIncome";
  label: string;
  value: string;
};

const CARD_LABELS: readonly { key: SummaryCard["key"]; label: string }[] = [
  { key: "estimatedExpense", label: "Tahmini gider" },
  { key: "actualExpense", label: "Gerçekleşen gider" },
  { key: "estimatedOtherIncome", label: "Tahmini diğer gelir" },
  { key: "actualOtherIncome", label: "Gerçekleşen diğer gelir" },
];

export function summaryCards(o: Pick<FinanceOverview, "summary" | "currency">): SummaryCard[] {
  return CARD_LABELS.map(({ key, label }) => ({
    key,
    label,
    value: `${formatMoney(o.summary[key])} ${o.currency}`,
  }));
}

export type PriceRow = {
  category: SaleCategory;
  label: string;
  seats: number;
  coefficient: string;
  recommended: string | null;
  finalPrice: string;
  required: boolean;
};

export function priceRows(o: Pick<FinanceOverview, "seats" | "seatPrices" | "missingFinalPrice">): PriceRow[] {
  return SALE_CATEGORIES.map((category) => {
    const price = o.seatPrices[category];
    return {
      category,
      label: SALE_CATEGORY_LABELS[category],
      seats: o.seats[category],
      coefficient: price.coefficient,
      recommended: price.recommendedPrice === null ? null : formatMoney(price.recommendedPrice),
      // Giriş alanı değeri: gruplama yok, ondalık ayırıcı virgül.
      finalPrice: price.finalPrice === null ? "" : price.finalPrice.replace(".", ","),
      required: o.missingFinalPrice.includes(category),
    };
  });
}

export type ItemForm = {
  direction: FinanceDirection;
  category: FinanceCategory;
  label: string;
  estimated: string;
  actual: string;
  note: string;
};

export type ItemInput = {
  direction: FinanceDirection;
  category: FinanceCategory;
  label: string;
  estimatedAmount: string;
  actualAmount: string | null;
  note: string;
};

export function itemFormToInput(
  form: ItemForm,
):
  | { ok: true; value: ItemInput }
  | { ok: false; errors: Partial<Record<"estimated" | "actual", string>> } {
  const errors: Partial<Record<"estimated" | "actual", string>> = {};
  const estimatedAmount = parseMoneyInput(form.estimated);
  if (estimatedAmount === null) errors.estimated = AMOUNT_INPUT_ERROR;
  let actualAmount: string | null = null;
  if (form.actual.trim() !== "") {
    actualAmount = parseMoneyInput(form.actual);
    if (actualAmount === null) errors.actual = AMOUNT_INPUT_ERROR;
  }
  if (estimatedAmount === null || (form.actual.trim() !== "" && actualAmount === null)) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      direction: form.direction,
      category: form.category,
      label: form.label,
      estimatedAmount,
      actualAmount,
      note: form.note,
    },
  };
}

export function finalPricesFromForm(
  values: Record<SaleCategory, string>,
):
  | { ok: true; prices: Partial<Record<SaleCategory, string>> }
  | { ok: false; errors: Partial<Record<SaleCategory, string>> } {
  const prices: Partial<Record<SaleCategory, string>> = {};
  const errors: Partial<Record<SaleCategory, string>> = {};
  for (const category of SALE_CATEGORIES) {
    const text = values[category].trim();
    if (text === "") continue;
    const parsed = parseMoneyInput(text);
    if (parsed === null) errors[category] = AMOUNT_INPUT_ERROR;
    else prices[category] = parsed;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, prices };
}

export function recommendationNote(view: RecommendationView): string | null {
  if (view.reason === "no_seats") return "Satılabilir sandalye yok";
  if (view.assumptions.distributable === "0.00") {
    return "Gelirler gideri ve hedef kârı karşılıyor; önerilen fiyat 0";
  }
  return null;
}

/** Katsayı girdisi: virgül de kabul edilir; doğrulama sunucudadır. */
export const coefficientValue = (text: string) => text.trim().replace(",", ".");

/**
 * Girilen katsayılar kayıtlılardan farklı mı? Sayısal karşılaştırılır ("1" ile "1.000" aynıdır);
 * ayrıştırılamayan girdi kirli sayılır.
 */
export function coefficientsDirty(
  texts: Record<SaleCategory, string>,
  saved: Record<SaleCategory, string>,
): boolean {
  return SALE_CATEGORIES.some((category) => {
    try {
      return toMilli(coefficientValue(texts[category])) !== toMilli(saved[category]);
    } catch {
      return true;
    }
  });
}

/** Tavsiyenin dayandığı verinin parmak izi (kayıtlı katsayılar dahil); değişince eski varsayımlar gösterilmez. */
export function recommendationStamp(
  o: Pick<FinanceOverview, "summary" | "plan" | "seats" | "seatPrices">,
): string {
  return JSON.stringify([
    o.summary,
    o.plan.targetProfit,
    o.plan.casinoCostMode,
    o.plan.casinoTransferPrice,
    o.seats,
    SALE_CATEGORIES.map((c) => o.seatPrices[c].coefficient),
  ]);
}
