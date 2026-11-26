import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { eventFinanceItems, eventFinancePlans } from "@/db/schema";
import type { CasinoCostMode } from "@/features/finance/constants";

type Db = Pick<NodePgDatabase<typeof schema>, "insert" | "select">;

/** Varsayılanlarla bir finans kalemi ekler (gider, prodüksiyon, 1000.00). */
export async function createFinanceItem(
  ex: Pick<Db, "insert">,
  eventId: string,
  o: Partial<typeof eventFinanceItems.$inferInsert> = {},
): Promise<typeof eventFinanceItems.$inferSelect> {
  const [row] = await ex
    .insert(eventFinanceItems)
    .values({
      direction: "expense",
      category: "production",
      label: `Kalem ${randomUUID().slice(0, 8)}`,
      estimatedAmount: "1000.00",
      ...o,
      eventId,
    })
    .returning();
  if (!row) throw new Error("finans kalemi eklenemedi");
  return row;
}

/** Etkinliğin finans planını oluşturur ya da verilen alanlarını günceller. */
export async function setFinancePlan(
  ex: Pick<Db, "insert">,
  eventId: string,
  patch: Partial<{ targetProfit: string; casinoCostMode: CasinoCostMode; casinoTransferPrice: string }>,
): Promise<void> {
  const insert = ex.insert(eventFinancePlans).values({ ...patch, eventId });
  if (Object.keys(patch).length === 0) {
    await insert.onConflictDoNothing();
    return;
  }
  await insert.onConflictDoUpdate({ target: eventFinancePlans.eventId, set: patch });
}

/** Etkinliğin kalemleri, `sort_order` sonra `created_at` sırasıyla. */
export async function listFinanceItems(
  ex: Pick<Db, "select">,
  eventId: string,
): Promise<(typeof eventFinanceItems.$inferSelect)[]> {
  return ex
    .select()
    .from(eventFinanceItems)
    .where(eq(eventFinanceItems.eventId, eventId))
    .orderBy(asc(eventFinanceItems.sortOrder), asc(eventFinanceItems.createdAt));
}
