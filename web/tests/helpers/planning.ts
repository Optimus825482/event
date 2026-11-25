import { desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { eventStageTransitions, events } from "@/db/schema";
import type { PlanningStage } from "@/domain/planning-stage";

type Db = Pick<NodePgDatabase<typeof schema>, "select" | "update">;

/** Doğrudan günceller; yalnızca test kurulumu içindir (geçiş kuralları atlanır). */
export async function setStage(ex: Pick<Db, "update">, eventId: string, stage: PlanningStage): Promise<void> {
  await ex.update(events).set({ planningStage: stage }).where(eq(events.id, eventId));
}

/** Etkinliğin geçiş geçmişi, en yeni önce. */
export async function listTransitions(
  ex: Pick<Db, "select">,
  eventId: string,
): Promise<(typeof eventStageTransitions.$inferSelect)[]> {
  return ex
    .select()
    .from(eventStageTransitions)
    .where(eq(eventStageTransitions.eventId, eventId))
    .orderBy(desc(eventStageTransitions.createdAt));
}
