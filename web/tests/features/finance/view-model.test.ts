import { describe, expect, it } from "vitest";
import type { RecommendationView } from "@/features/finance/recommendation-service";
import {
  finalPricesFromForm,
  itemFormToInput,
  priceRows,
  recommendationNote,
  summaryCards,
  type ItemForm,
} from "@/features/finance/view-model";

const AMOUNT_ERROR = "Tutarı binlik ayırıcı olmadan yazın (örn. 12500,50)";

const baseForm: ItemForm = {
  direction: "expense",
  category: "production",
  label: "Ses sistemi",
  estimated: "12500,5",
  actual: "",
  note: "Not",
};

function view(partial: Partial<RecommendationView> & { distributable?: string }): RecommendationView {
  const { distributable = "1000.00", ...rest } = partial;
  return {
    reason: "ok",
    prices: { standard: null, premium: null, vip: null },
    base: "0.00",
    assumptions: {
      estimatedExpense: "0.00",
      targetProfit: "0.00",
      estimatedOtherIncome: "0.00",
      casinoCostMode: "free",
      casinoCapacity: 0,
      casinoShare: "0.00",
      distributable,
      locaOnline: false,
      seats: { standard: 1, premium: 0, vip: 0 },
      coefficients: { standard: "1.000", premium: "1.000", vip: "1.000" },
    },
    ...rest,
  };
}

describe("summaryCards", () => {
  it("dört kartı para birimiyle biçimler", () => {
    const cards = summaryCards({
      currency: "TRY",
      summary: {
        estimatedExpense: "100000.30",
        actualExpense: "5.00",
        estimatedOtherIncome: "0.00",
        actualOtherIncome: "1234.50",
      },
    } as Parameters<typeof summaryCards>[0]);
    expect(cards).toEqual([
      { key: "estimatedExpense", label: "Tahmini gider", value: "100.000,30 TRY" },
      { key: "actualExpense", label: "Gerçekleşen gider", value: "5,00 TRY" },
      { key: "estimatedOtherIncome", label: "Tahmini diğer gelir", value: "0,00 TRY" },
      { key: "actualOtherIncome", label: "Gerçekleşen diğer gelir", value: "1.234,50 TRY" },
    ]);
  });
});

describe("priceRows", () => {
  it("sıra, biçim ve zorunluluk", () =>
    expect(
      priceRows({
        seats: { standard: 8, premium: 2, vip: 0 },
        missingFinalPrice: ["premium"],
        seatPrices: {
          standard: { finalPrice: "9000.00", recommendedPrice: "8334.00", coefficient: "1.000" },
          premium: { finalPrice: null, recommendedPrice: "16667.00", coefficient: "2.000" },
          vip: { finalPrice: null, recommendedPrice: null, coefficient: "1.000" },
        },
      }),
    ).toEqual([
      { category: "standard", label: "Standart", seats: 8, coefficient: "1.000", recommended: "8.334,00", finalPrice: "9000,00", required: false },
      { category: "premium", label: "Premium", seats: 2, coefficient: "2.000", recommended: "16.667,00", finalPrice: "", required: true },
      { category: "vip", label: "VIP", seats: 0, coefficient: "1.000", recommended: null, finalPrice: "", required: false },
    ]));
});

describe("itemFormToInput", () => {
  it("virgüllü tutar kanonikleşir, boş gerçekleşen null olur", () => {
    expect(itemFormToInput(baseForm)).toEqual({
      ok: true,
      value: {
        direction: "expense",
        category: "production",
        label: "Ses sistemi",
        estimatedAmount: "12500.50",
        actualAmount: null,
        note: "Not",
      },
    });
  });

  it("dolu gerçekleşen kanonikleşir", () => {
    const result = itemFormToInput({ ...baseForm, actual: "10,5" });
    expect(result.ok && result.value.actualAmount).toBe("10.50");
  });

  it("binlik ayırıcılı tutar alan hatasıdır", () => {
    expect(itemFormToInput({ ...baseForm, estimated: "12.500,50" })).toEqual({
      ok: false,
      errors: { estimated: AMOUNT_ERROR },
    });
  });

  it("gerçekleşen için de hata verir", () => {
    expect(itemFormToInput({ ...baseForm, actual: "1.000,00" })).toEqual({
      ok: false,
      errors: { actual: AMOUNT_ERROR },
    });
  });
});

describe("finalPricesFromForm", () => {
  it("boş alanlar atlanır, hatalı alan adlandırılır", () => {
    expect(finalPricesFromForm({ standard: "9000", premium: "", vip: "x" })).toEqual({
      ok: false,
      errors: { vip: AMOUNT_ERROR },
    });
    expect(finalPricesFromForm({ standard: "9000", premium: "", vip: "" })).toEqual({
      ok: true,
      prices: { standard: "9000.00" },
    });
  });

  it("hepsi boşsa boş küme döner", () => {
    expect(finalPricesFromForm({ standard: " ", premium: "", vip: "" })).toEqual({ ok: true, prices: {} });
  });
});

describe("recommendationNote", () => {
  it("üç durumu ayırır", () => {
    expect(recommendationNote(view({ reason: "no_seats" }))).toBe("Satılabilir sandalye yok");
    expect(recommendationNote(view({ distributable: "0.00" }))).toBe(
      "Gelirler gideri ve hedef kârı karşılıyor; önerilen fiyat 0",
    );
    expect(recommendationNote(view({ distributable: "5000.00" }))).toBeNull();
  });
});
