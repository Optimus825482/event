import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { eventFinanceItems, events } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { CATEGORIES_BY_DIRECTION } from "./constants";
import type { CreateFinanceItemInput, UpdateFinanceItemInput } from "./schemas";

export type FinanceItemRow = typeof eventFinanceItems.$inferSelect;

const CATEGORY_MISMATCH = "Bu kategori seçilen yön için geçerli değil";
const ITEM_NOT_FOUND = "Kalem bulunamadı";

/** Kalem ekler (`finance` oluşturma izni); sıra etkinlikteki en büyük + 1'dir. */
export async function createFinanceItem(db: Db, actor: Actor, input: CreateFinanceItemInput): Promise<FinanceItemRow> {
  authorize(actor, "finance", "create");

  return db.transaction(async (tx) => {
    // Etkinlik satırı kilidi eşzamanlı eklemelerin aynı sırayı almasını önler.
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId)).for("update");
    if (!event) throw new DomainError("not_found", "Etkinlik bulunamadı");

    const [last] = await tx
      .select({ max: sql<number>`coalesce(max(${eventFinanceItems.sortOrder}), 0)::int` })
      .from(eventFinanceItems)
      .where(eq(eventFinanceItems.eventId, input.eventId));

    const [row] = await tx
      .insert(eventFinanceItems)
      .values({
        eventId: input.eventId,
        direction: input.direction,
        category: input.category,
        label: input.label,
        estimatedAmount: input.estimatedAmount,
        actualAmount: input.actualAmount,
        note: input.note,
        sortOrder: (last?.max ?? 0) + 1,
        createdBy: actor.id,
      })
      .returning();
    if (!row) throw new Error("finans kalemi eklenemedi");
    return row;
  });
}

/** Kalemi günceller; yön değişmez. Etkinlik durumuna bakılmaz (gerçekleşen tutarlar sonradan girilir). */
export async function updateFinanceItem(db: Db, actor: Actor, input: UpdateFinanceItemInput): Promise<FinanceItemRow> {
  authorize(actor, "finance", "edit");

  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({ eventId: eventFinanceItems.eventId })
      .from(eventFinanceItems)
      .where(eq(eventFinanceItems.id, input.id));
    if (!found) throw new DomainError("not_found", ITEM_NOT_FOUND);
    // Etkinlik kilidi önce (tüm yazıcılarla aynı sıra); `computeRecommendation` tutarlı okuma için buna dayanır.
    await tx.select({ id: events.id }).from(events).where(eq(events.id, found.eventId)).for("update");
    const [item] = await tx.select().from(eventFinanceItems).where(eq(eventFinanceItems.id, input.id)).for("update");
    if (!item) throw new DomainError("not_found", ITEM_NOT_FOUND);
    if (!CATEGORIES_BY_DIRECTION[item.direction].includes(input.category)) {
      throw new DomainError("invalid", CATEGORY_MISMATCH);
    }

    const [row] = await tx
      .update(eventFinanceItems)
      .set({
        category: input.category,
        label: input.label,
        estimatedAmount: input.estimatedAmount,
        actualAmount: input.actualAmount,
        note: input.note,
        updatedAt: new Date(),
      })
      .where(eq(eventFinanceItems.id, input.id))
      .returning();
    if (!row) throw new DomainError("not_found", ITEM_NOT_FOUND);
    return row;
  });
}

export async function deleteFinanceItem(
  db: Db,
  actor: Actor,
  input: { id: string },
): Promise<{ id: string; eventId: string }> {
  authorize(actor, "finance", "delete");

  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({ eventId: eventFinanceItems.eventId })
      .from(eventFinanceItems)
      .where(eq(eventFinanceItems.id, input.id));
    if (!found) throw new DomainError("not_found", ITEM_NOT_FOUND);
    // Etkinlik kilidi: eşzamanlı tavsiye hesabı silinen kalemi yarım görmesin.
    await tx.select({ id: events.id }).from(events).where(eq(events.id, found.eventId)).for("update");
    const [row] = await tx
      .delete(eventFinanceItems)
      .where(eq(eventFinanceItems.id, input.id))
      .returning({ id: eventFinanceItems.id, eventId: eventFinanceItems.eventId });
    if (!row) throw new DomainError("not_found", ITEM_NOT_FOUND);
    return row;
  });
}
