"use client";

import { useState } from "react";
import { SALE_CATEGORIES } from "@/domain/seating";
import type { FinanceOverview } from "../overview";
import { summaryCards } from "../view-model";
import { ItemsSection } from "./items-section";
import { PlanForm } from "./plan-form";
import { PricingSection, type ComputedRecommendation } from "./pricing-section";

/** Finans ekranı gövdesi: özet, kalemler, hedef/Casino payı ve fiyatlandırma. */
export function FinanceView({ overview }: { overview: FinanceOverview }) {
  const [computed, setComputed] = useState<ComputedRecommendation | null>(null);
  const cards = summaryCards(overview);
  // Sunucu verisi yenilenince formlar kayıtlı değerlerle yeniden kurulur.
  const planKey = [overview.plan.targetProfit, overview.plan.casinoCostMode, overview.plan.casinoTransferPrice].join("|");
  const pricingKey = JSON.stringify([
    SALE_CATEGORIES.map((c) => [overview.seatPrices[c].coefficient, overview.seatPrices[c].finalPrice]),
    overview.pricesLocked,
    overview.permissions.edit,
  ]);

  return (
    <div className="min-w-0 space-y-6">
      <section
        role="region"
        aria-label="Özet"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {cards.map((card) => (
          <div key={card.key} className="rounded-xl border border-border bg-card p-4 text-card-foreground">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{card.value}</p>
          </div>
        ))}
      </section>
      <ItemsSection overview={overview} />
      <PlanForm key={planKey} overview={overview} />
      <PricingSection key={pricingKey} overview={overview} computed={computed} onComputed={setComputed} />
    </div>
  );
}
