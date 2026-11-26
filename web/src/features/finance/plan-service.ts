import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventFinancePlans, events } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import type { CasinoCostMode } from "./constants";
import type { FinancePlanInput } from "./schemas";

export type FinancePlan = {
  eventId: string;
  targetProfit: string;
  casinoCostMode: CasinoCostMode;
  casinoTransferPrice: string;
  recommendedAt: Date | null;
};

/** Finans planını okur; satır yoksa varsayılanlar döner. Yetki denetimi çağırana aittir. */
export async function getFinancePlan(ex: Db | Tx, eventId: string): Promise<FinancePlan> {
  const [row] = await ex.select().from(eventFinancePlans).where(eq(eventFinancePlans.eventId, eventId));
  if (!row) {
    return { eventId, targetProfit: "0.00", casinoCostMode: "free", casinoTransferPrice: "0.00", recommendedAt: null };
  }
  return {
    eventId,
    targetProfit: row.targetProfit,
    casinoCostMode: row.casinoCostMode,
    casinoTransferPrice: row.casinoTransferPrice,
    recommendedAt: row.recommendedAt,
  };
}

/** Hedef kâr ve Casino payı kipini kaydeder; tavsiye zamanına dokunmaz. Etkinlik durumuna bakılmaz. */
export async function saveFinancePlan(db: Db, actor: Actor, input: FinancePlanInput): Promise<FinancePlan> {
  authorize(actor, "finance", "edit");

  return db.transaction(async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId)).for("update");
    if (!event) throw new DomainError("not_found", "Etkinlik bulunamadı");

    const values = {
      targetProfit: input.targetProfit,
      casinoCostMode: input.casinoCostMode,
      casinoTransferPrice: input.casinoTransferPrice,
      updatedBy: actor.id,
    };
    await tx
      .insert(eventFinancePlans)
      .values({ eventId: input.eventId, ...values })
      .onConflictDoUpdate({ target: eventFinancePlans.eventId, set: { ...values, updatedAt: new Date() } });
    return getFinancePlan(tx, input.eventId);
  });
}
