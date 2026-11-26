import { asc, eq, type SQL, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventFinanceItems } from "@/db/schema";
import { getSaleSettings } from "@/features/seating/settings-service";
import type { CasinoCostMode } from "./constants";
import type { FinanceItemRow } from "./items-service";
import { getFinancePlan } from "./plan-service";

/** Sözleşme §4.2 biçimi; Faz 9 arşivi tüketir. */
export type FinanceSummary = {
  currency: string;
  estimatedExpense: string;
  actualExpense: string;
  estimatedOtherIncome: string;
  actualOtherIncome: string;
  artistFee: string | null;
  targetProfit: string;
  casinoCostMode: CasinoCostMode;
  casinoTransferPrice: string;
  items: {
    id: string;
    direction: "expense" | "income";
    category: string;
    label: string;
    estimatedAmount: string;
    actualAmount: string | null;
  }[];
};

/** Etkinliğin kalemleri, `sort_order` sonra `created_at` sırasıyla (düzenleme ekranı için, not dahil). */
export async function getFinanceItems(ex: Db | Tx, eventId: string): Promise<FinanceItemRow[]> {
  return ex
    .select()
    .from(eventFinanceItems)
    .where(eq(eventFinanceItems.eventId, eventId))
    .orderBy(asc(eventFinanceItems.sortOrder), asc(eventFinanceItems.createdAt));
}

/** Finans özeti. Yetki denetimi yoktur; çağıran yapar. Toplamlar SQL `numeric` ile hesaplanır. */
export async function getFinanceSummary(ex: Db | Tx, eventId: string): Promise<FinanceSummary> {
  const i = eventFinanceItems;
  const total = (expr: SQL) => sql<string>`coalesce(${expr}, 0)::numeric(15,2)::text`;
  const [[totals], items, plan, settings] = await Promise.all([
    ex
      .select({
        estimatedExpense: total(sql`sum(${i.estimatedAmount}) filter (where ${i.direction} = 'expense')`),
        actualExpense: total(sql`sum(${i.actualAmount}) filter (where ${i.direction} = 'expense')`),
        estimatedOtherIncome: total(sql`sum(${i.estimatedAmount}) filter (where ${i.direction} = 'income')`),
        actualOtherIncome: total(sql`sum(${i.actualAmount}) filter (where ${i.direction} = 'income')`),
        artistFee: sql<string | null>`(sum(coalesce(${i.actualAmount}, ${i.estimatedAmount})) filter (where ${i.direction} = 'expense' and ${i.category} = 'artist_fee'))::numeric(15,2)::text`,
      })
      .from(i)
      .where(eq(i.eventId, eventId)),
    getFinanceItems(ex, eventId),
    getFinancePlan(ex, eventId),
    getSaleSettings(ex, eventId),
  ]);

  return {
    currency: settings.currency,
    estimatedExpense: totals?.estimatedExpense ?? "0.00",
    actualExpense: totals?.actualExpense ?? "0.00",
    estimatedOtherIncome: totals?.estimatedOtherIncome ?? "0.00",
    actualOtherIncome: totals?.actualOtherIncome ?? "0.00",
    artistFee: totals?.artistFee ?? null,
    targetProfit: plan.targetProfit,
    casinoCostMode: plan.casinoCostMode,
    casinoTransferPrice: plan.casinoTransferPrice,
    items: items.map((row) => ({
      id: row.id,
      direction: row.direction,
      category: row.category,
      label: row.label,
      estimatedAmount: row.estimatedAmount,
      actualAmount: row.actualAmount,
    })),
  };
}
