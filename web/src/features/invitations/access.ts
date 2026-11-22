import type { Db, Tx } from "@/db/client";
import { systemSettings } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { getEventOrThrow, type EventRow } from "@/features/events/service";
import { DomainError } from "@/lib/action";

type Executor = Db | Tx;

/** Eski davranış: sistem ayarlarında davetiye sistemi kapalıysa yönetim işlemleri reddedilir. */
export async function assertInvitationSystemEnabled(db: Executor): Promise<void> {
  const [row] = await db.select({ enabled: systemSettings.invitationSystemEnabled }).from(systemSettings).limit(1);
  if (row && !row.enabled) {
    throw new DomainError("conflict", "Davetiye sistemi şu anda devre dışı. Sistem ayarlarından etkinleştirebilirsiniz.");
  }
}

/** Organizatör yalnızca kendi etkinliğine erişir; başkasınınki "yok" gibi davranır (events modülüyle aynı kural). */
export async function getAccessibleEvent(db: Executor, actor: Actor, eventId: string): Promise<EventRow> {
  const event = await getEventOrThrow(db, eventId);
  if (actor.role === "organizer" && event.organizerId !== actor.id) {
    throw new DomainError("not_found", "Etkinlik bulunamadı");
  }
  return event;
}
