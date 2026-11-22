import { count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { eventTables } from "@/db/schema";
import { requirePolicyActor } from "@/features/auth/permissions";
import { authorize, type Module, type Verb } from "@/features/auth/policy";
import { getEventOrThrow } from "@/features/events/service";
import { canAccessEvent } from "@/features/reservations/internal";
import { DomainError } from "@/lib/action";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** İçe aktarma sayfası verisi: ilk satırda `authorize`; geçersiz kimlik ya da görünmeyen etkinlik 404. */
export async function loadImportPage(module: Module, verb: Verb, eventId: string) {
  const actor = await requirePolicyActor();
  authorize(actor, module, verb);
  if (!UUID.test(eventId)) notFound();
  try {
    const event = await getEventOrThrow(db, eventId);
    if (!canAccessEvent(actor, event)) notFound();
    const [row] = await db.select({ total: count() }).from(eventTables).where(eq(eventTables.eventId, event.id));
    return { event, tableCount: row?.total ?? 0 };
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}
