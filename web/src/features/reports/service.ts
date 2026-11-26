import { and, asc, gte, lt } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventArchives } from "@/db/schema";
import { type ArchiveSummary, toArchiveSummary } from "@/features/archive/read";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { type PeriodInput, periodBounds } from "./period";
import { type CurrencyTotals, totalsByCurrency } from "./totals";

export type PeriodReport = { from: string; to: string; rows: ArchiveSummary[]; totals: CurrencyTotals[] };

/** Dönem raporu: yalnızca `event_archives`, `starts_at`'e göre; `from`/`to` Kıbrıs günleri, ikisi de dahil (Karar 15). */
export async function getPeriodReport(ex: Db | Tx, actor: Actor, input: PeriodInput): Promise<PeriodReport> {
  authorize(actor, "archive", "view");
  const { start, endExclusive } = periodBounds(input);
  const rows = (
    await ex
      .select()
      .from(eventArchives)
      .where(and(gte(eventArchives.startsAt, start), lt(eventArchives.startsAt, endExclusive)))
      .orderBy(asc(eventArchives.startsAt), asc(eventArchives.eventId))
  ).map(toArchiveSummary);
  return { from: input.from, to: input.to, rows, totals: totalsByCurrency(rows) };
}
