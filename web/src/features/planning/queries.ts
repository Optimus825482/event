import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { can } from "@/features/auth/policy";
import { DomainError } from "@/lib/action";
import { isUuid } from "@/lib/identifiers";
import { getPlanningState, type PlanningState } from "./stage-service";

/**
 * Sayfalardaki aşama paneli verisi. Aktör `events:view` sahibi değilse ya da etkinlik görünmüyorsa
 * `null` döner (panel hiç çizilmez); sayfanın kendi yükleyicisi 404'ü zaten üretir.
 */
export async function loadPlanningPanel(eventId: string): Promise<PlanningState | null> {
  const actor = await requirePolicyActor();
  if (!can(actor, "events", "view") || !isUuid(eventId)) return null;
  try {
    return await getPlanningState(db, actor, eventId);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") return null;
    throw error;
  }
}
