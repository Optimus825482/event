import { count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { eventTables } from "@/db/schema";
import { requirePolicyActor } from "@/features/auth/permissions";
import { authorize, type Module, type Verb } from "@/features/auth/policy";
import { getEventOrThrow } from "@/features/events/service";
import { DomainError } from "@/lib/action";
import { isUuid } from "@/lib/identifiers";

/** İçe aktarma sayfası verisi: ilk satırda `authorize`; geçersiz kimlik ya da görünmeyen etkinlik 404. */
export async function loadImportPage(module: Module, verb: Verb, eventId: string) {
  const actor = await requirePolicyActor();
  authorize(actor, module, verb);
  if (!isUuid(eventId)) notFound();
  try {
    const event = await getEventOrThrow(db, eventId);
    const [row] = await db.select({ total: count() }).from(eventTables).where(eq(eventTables.eventId, event.id));
    return { event, tableCount: row?.total ?? 0 };
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}
