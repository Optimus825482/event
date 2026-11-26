import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventTables } from "@/db/schema";
import { SALE_CATEGORIES, type SaleCategory } from "@/domain/seating";

/** Kategori başına satılabilir sandalye (yalnızca online/pending masalar; null satılabilir = kapasite). */
export async function sellableSeatsByCategory(
  ex: Db | Tx,
  eventId: string,
  opts: { includeLoca: boolean },
): Promise<Record<SaleCategory, number>> {
  const conditions = [eq(eventTables.eventId, eventId), inArray(eventTables.allocation, ["online", "pending"])];
  if (!opts.includeLoca) conditions.push(eq(eventTables.isLoca, false));
  const rows = await ex
    .select({
      category: eventTables.saleCategory,
      total: sql<number>`coalesce(sum(coalesce(${eventTables.sellableSeats}, ${eventTables.capacity})), 0)::int`,
    })
    .from(eventTables)
    .where(and(...conditions))
    .groupBy(eventTables.saleCategory);
  const result = { standard: 0, premium: 0, vip: 0 } as Record<SaleCategory, number>;
  for (const category of SALE_CATEGORIES) {
    result[category] = rows.find((r) => r.category === category)?.total ?? 0;
  }
  return result;
}

/** Casino tahsisli masaların toplam kapasitesi (satılabilir sayı değil). */
export async function casinoCapacity(ex: Db | Tx, eventId: string): Promise<number> {
  const [row] = await ex
    .select({ total: sql<number>`coalesce(sum(${eventTables.capacity}), 0)::int` })
    .from(eventTables)
    .where(and(eq(eventTables.eventId, eventId), eq(eventTables.allocation, "casino")));
  return row?.total ?? 0;
}
