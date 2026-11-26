import { inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Tx } from "@/db/client";
import type * as schema from "@/db/schema";
import { eventSaleSettings, eventSeatPrices, eventTables } from "@/db/schema";
import type { SaleCategory, TableAllocation } from "@/domain/seating";
import { syncSeatSlots } from "@/features/seating/slots";
import type { SaleSettings } from "@/features/seating/settings-service";

type Db = Pick<NodePgDatabase<typeof schema>, "insert" | "update">;

/** Masaların tahsisini doğrudan günceller; yuva yaratmaz/silmez. Yalnızca test kurulumu içindir. */
export async function setAllocation(
  ex: Pick<Db, "update">,
  tableIds: string[],
  allocation: TableAllocation,
): Promise<void> {
  if (tableIds.length === 0) return;
  await ex.update(eventTables).set({ allocation }).where(inArray(eventTables.id, tableIds));
}

/** Kategori başına kesin fiyatı yazar (varsa günceller). */
export async function setFinalPrices(
  ex: Pick<Db, "insert">,
  eventId: string,
  prices: Partial<Record<SaleCategory, string>>,
): Promise<void> {
  const rows = (Object.entries(prices) as [SaleCategory, string | undefined][])
    .filter((e): e is [SaleCategory, string] => e[1] !== undefined)
    .map(([category, finalPrice]) => ({ eventId, category, finalPrice }));
  if (rows.length === 0) return;
  await ex
    .insert(eventSeatPrices)
    .values(rows)
    .onConflictDoUpdate({
      target: [eventSeatPrices.eventId, eventSeatPrices.category],
      set: { finalPrice: sql`excluded.final_price` },
    });
}

/** Etkinliğin satış ayarı satırını yazar (varsa verilen alanları günceller). */
export async function setSaleSettings(
  ex: Pick<Db, "insert">,
  eventId: string,
  patch: Partial<SaleSettings>,
): Promise<void> {
  // Satır kimliği her zaman parametredeki etkinliktir; yamadaki `eventId` yok sayılır.
  const fields = { ...patch };
  delete fields.eventId;
  const insert = ex.insert(eventSaleSettings).values({ ...fields, eventId });
  if (Object.keys(fields).length === 0) {
    await insert.onConflictDoNothing({ target: eventSaleSettings.eventId });
    return;
  }
  await insert.onConflictDoUpdate({ target: eventSaleSettings.eventId, set: fields });
}

/** Masaları online satışa açar: tahsisi `online` yapar ve sandalye yuvalarını eşitler. */
export async function openOnline(tx: Tx, eventId: string, tableIds: string[]): Promise<void> {
  await setAllocation(tx, tableIds, "online");
  await syncSeatSlots(tx, eventId, tableIds);
}
