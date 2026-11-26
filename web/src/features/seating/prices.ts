import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventSeatPrices } from "@/db/schema";
import { SALE_CATEGORIES, type SaleCategory } from "@/domain/seating";

export type SeatPrice = { finalPrice: string | null; recommendedPrice: string | null; coefficient: string };

/** Kategori başına sandalye fiyatları; satırı olmayan kategori boş fiyat ve 1.000 katsayı alır. */
export async function getSeatPrices(ex: Db | Tx, eventId: string): Promise<Record<SaleCategory, SeatPrice>> {
  const rows = await ex.select().from(eventSeatPrices).where(eq(eventSeatPrices.eventId, eventId));
  const result = {} as Record<SaleCategory, SeatPrice>;
  for (const category of SALE_CATEGORIES) {
    const row = rows.find((r) => r.category === category);
    result[category] = row
      ? { finalPrice: row.finalPrice, recommendedPrice: row.recommendedPrice, coefficient: row.coefficient }
      : { finalPrice: null, recommendedPrice: null, coefficient: "1.000" };
  }
  return result;
}
