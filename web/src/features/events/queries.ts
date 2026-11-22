import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { authorize } from "@/features/auth/policy";
import { requirePolicyActor } from "@/features/auth/permissions";
import { DomainError } from "@/lib/action";
import { listEventsFilterSchema } from "./schemas";
import { getEvent, listEventTables, listEvents } from "./service";

export async function loadEventList(rawFilter: unknown) {
  const actor = await requirePolicyActor();
  authorize(actor, "events", "view");
  const parsed = listEventsFilterSchema.safeParse(rawFilter);
  return listEvents(db, actor, parsed.success ? parsed.data : {});
}

/** Etkinlik ayrıntısı + masalar. Kimlik geçersizse ya da kayıt görünmüyorsa 404. */
export async function loadEventDetail(id: string) {
  const actor = await requirePolicyActor();
  authorize(actor, "events", "view");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  try {
    const event = await getEvent(db, actor, id);
    const tables = await listEventTables(db, id);
    return { event, tables };
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}
