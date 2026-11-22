import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { requirePolicyActor } from "@/features/auth/permissions";
import { authorize, can } from "@/features/auth/policy";
import { DomainError } from "@/lib/action";
import { eventStats, getCheckInEvent, listCheckInEvents } from "./read-service";
import { isUuid } from "@/lib/identifiers";

/** `/check-in`: devam eden ve bugünkü etkinlikler önde. */
export async function loadCheckInEvents() {
  const actor = await requirePolicyActor();
  authorize(actor, "check_in", "view");
  return listCheckInEvents(db, actor);
}

/** `/check-in/[eventId]`: etkinlik başlığı, yazma yetkisi ve ilk istatistikler (sonrası canlı). */
export async function loadCheckInConsole(eventId: string) {
  const actor = await requirePolicyActor();
  authorize(actor, "check_in", "view");
  if (!isUuid(eventId)) notFound();
  try {
    const [event, stats] = await Promise.all([getCheckInEvent(db, actor, eventId), eventStats(db, actor, eventId)]);
    return { userId: actor.id, event, stats, canWrite: can(actor, "check_in", "create") };
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}
