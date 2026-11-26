import type { EventStatus } from "@/domain/event-status";
import type { PlanningStage } from "@/domain/planning-stage";
import type { SaleState } from "@/features/sales-api/contract";

export type SaleStateInput = {
  planningStage: PlanningStage;
  status: EventStatus;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  providerActive: boolean;
  now: Date;
};

/** `null` = satış yüzeyinde görünmez. */
export function saleStateOf(input: SaleStateInput): SaleState | null {
  const { planningStage, status, saleStartsAt, saleEndsAt, providerActive, now } = input;
  if (planningStage !== "on_sale" && planningStage !== "sales_closed") return null;
  if (status !== "published" && status !== "active") return null;
  if (planningStage === "sales_closed") return "closed";
  if (saleStartsAt && now < saleStartsAt) return "not_started";
  if (saleEndsAt && now >= saleEndsAt) return "ended";
  if (!providerActive) return "closed";
  return "open";
}
