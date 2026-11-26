import { notFound } from "next/navigation";
import type { Db, Tx } from "@/db/client";
import { db } from "@/db/client";
import type { EventStatus } from "@/domain/event-status";
import type { PlanningStage } from "@/domain/planning-stage";
import type { SaleCategory } from "@/domain/seating";
import { requirePolicyActor } from "@/features/auth/permissions";
import { authorize, can } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { getEventOrThrow } from "@/features/events/service";
import { getSeatPrices, type SeatPrice } from "@/features/seating/prices";
import { DomainError } from "@/lib/action";
import { isUuid } from "@/lib/identifiers";
import type { CasinoCostMode, FinanceCategory, FinanceDirection } from "./constants";
import { getFinancePlan } from "./plan-service";
import { categoriesMissingFinalPrice } from "./price-service";
import { type FinanceSummary, getFinanceItems, getFinanceSummary } from "./queries";
import { previewRecommendation } from "./recommendation-service";

export type FinanceOverview = {
  event: { id: string; name: string; status: EventStatus; planningStage: PlanningStage };
  currency: string;
  summary: FinanceSummary;
  items: {
    id: string;
    direction: FinanceDirection;
    category: FinanceCategory;
    label: string;
    estimatedAmount: string;
    actualAmount: string | null;
    note: string | null;
  }[];
  plan: {
    targetProfit: string;
    casinoCostMode: CasinoCostMode;
    casinoTransferPrice: string;
    recommendedAt: string | null;
  };
  seats: Record<SaleCategory, number>;
  seatPrices: Record<SaleCategory, SeatPrice>;
  missingFinalPrice: SaleCategory[];
  pricesLocked: boolean;
  permissions: { create: boolean; edit: boolean; delete: boolean };
};

async function readOverview(tx: Db | Tx, actor: Actor, eventId: string): Promise<FinanceOverview> {
  const event = await getEventOrThrow(tx, eventId);
  const summary = await getFinanceSummary(tx, eventId);
  const items = await getFinanceItems(tx, eventId);
  const plan = await getFinancePlan(tx, eventId);
  const seatPrices = await getSeatPrices(tx, eventId);
  const recommendation = await previewRecommendation(tx, eventId, { summary, prices: seatPrices });
  const missingFinalPrice = await categoriesMissingFinalPrice(tx, eventId);
  return {
    event: { id: event.id, name: event.name, status: event.status, planningStage: event.planningStage },
    currency: summary.currency,
    summary,
    items: items.map((row) => ({
      id: row.id,
      direction: row.direction,
      category: row.category,
      label: row.label,
      estimatedAmount: row.estimatedAmount,
      actualAmount: row.actualAmount,
      note: row.note,
    })),
    plan: {
      targetProfit: plan.targetProfit,
      casinoCostMode: plan.casinoCostMode,
      casinoTransferPrice: plan.casinoTransferPrice,
      recommendedAt: plan.recommendedAt ? plan.recommendedAt.toISOString() : null,
    },
    seats: recommendation.assumptions.seats,
    seatPrices,
    missingFinalPrice,
    pricesLocked: event.status === "completed" || event.status === "cancelled",
    permissions: {
      create: can(actor, "finance", "create"),
      edit: can(actor, "finance", "edit"),
      delete: can(actor, "finance", "delete"),
    },
  };
}

/** Finans ekranı verisi; tutarlı görüntü için tek işlemde okunur. */
export async function getFinanceOverview(ex: Db | Tx, actor: Actor, eventId: string): Promise<FinanceOverview> {
  authorize(actor, "finance", "view");
  // `Tx` (drizzle işlem nesnesi) `rollback` taşır, `Db` taşımaz: işlem içindeysek iç içe işlem açmadan
  // çağıranın görüntüsünden okuruz. `Db` için çok sorgulu tutarlı görüntü: yinelenebilir okuma, salt okunur.
  if ("rollback" in ex) return readOverview(ex, actor, eventId);
  return ex.transaction((tx) => readOverview(tx, actor, eventId), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}

/** Finans sayfası verisi. Kimlik geçersizse ya da etkinlik yoksa 404; yetkisizse `ForbiddenError` yukarı çıkar. */
export async function loadFinancePage(id: string): Promise<FinanceOverview> {
  const actor = await requirePolicyActor();
  if (!isUuid(id)) notFound();
  try {
    return await getFinanceOverview(db, actor, id);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}
