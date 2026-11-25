import { and, asc, eq, gte, sql, type SQL } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventTables, events, teams } from "@/db/schema";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { seesOnlyOwnEvents } from "@/features/auth/scope";

type Executor = Db | Tx;

const LIMIT = 100;

export type FnbEventRow = {
  id: string;
  name: string;
  startsAt: Date;
  hasLayout: boolean;
  teamCount: number;
};

/**
 * F&B etkinlik listesi: yaklaşan etkinlikler, tarihe göre. Salon yerleşimi (en az bir masa) ve
 * ekip sayısı özetlenir. `venues:view` ve `events:view` ister (liste etkinlikleri gösterir).
 */
export async function listEventsForFnb(db: Executor, actor: Actor): Promise<FnbEventRow[]> {
  authorize(actor, "venues", "view");
  authorize(actor, "events", "view");
  const conditions: SQL[] = [gte(events.startsAt, new Date())];
  if (seesOnlyOwnEvents(actor)) conditions.push(eq(events.organizerId, actor.id));

  const tableCount = sql<number>`(select count(*)::int from ${eventTables} where ${eventTables.eventId} = "events"."id")`;
  const teamCount = sql<number>`(select count(*)::int from ${teams} where ${teams.eventId} = "events"."id")`;

  const rows = await db
    .select({ id: events.id, name: events.name, startsAt: events.startsAt, tableCount, teamCount })
    .from(events)
    .where(and(...conditions))
    .orderBy(asc(events.startsAt), asc(events.id))
    .limit(LIMIT);
  return rows.map(({ tableCount: tables, ...row }) => ({ ...row, hasLayout: tables > 0 }));
}
