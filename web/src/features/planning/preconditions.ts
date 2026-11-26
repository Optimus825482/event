import { and, eq, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventTables, tableGroups } from "@/db/schema";
import type { EventStatus } from "@/domain/event-status";
import type { PlanningStage } from "@/domain/planning-stage";
import { SALE_CATEGORY_LABELS } from "@/domain/seating";
import { categoriesMissingFinalPrice } from "@/features/finance/price-service";

export const PRECONDITION_MESSAGES = {
  noTables: "Yerleşimde en az bir masa olmalı",
  noTableGroups: "En az bir masa grubu oluşturulmalı",
  notSellable: "Satış yalnızca yayımlanmış ya da aktif etkinlikte açılabilir",
  noOnlineTables: "Satışa açık en az bir masa olmalı",
  missingFinalPrice: (labels: readonly string[]) => `Kesin fiyatı girilmemiş kategori var: ${labels.join(", ")}`,
} as const;

async function exists(ex: Db | Tx, table: typeof eventTables | typeof tableGroups, eventId: string): Promise<boolean> {
  const [row] = await ex
    .select({ one: sql<number>`1` })
    .from(table)
    .where(eq(table.eventId, eventId))
    .limit(1);
  return row !== undefined;
}

async function hasOnlineTable(ex: Db | Tx, eventId: string): Promise<boolean> {
  const [row] = await ex
    .select({ one: sql<number>`1` })
    .from(eventTables)
    .where(and(eq(eventTables.eventId, eventId), eq(eventTables.allocation, "online")))
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
    case "on_sale": {
      const blockers: string[] = [];
      if (event.status !== "published" && event.status !== "active") blockers.push(PRECONDITION_MESSAGES.notSellable);
      if (!(await hasOnlineTable(ex, event.id))) blockers.push(PRECONDITION_MESSAGES.noOnlineTables);
      return blockers;
    }
    case "priced": {
      const missing = await categoriesMissingFinalPrice(ex, event.id);
      return missing.length === 0
        ? []
        : [PRECONDITION_MESSAGES.missingFinalPrice(missing.map((c) => SALE_CATEGORY_LABELS[c]))];
    }
    default:
      return [];
  }
}
