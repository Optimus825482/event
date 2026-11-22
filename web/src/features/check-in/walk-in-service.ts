import { eq } from "drizzle-orm";
import { checkInEvents, reservations } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { publish } from "@/features/realtime/publish";
import { lockEvent, MSG, type Executor } from "@/features/reservations/internal";
import { createReservation, updateReservation } from "@/features/reservations/service";
import { DomainError } from "@/lib/action";
import { markCheckedIn, publishCheckIn, readCheckIn, type CheckInSuccess } from "./internal";
import { updateGuestCountInput, walkInInput, type UpdateGuestCountInput, type WalkInInput } from "./schemas";

/**
 * Kapıda gelen misafir: müşteri (`findOrCreateCustomer`) + boş masada rezervasyon + giriş, tek transaction.
 * Rezervasyon `createReservation` kurallarından geçer (etkinlik yayında/devam ediyor ve rezervasyona açık,
 * kapasite, kara liste, masayı kısmi tekil index belirler). Herhangi bir adım reddedilirse hiçbir şey
 * yazılmaz (müşteri kaydı dahil) ve hiçbir olay yayılmaz.
 */
export async function registerWalkIn(db: Executor, actor: Actor, raw: WalkInInput): Promise<CheckInSuccess> {
  const input = walkInInput.parse(raw);
  return db.transaction(async (tx) => {
    const reservation = await createReservation(tx, actor, {
      eventId: input.eventId,
      tableId: input.tableId,
      guestCount: input.guestCount,
      guestName: input.guestName,
      guestPhone: input.guestPhone,
    });
    // Etkinlik bu transaction'da zaten `FOR SHARE` kilitli; satır, sayaçlar için yeniden okunur.
    const event = await lockEvent(tx, actor, input.eventId);
    const changed = await markCheckedIn(tx, {
      reservationId: reservation.id,
      event,
      actorId: actor.id,
      clientTimestamp: null,
    });
    const { response } = await readCheckIn(tx, reservation.id, "checked_in");
    if (!changed || !response) throw new Error("walk-in girişi yapılamadı");

    await tx.insert(checkInEvents).values({
      reservationId: reservation.id,
      idempotencyKey: `walk-in:${reservation.id}`,
      actorId: actor.id,
      outcome: "checked_in",
      response: { ok: true, data: response },
    });
    await publish(tx, {
      type: "reservation.changed",
      eventId: event.id,
      id: reservation.id,
    });
    await publishCheckIn(tx, event.id, reservation.id);
    return response;
  });
}

/**
 * Kişi sayısını değiştirir: 1 ile güncel masa kapasitesi arası, aşım reddedilir (`conflict`).
 * `updateReservation` kurallarını kullanır (aktif rezervasyon, kapanmamış etkinlik, kilitli masa satırı).
 */
export async function updateGuestCount(
  db: Executor,
  actor: Actor,
  raw: UpdateGuestCountInput,
): Promise<{ reservationId: string; guestCount: number }> {
  const input = updateGuestCountInput.parse(raw);
  return db.transaction(async (tx) => {
    const [ref] = await tx
      .select({ eventId: reservations.eventId })
      .from(reservations)
      .where(eq(reservations.id, input.reservationId));
    if (!ref || ref.eventId !== input.eventId) throw new DomainError("not_found", MSG.reservationNotFound);

    const row = await updateReservation(tx, actor, {
      id: input.reservationId,
      guestCount: input.guestCount,
    });
    await publish(tx, {
      type: "reservation.changed",
      eventId: row.eventId,
      id: row.id,
    });
    await publish(tx, { type: "stats.updated", eventId: row.eventId });
    return { reservationId: row.id, guestCount: row.guestCount };
  });
}
