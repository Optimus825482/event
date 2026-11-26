import { sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventFinancePlans, eventSeatPrices } from "@/db/schema";
import { SALE_CATEGORIES, type SaleCategory } from "@/domain/seating";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { getSeatPrices, type SeatPrice } from "@/features/seating/prices";
import { getSaleSettings } from "@/features/seating/settings-service";
import type { CasinoCostMode } from "./constants";
import { lockEditableEvent } from "./price-service";
import { type FinanceSummary, getFinanceSummary } from "./queries";
import { casinoShare as computeCasinoShare, distributableAmount, recommendPrices } from "./recommend";
import { casinoCapacity, sellableSeatsByCategory } from "./seats";

export type RecommendationView = {
  reason: "ok" | "no_seats";
  prices: Record<SaleCategory, string | null>;
  base: string;
  assumptions: {
    estimatedExpense: string;
    targetProfit: string;
    estimatedOtherIncome: string;
    casinoCostMode: CasinoCostMode;
    casinoCapacity: number;
    casinoShare: string;
    distributable: string;
    locaOnline: boolean;
    seats: Record<SaleCategory, number>;
    coefficients: Record<SaleCategory, string>;
  };
};

/** Tavsiyeyi hesaplar; hiçbir şey yazmaz. Yetki denetimi çağırana aittir. */
export async function previewRecommendation(
  ex: Db | Tx,
  eventId: string,
  /** Çağıranın aynı görüntüden zaten okuduğu veriler; verilirse yeniden okunmaz. */
  preloaded: { summary?: FinanceSummary; prices?: Record<SaleCategory, SeatPrice> } = {},
): Promise<RecommendationView> {
  const summary = preloaded.summary ?? (await getFinanceSummary(ex, eventId));
  const settings = await getSaleSettings(ex, eventId);
  const prices = preloaded.prices ?? (await getSeatPrices(ex, eventId));
  const capacity = await casinoCapacity(ex, eventId);
  const seats = await sellableSeatsByCategory(ex, eventId, { includeLoca: settings.locaOnline });

  const coefficients = {} as Record<SaleCategory, string>;
  for (const category of SALE_CATEGORIES) coefficients[category] = prices[category].coefficient;

  const share = computeCasinoShare({
    mode: summary.casinoCostMode,
    transferPrice: summary.casinoTransferPrice,
    casinoCapacity: capacity,
  });
  const money = {
    estimatedExpense: summary.estimatedExpense,
    estimatedOtherIncome: summary.estimatedOtherIncome,
    targetProfit: summary.targetProfit,
    casinoShare: share,
  };
  const result = recommendPrices({ ...money, seats, coefficients });

  return {
    reason: result.reason,
    prices: result.prices,
    base: result.base,
    assumptions: {
      estimatedExpense: summary.estimatedExpense,
      targetProfit: summary.targetProfit,
      estimatedOtherIncome: summary.estimatedOtherIncome,
      casinoCostMode: summary.casinoCostMode,
      casinoCapacity: capacity,
      casinoShare: share,
      distributable: distributableAmount(money),
      locaOnline: settings.locaOnline,
      seats,
      coefficients,
    },
  };
}

/**
 * Tavsiyeyi hesaplar ve kaydeder: yalnızca `recommended_price` sütunları ve `recommended_at` yazılır.
 *
 * Değişmez: girdileri değiştiren tüm yazıcılar (kalem ekle/güncelle/sil, plan, katsayı, kesin fiyat,
 * satış ayarları, sınıflandırma, tahsis, yerleşim kaydı) etkinlik satırını `FOR UPDATE` ya da `FOR SHARE`
 * ile kilitler. Burada `FOR UPDATE` alındığı için hepsi bu işlem bitene dek bekler; sonraki ayrı
 * SELECT'ler (READ COMMITTED) bu sayede tek tutarlı görüntü okur. Yeni bir yazıcı kilidi atlamamalıdır.
 */
export async function computeRecommendation(
  db: Db,
  actor: Actor,
  input: { eventId: string },
): Promise<RecommendationView> {
  authorize(actor, "finance", "edit");

  return db.transaction(async (tx) => {
    await lockEditableEvent(tx, input.eventId);

    const view = await previewRecommendation(tx, input.eventId);
    for (const category of SALE_CATEGORIES) {
      const recommendedPrice = view.prices[category];
      await tx
        .insert(eventSeatPrices)
        .values({ eventId: input.eventId, category, recommendedPrice })
        .onConflictDoUpdate({
          target: [eventSeatPrices.eventId, eventSeatPrices.category],
          set: { recommendedPrice, updatedAt: sql`now()` },
        });
    }
    // Plan satırında yalnızca `recommended_at` yazılır; planı son değiştiren bilgisi korunur.
    const recommendedAt = view.reason === "ok" ? sql`now()` : null;
    await tx
      .insert(eventFinancePlans)
      .values({ eventId: input.eventId, recommendedAt })
      .onConflictDoUpdate({ target: eventFinancePlans.eventId, set: { recommendedAt, updatedAt: eventFinancePlans.updatedAt } });
    return view;
  });
}
