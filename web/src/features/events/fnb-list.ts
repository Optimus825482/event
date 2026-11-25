import { asc, gte, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventTables, events, teams } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { PlanningStage } from "@/domain/planning-stage";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import type { Actor } from "@/features/auth/session";

type Executor = Db | Tx;

/** Listenin üst sınırı; aşılırsa `truncated` bildirilir. */
export const FNB_LIST_LIMIT = 100;

export type FnbEventRow = {
  id: string;
  name: string;
  startsAt: Date;
  hasLayout: boolean;
  planningStage: PlanningStage;
  teamCount: number;
};

export type FnbEventList = { rows: FnbEventRow[]; truncated: boolean };

/**
 * F&B etkinlik listesi: bugün (APP_TIME_ZONE) ve sonrası başlayan etkinlikler, tarihe göre; böylece
 * başlamış bir etkinlik, ekibin çalıştığı gece listeden düşmez. Salon yerleşimi (en az bir masa) ve
 * ekip sayısı özetlenir. `venues:view` ve `events:view` ister (liste etkinlikleri gösterir).
 */
export async function listEventsForFnb(db: Executor, actor: Actor): Promise<FnbEventList> {
  authorize(actor, "venues", "view");
  authorize(actor, "events", "view");

  // Bugünün başlangıcı iş saat diliminde (yaz/kış saati Postgres tarafından çözülür).
  const dayStart = sql`(date_trunc('day', now() at time zone ${APP_TIME_ZONE}::text) at time zone ${APP_TIME_ZONE}::text)`;

  const tableCount = sql<number>`(select count(*)::int from ${eventTables} where ${eventTables.eventId} = "events"."id")`;
  const teamCount = sql<number>`(select count(*)::int from ${teams} where ${teams.eventId} = "events"."id")`;

  const rows = await db
    .select({ id: events.id, name: events.name, startsAt: events.startsAt, planningStage: events.planningStage, tableCount, teamCount })
    .from(events)
    .where(gte(events.startsAt, dayStart))
    .orderBy(asc(events.startsAt), asc(events.id))
    .limit(FNB_LIST_LIMIT + 1);
  const truncated = rows.length > FNB_LIST_LIMIT;
  return {
    rows: rows.slice(0, FNB_LIST_LIMIT).map(({ tableCount: tables, ...row }) => ({ ...row, hasLayout: tables > 0 })),
    truncated,
  };
}
