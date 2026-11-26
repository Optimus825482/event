import { and, eq, isNotNull } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventSeatPrices, events } from "@/db/schema";
import { SALE_CATEGORIES, type SaleCategory } from "@/domain/seating";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { publish } from "@/features/realtime/publish";
import { DomainError } from "@/lib/action";
import { fromMinor, toMinor } from "./money";
import type { CoefficientsInput, FinalPricesInput } from "./price-schemas";
import { sellableSeatsByCategory } from "./seats";

const MESSAGES = {
  notFound: "Etkinlik bulunamadı",
  frozen: "Tamamlanmış veya iptal edilmiş etkinliğin fiyatı değiştirilemez",
} as const;

async function lockEditableEvent(tx: Tx, eventId: string): Promise<void> {
  const [event] = await tx.select({ status: events.status }).from(events).where(eq(events.id, eventId)).for("update");
  if (!event) throw new DomainError("not_found", MESSAGES.notFound);
  if (event.status === "completed" || event.status === "cancelled") {
    throw new DomainError("conflict", MESSAGES.frozen);
  }
}

/** Kategori katsayılarını kaydeder; yalnızca `coefficient` (+ `updated_at`) yazılır. */
export async function saveCoefficients(db: Db, actor: Actor, input: CoefficientsInput): Promise<void> {
  authorize(actor, "finance", "edit");
  await db.transaction(async (tx) => {
    await lockEditableEvent(tx, input.eventId);
    for (const category of SALE_CATEGORIES) {
      const coefficient = input.coefficients[category];
      await tx
        .insert(eventSeatPrices)
        .values({ eventId: input.eventId, category, coefficient })
        .onConflictDoUpdate({
          target: [eventSeatPrices.eventId, eventSeatPrices.category],
          set: { coefficient, updatedAt: new Date() },
        });
    }
  });
}

/** Verilen kategorilerin kesin fiyatını kaydeder; yalnızca `final_price` ve kim/ne zaman yazılır. */
export async function saveFinalPrices(db: Db, actor: Actor, input: FinalPricesInput): Promise<void> {
  authorize(actor, "finance", "edit");
  await db.transaction(async (tx) => {
    await lockEditableEvent(tx, input.eventId);
    const now = new Date();
    for (const category of SALE_CATEGORIES) {
      const value = input.prices[category];
      if (value === undefined) continue;
      const finalPrice = fromMinor(toMinor(value));
      await tx
        .insert(eventSeatPrices)
        .values({ eventId: input.eventId, category, finalPrice, finalSetBy: actor.id, finalSetAt: now })
        .onConflictDoUpdate({
          target: [eventSeatPrices.eventId, eventSeatPrices.category],
          set: { finalPrice, finalSetBy: actor.id, finalSetAt: now, updatedAt: now },
        });
    }
    await publish(tx, { type: "sales.changed", eventId: input.eventId });
  });
}

/** Satılabilir sandalyesi olup kesin fiyatı girilmemiş kategoriler (loca dahil), sabit sırayla. */
export async function categoriesMissingFinalPrice(ex: Db | Tx, eventId: string): Promise<SaleCategory[]> {
  const seats = await sellableSeatsByCategory(ex, eventId, { includeLoca: true });
  const priced = await ex
    .select({ category: eventSeatPrices.category })
    .from(eventSeatPrices)
    .where(and(eq(eventSeatPrices.eventId, eventId), isNotNull(eventSeatPrices.finalPrice)));
  const have = new Set(priced.map((r) => r.category));
  return SALE_CATEGORIES.filter((c) => seats[c] > 0 && !have.has(c));
}
