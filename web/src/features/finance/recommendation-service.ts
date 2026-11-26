import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventFinancePlans, eventSeatPrices, events } from "@/db/schema";
import { SALE_CATEGORIES, type SaleCategory } from "@/domain/seating";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { getSeatPrices } from "@/features/seating/prices";
import { getSaleSettings } from "@/features/seating/settings-service";
import { DomainError } from "@/lib/action";
import type { CasinoCostMode } from "./constants";
import { getFinanceSummary } from "./queries";
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

const MESSAGES = {
  notFound: "Etkinlik bulunamadı",
  frozen: "Tamamlanmış veya iptal edilmiş etkinliğin fiyatı değiştirilemez",
} as const;

/** Tavsiyeyi hesaplar; hiçbir şey yazmaz. Yetki denetimi çağırana aittir. */
export async function previewRecommendation(ex: Db | Tx, eventId: string): Promise<RecommendationView> {
  const summary = await getFinanceSummary(ex, eventId);
  const settings = await getSaleSettings(ex, eventId);
  const prices = await getSeatPrices(ex, eventId);
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

/** Tavsiyeyi hesaplar ve kaydeder: yalnızca `recommended_price` sütunları ve `recommended_at` yazılır. */
export async function computeRecommendation(
  db: Db,
  actor: Actor,
  input: { eventId: string },
): Promise<RecommendationView> {
  authorize(actor, "finance", "edit");

  return db.transaction(async (tx) => {
    const [event] = await tx
      .select({ status: events.status })
      .from(events)
      .where(eq(events.id, input.eventId))
      .for("update");
    if (!event) throw new DomainError("not_found", MESSAGES.notFound);
    if (event.status === "completed" || event.status === "cancelled") {
      throw new DomainError("conflict", MESSAGES.frozen);
    }

    const view = await previewRecommendation(tx, input.eventId);
    const now = new Date();
    for (const category of SALE_CATEGORIES) {
      const recommendedPrice = view.prices[category];
      await tx
        .insert(eventSeatPrices)
        .values({ eventId: input.eventId, category, recommendedPrice })
        .onConflictDoUpdate({
          target: [eventSeatPrices.eventId, eventSeatPrices.category],
          set: { recommendedPrice, updatedAt: now },
        });
    }
    const recommendedAt = view.reason === "ok" ? now : null;
    await tx
      .insert(eventFinancePlans)
      .values({ eventId: input.eventId, recommendedAt, updatedBy: actor.id })
      .onConflictDoUpdate({
        target: eventFinancePlans.eventId,
        set: { recommendedAt, updatedBy: actor.id, updatedAt: now },
      });
    return view;
  });
}
