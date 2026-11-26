import { and, eq, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { orders, tickets } from "@/db/schema";
import { SALE_CATEGORIES, type SaleCategory } from "@/domain/seating";

export type SalesTotals = {
  issued: number;
  revenue: string;
  demoIssued: number;
  demoRevenue: string;
  checkedIn: number;
  byCategory: Record<SaleCategory, { issued: number; revenue: string }>;
};

/** `numeric` toplamı, boşsa `0.00`; her zaman iki ondalıklı dizge. */
const sumOf = (expr: ReturnType<typeof sql>) =>
  sql<string>`coalesce(${expr}, 0)::numeric(12,2)::text`;

/**
 * Etkinliğin satış toplamları; yalnızca `issued` biletler. Gerçek/demo ayrı sayılır, kategori kırılımı demo
 * içermez, `checkedIn` demo dahildir. Tutarlar SQL `numeric` toplamıdır.
 */
export async function getSalesTotals(
  ex: Db | Tx,
  eventId: string,
): Promise<SalesTotals> {
  const issuedOfEvent = and(
    eq(tickets.eventId, eventId),
    eq(tickets.status, "issued"),
  );

  const [totals] = await ex
    .select({
      issued: sql<number>`(count(*) filter (where ${orders.isDemo} = false))::int`,
      revenue: sumOf(
        sql`sum(${tickets.unitPrice}) filter (where ${orders.isDemo} = false)`,
      ),
      demoIssued: sql<number>`(count(*) filter (where ${orders.isDemo} = true))::int`,
      demoRevenue: sumOf(
        sql`sum(${tickets.unitPrice}) filter (where ${orders.isDemo} = true)`,
      ),
      checkedIn: sql<number>`count(${tickets.checkedInAt})::int`,
    })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .where(issuedOfEvent);

  const categoryRows = await ex
    .select({
      category: tickets.saleCategory,
      issued: sql<number>`count(*)::int`,
      revenue: sumOf(sql`sum(${tickets.unitPrice})`),
    })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .where(and(issuedOfEvent, eq(orders.isDemo, false)))
    .groupBy(tickets.saleCategory);

  const byCategory = Object.fromEntries(
    SALE_CATEGORIES.map((c) => [c, { issued: 0, revenue: "0.00" }]),
  ) as SalesTotals["byCategory"];
  for (const r of categoryRows)
    byCategory[r.category] = { issued: r.issued, revenue: r.revenue };

  return {
    issued: totals?.issued ?? 0,
    revenue: totals?.revenue ?? "0.00",
    demoIssued: totals?.demoIssued ?? 0,
    demoRevenue: totals?.demoRevenue ?? "0.00",
    checkedIn: totals?.checkedIn ?? 0,
    byCategory,
  };
}
