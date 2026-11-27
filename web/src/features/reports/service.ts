import { and, asc, getTableColumns, gte, lt } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventArchives } from "@/db/schema";
import { type ArchiveListRow, realArchivesOnly, toArchiveListRow } from "@/features/archive/read";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { type PeriodInput, periodBounds, periodSchema } from "./period";
import { type CurrencyTotals, totalsByCurrency } from "./totals";

/** Sayfa, şema hatasında bile yetkisiz kullanıcıyı geri çevirsin diye servis kapısı. */
export function assertCanViewReports(actor: Actor): void {
  authorize(actor, "archive", "view");
}

export type PeriodReport = { from: string; to: string; rows: ArchiveListRow[]; totals: CurrencyTotals[] };

/**
 * Dönem raporu: yalnızca `event_archives`, `starts_at`'e göre; `from`/`to` Kıbrıs günleri, ikisi de dahil (Karar 15).
 * Girdi burada da `periodSchema` ile doğrulanır; geçersizse `ZodError` fırlar. `details` sütunu okunmaz.
 */
export async function getPeriodReport(ex: Db | Tx, actor: Actor, input: PeriodInput): Promise<PeriodReport> {
  authorize(actor, "archive", "view");
  const period = periodSchema.parse(input);
  const { start, endExclusive } = periodBounds(period);
  const { details, ...columns } = getTableColumns(eventArchives);
  void details; // ağır JSON sütunu seçilmez
  const rows = (
    await ex
      .select(columns)
      .from(eventArchives)
      .where(and(gte(eventArchives.startsAt, start), lt(eventArchives.startsAt, endExclusive), realArchivesOnly()))
      .orderBy(asc(eventArchives.startsAt), asc(eventArchives.eventId))
  ).map(toArchiveListRow);
  return { from: period.from, to: period.to, rows, totals: totalsByCurrency(rows) };
}
