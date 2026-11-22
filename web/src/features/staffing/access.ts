import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { events } from "@/db/schema";
import { authorize, type PolicyActor, type Verb } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { canAccessEvent } from "@/features/events/access";
import { getEventOrThrow, type EventRow } from "@/features/events/service";
import { DomainError } from "@/lib/action";
import { mapStaffingDbError } from "./db-errors";

const NOT_FOUND = "Etkinlik bulunamadı";
const LOCKED = "Tamamlanmış veya iptal edilmiş etkinlikte ekip organizasyonu değiştirilemez";

/**
 * Ekip organizasyonu etkinliğin bir parçasıdır: yetki `events` modülünden gelir.
 * Servis düzeyinde ikinci savunma; kullanıcı izin satırları action/sayfa katmanında uygulanır.
 */
export function ensureStaffingAccess(actor: PolicyActor, verb: Verb): void {
  authorize(actor, "events", verb);
}

function assertOwnership(actor: Actor, event: EventRow): void {
  if (!canAccessEvent(actor, event)) throw new DomainError("not_found", NOT_FOUND);
}

export async function getReadableEvent(db: Db | Tx, actor: Actor, eventId: string): Promise<EventRow> {
  ensureStaffingAccess(actor, "view");
  const event = await getEventOrThrow(db, eventId);
  assertOwnership(actor, event);
  return event;
}

/**
 * Yazma öncesi etkinlik satırını `FOR UPDATE` ile kilitler: aynı etkinliğin eşzamanlı
 * kayıtları sıraya girer ve her biri öncekinin sonucunu görerek fark hesaplar.
 */
export async function lockEditableEvent(tx: Tx, actor: Actor, eventId: string): Promise<EventRow> {
  const [event] = await tx.select().from(events).where(eq(events.id, eventId)).for("update");
  if (!event) throw new DomainError("not_found", NOT_FOUND);
  assertOwnership(actor, event);
  if (event.status === "completed" || event.status === "cancelled") {
    throw new DomainError("conflict", LOCKED);
  }
  return event;
}

/**
 * Yetki denetimi → tek transaction → etkinlik kilidi → `work`. Veritabanı kısıt hataları
 * Türkçe `DomainError`a çevrilir; hata olursa transaction tamamen geri alınır.
 */
export async function withEventWrite<T>(
  db: Db | Tx,
  actor: Actor,
  eventId: string,
  work: (tx: Tx, event: EventRow) => Promise<T>,
): Promise<T> {
  ensureStaffingAccess(actor, "edit");
  try {
    return await db.transaction(async (tx) => work(tx, await lockEditableEvent(tx, actor, eventId)));
  } catch (error) {
    throw mapStaffingDbError(error);
  }
}
