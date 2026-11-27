import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { type ArchiveDetails, eventArchives } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { escapeLike, isUuid } from "@/lib/identifiers";
import { archiveRates, type ArchiveRates } from "./metrics";
import { addMoney, subMoney } from "./money";

// Okuma işlevleri yalnızca `event_archives`'ı sorgular; tek istisna demo etkinlikleri listelerden/raporlardan ayıran `realArchivesOnly`'dir.

/** Demo etkinliklerin arşiv satırlarını liste ve raporlardan ayıklar. */
export function realArchivesOnly(): SQL {
  return sql`not exists (select 1 from events e where e.id = ${eventArchives.eventId} and e.is_demo)`;
}

export type ArchiveRow = typeof eventArchives.$inferSelect;
export type ArchiveSummary = ArchiveRow & { rates: ArchiveRates; netActual: string; hasDemo: boolean };

const PAGE_SIZE = 20;
const NOT_FOUND = "Arşiv kaydı bulunamadı";

/** `details` sütununun veritabanı varsayılanı `{}`'dir; eksik diziler `[]` ile tamamlanır. */
function normalizeDetails(details: Partial<ArchiveDetails> | null | undefined): ArchiveDetails {
  return {
    categories: details?.categories ?? [],
    financeItems: details?.financeItems ?? [],
    gates: details?.gates ?? [],
  };
}

/** Net (gerçekleşen) = bilet geliri + diğer gelir − gider; demo hariç, saklanmaz (Karar 17). */
export function toArchiveSummary(row: ArchiveRow): ArchiveSummary {
  return { ...toArchiveListRow(row), details: normalizeDetails(row.details) };
}

/** `details` (ağır JSON) olmadan özet; dönem raporu gibi yalnızca sayısal sütun okuyanlar için. */
export type ArchiveListRow = Omit<ArchiveSummary, "details">;

export function toArchiveListRow(row: Omit<ArchiveRow, "details"> & { details?: unknown }): ArchiveListRow {
  const { details, ...rest } = row;
  void details;
  return {
    ...rest,
    rates: archiveRates(row),
    netActual: subMoney(addMoney(row.ticketRevenue, row.actualOtherIncome), row.actualExpense),
    hasDemo: row.demoTicketsSold > 0,
  };
}

export async function listArchives(
  ex: Db | Tx,
  actor: Actor,
  filter: { search?: string; page?: number } = {},
): Promise<{ items: ArchiveSummary[]; total: number; page: number; pageSize: number }> {
  authorize(actor, "archive", "view");
  const page = filter.page && Number.isInteger(filter.page) && filter.page > 0 ? filter.page : 1;
  const term = filter.search?.trim();
  const searchWhere: SQL | undefined = term
    ? or(
        ilike(eventArchives.eventName, `%${escapeLike(term)}%`),
        ilike(eventArchives.artistName, `%${escapeLike(term)}%`),
      )
    : undefined;
  const where = searchWhere ? and(realArchivesOnly(), searchWhere) : realArchivesOnly();

  // Aynı istemcide sıralı beklenir.
  const [totalRow] = await ex.select({ value: count() }).from(eventArchives).where(where);
  const rows = await ex
    .select()
    .from(eventArchives)
    .where(where)
    .orderBy(desc(eventArchives.startsAt), desc(eventArchives.eventId))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return { items: rows.map(toArchiveSummary), total: totalRow?.value ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getArchiveView(ex: Db | Tx, actor: Actor, eventId: string): Promise<ArchiveSummary> {
  authorize(actor, "archive", "view");
  if (!isUuid(eventId)) throw new DomainError("not_found", NOT_FOUND);
  const [row] = await ex.select().from(eventArchives).where(eq(eventArchives.eventId, eventId));
  if (!row) throw new DomainError("not_found", NOT_FOUND);
  return toArchiveSummary(row);
}
