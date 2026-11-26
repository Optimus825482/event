import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { eventTables } from "@/db/schema";
import { isLayoutLockedStage } from "@/domain/planning-stage";
import type { SaleCategory } from "@/domain/seating";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { loadCommitments } from "@/features/planning/layout-lock";
import { publish } from "@/features/realtime/publish";
import { lockEvent } from "@/features/reservations/internal";
import { DomainError } from "@/lib/action";
import { syncSeatSlots } from "./slots";

export type ClassifyItem = { tableId: string; category?: SaleCategory; sellableSeats?: number | null };

const byLabel = (a: string, b: string) => a.localeCompare(b, "tr", { numeric: true });

/**
 * Masaların satış kategorisini ve satılabilir sandalye sayısını toplu günceller (atomik).
 * Aşamaya bağlı değildir; yalnızca tamamlanmış/iptal etkinlikte reddedilir. Satış açıkken bileti
 * olan masanın kategorisi değişmez. Kilit sırası: etkinlik `FOR SHARE` → masalar kimlik sırasıyla `FOR UPDATE`.
 */
export async function classifyTables(
  db: Db,
  actor: Actor,
  input: { eventId: string; items: ClassifyItem[] },
): Promise<{ updated: number }> {
  authorize(actor, "ticketing", "edit");

  return db.transaction(async (tx) => {
    const event = await lockEvent(tx, actor, input.eventId, "Etkinlik bulunamadı");
    if (event.status === "completed" || event.status === "cancelled") {
      throw new DomainError("conflict", "Tamamlanmış veya iptal edilmiş etkinlikte masalar sınıflandırılamaz");
    }

    const ids = input.items.map((i) => i.tableId);
    const rows = await tx
      .select({
        id: eventTables.id,
        label: eventTables.label,
        capacity: eventTables.capacity,
        saleCategory: eventTables.saleCategory,
        sellableSeats: eventTables.sellableSeats,
      })
      .from(eventTables)
      .where(and(eq(eventTables.eventId, input.eventId), inArray(eventTables.id, ids)))
      .orderBy(asc(eventTables.id))
      .for("update");
    const own = new Map(rows.map((r) => [r.id, r]));
    if (own.size !== ids.length) throw new DomainError("not_found", "Masa bu etkinlikte bulunamadı");

    const over = input.items
      .filter((i) => i.sellableSeats != null && i.sellableSeats > (own.get(i.tableId)?.capacity ?? 0))
      .map((i) => own.get(i.tableId))
      .filter((r) => r !== undefined);
    if (over.length > 0) {
      const text = over
        .sort((a, b) => byLabel(a.label, b.label))
        .map((r) => `${r.label} (kapasite ${r.capacity})`)
        .join(", ");
      throw new DomainError("conflict", `Satılabilir sandalye kapasiteyi aşamaz: ${text}`);
    }

    // Yalnızca gerçekten değişen satırlar.
    const changes = input.items.flatMap((item) => {
      const row = own.get(item.tableId);
      if (!row) return [];
      const categoryChanged = item.category !== undefined && item.category !== row.saleCategory;
      const sellableChanged = item.sellableSeats !== undefined && item.sellableSeats !== row.sellableSeats;
      if (!categoryChanged && !sellableChanged) return [];
      return [{ row, item, categoryChanged, sellableChanged }];
    });

    if (isLayoutLockedStage(event.planningStage)) {
      const categoryChanging = changes.filter((c) => c.categoryChanged);
      if (categoryChanging.length > 0) {
        const commitments = await loadCommitments(tx, input.eventId);
        const sold = categoryChanging.filter((c) => commitments.get(c.row.id)?.reasons.includes("ticket"));
        if (sold.length > 0) {
          const labels = sold
            .map((c) => c.row.label)
            .sort(byLabel)
            .join(", ");
          throw new DomainError("conflict", `Bileti satılmış masanın kategorisi değiştirilemez: ${labels}`);
        }
      }
    }

    for (const { row, item, categoryChanged, sellableChanged } of changes) {
      await tx
        .update(eventTables)
        .set({
          ...(categoryChanged && item.category ? { saleCategory: item.category } : {}),
          ...(sellableChanged ? { sellableSeats: item.sellableSeats ?? null } : {}),
        })
        .where(eq(eventTables.id, row.id));
    }

    const sellableIds = changes.filter((c) => c.sellableChanged).map((c) => c.row.id);
    await syncSeatSlots(tx, input.eventId, sellableIds);

    if (changes.length > 0) {
      const only = changes.length === 1 ? changes[0]?.row.id : undefined;
      await publish(tx, { type: "seats.changed", eventId: input.eventId, ...(only ? { id: only } : {}) });
    }
    return { updated: changes.length };
  });
}
