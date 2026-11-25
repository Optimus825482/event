import { eq, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventTables, tableGroups } from "@/db/schema";
import type { EventStatus } from "@/domain/event-status";
import type { PlanningStage } from "@/domain/planning-stage";

export const PRECONDITION_MESSAGES = {
  noTables: "Yerleşimde en az bir masa olmalı",
  noTableGroups: "En az bir masa grubu oluşturulmalı",
  notSellable: "Satış yalnızca yayımlanmış ya da aktif etkinlikte açılabilir",
} as const;

async function exists(ex: Db | Tx, table: typeof eventTables | typeof tableGroups, eventId: string): Promise<boolean> {
  const [row] = await ex
    .select({ one: sql<number>`1` })
    .from(table)
    .where(eq(table.eventId, eventId))
    .limit(1);
  return row !== undefined;
}

/**
 * `to` aşamasına (ileri ya da yeniden açma) ulaşmak için karşılanmamış önkoşullar; boş dizi = geçilebilir.
 * "Masalar sınıflandı", "Casino tahsisi tamam" ve "Fiyatlandı" bu fazda elle onaydır (önkoşulsuz);
 * Faz 4–5 kendi kurallarını buraya ekler.
 */
export async function checkPreconditions(
  ex: Db | Tx,
  event: { id: string; status: EventStatus },
  to: PlanningStage,
): Promise<string[]> {
  switch (to) {
    case "layout_ready":
      return (await exists(ex, eventTables, event.id)) ? [] : [PRECONDITION_MESSAGES.noTables];
    case "staffing_ready":
      return (await exists(ex, tableGroups, event.id)) ? [] : [PRECONDITION_MESSAGES.noTableGroups];
    case "on_sale":
      return event.status === "published" || event.status === "active" ? [] : [PRECONDITION_MESSAGES.notSellable];
    default:
      return [];
  }
}
