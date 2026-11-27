import { and, eq, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events, tickets } from "@/db/schema";
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
  // Tek sorgu (tek anlık görüntü): toplam ve kategori kırılımı aynı satırlardan türer, birbirinden sapmaz.
  const rows = await ex
    .select({
      isDemo: events.isDemo,
      category: sql<SaleCategory | null>`${tickets.saleCategory}`,
      issued: sql<number>`count(*)::int`,
      revenue: sumOf(sql`sum(${tickets.unitPrice})`),
      checkedIn: sql<number>`count(${tickets.checkedInAt})::int`,
    })
    .from(tickets)
    .innerJoin(events, eq(events.id, tickets.eventId))
    .where(and(eq(tickets.eventId, eventId), eq(tickets.status, "issued")))
    .groupBy(
      sql`grouping sets ((${events.isDemo}, ${tickets.saleCategory}), (${events.isDemo}))`,
    );

  const byCategory = Object.fromEntries(
    SALE_CATEGORIES.map((c) => [c, { issued: 0, revenue: "0.00" }]),
  ) as SalesTotals["byCategory"];
  const totals = {
    real: { issued: 0, revenue: "0.00" },
    demo: { issued: 0, revenue: "0.00" },
  };
  let checkedIn = 0;
  for (const r of rows) {
    if (r.category !== null) {
      if (!r.isDemo)
        byCategory[r.category] = { issued: r.issued, revenue: r.revenue };
      continue;
    }
    // Kategorisiz satır = o grubun (gerçek/demo) toplamı.
    totals[r.isDemo ? "demo" : "real"] = {
      issued: r.issued,
      revenue: r.revenue,
    };
    checkedIn += r.checkedIn;
  }
  return {
    issued: totals.real.issued,
    revenue: totals.real.revenue,
    demoIssued: totals.demo.issued,
    demoRevenue: totals.demo.revenue,
    checkedIn,
    byCategory,
  };
}
