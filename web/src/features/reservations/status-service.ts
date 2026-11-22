import { eq, sql } from "drizzle-orm";
import { customers, reservations } from "@/db/schema";
import { canTransitionReservation } from "@/domain/reservation-status";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import {
  assertBookable,
  assertCapacity,
  assertEventOpen,
  assertNotBlacklisted,
  bumpTotalReservations,
  inTransaction,
  lockEvent,
  lockReservation,
  lockTable,
  MSG,
  type Executor,
  type ReservationRow,
} from "./internal";
import { RESERVATION_STATUS_LABELS } from "./labels";
import type { ChangeReservationStatusInput, EventIdInput, ReservationIdInput } from "./schemas";

/**
 * Durum değişikliği (`canTransitionReservation`). Check-in (giriş ekranı, Task 16) ve gelmedi
 * (`markNoShows`) bu yoldan verilmez; sayaçlar ve kayıtlar orada tutulur.
 * İptal → onaylı geçişi yeni rezervasyonla aynı müsaitlik yolundan geçer: etkinlik açık olmalı,
 * kapasite ve kara liste yeniden denetlenir, masayı kısmi tekil index belirler.
 */
export async function changeReservationStatus(
  db: Executor,
  actor: Actor,
  input: ChangeReservationStatusInput,
): Promise<ReservationRow> {
  if (input.status === "checked_in") {
    throw new DomainError("conflict", "Check-in yalnızca giriş ekranından yapılır");
  }
  if (input.status === "no_show") {
    throw new DomainError("conflict", "Gelmedi işareti, etkinlik tamamlandıktan sonra toplu olarak verilir");
  }

  return inTransaction(db, async (tx) => {
    const { event, reservation } = await lockReservation(tx, actor, input.id);
    const from = reservation.status;
    const to = input.status;
    if (!canTransitionReservation(from, to)) {
      throw new DomainError(
        "conflict",
        `Rezervasyon "${RESERVATION_STATUS_LABELS[from]}" durumundan "${RESERVATION_STATUS_LABELS[to]}" durumuna geçilemez`,
      );
    }

    if (to === "cancelled") {
      if (event.status === "completed") {
        throw new DomainError("conflict", "Rezervasyon, tamamlanmış etkinlikte iptal edilemez");
      }
      await bumpTotalReservations(tx, reservation.customerId, -1);
    } else if (from === "cancelled") {
      assertBookable(event);
      const table = await lockTable(tx, event.id, reservation.tableId);
      assertCapacity(reservation.guestCount, table);
      const [customer] = await tx
        .select({ isBlacklisted: customers.isBlacklisted })
        .from(customers)
        .where(eq(customers.id, reservation.customerId));
      assertNotBlacklisted(actor, customer?.isBlacklisted ?? false, input.overrideBlacklist);
      await bumpTotalReservations(tx, reservation.customerId, 1);
    } else {
      assertEventOpen(event);
    }

    // Aktif duruma dönüşte çakışma varsa bu UPDATE `23505` ile düşer (→ "Bu masa için aktif bir rezervasyon var").
    const [row] = await tx
      .update(reservations)
      .set({ status: to })
      .where(eq(reservations.id, reservation.id))
      .returning();
    if (!row) throw new DomainError("not_found", MSG.reservationNotFound);
    return row;
  });
}

export async function cancelReservation(
  db: Executor,
  actor: Actor,
  input: ReservationIdInput,
): Promise<ReservationRow> {
  return changeReservationStatus(db, actor, { id: input.id, status: "cancelled" });
}

/**
 * Tamamlanmış etkinlikte bekleyen/onaylı rezervasyonları `no_show` yapar ve müşterilerin
 * `no_show_count` sayaçlarını aynı ifadede, küme tabanlı artırır. Tekrar çalıştırmak etkisizdir:
 * ikinci çağrı (eşzamanlı olsa bile) satır kilidini bekler, durumu yeniden değerlendirir ve 0 döner.
 */
export async function markNoShows(db: Executor, actor: Actor, input: EventIdInput): Promise<{ updated: number }> {
  return inTransaction(db, async (tx) => {
    const event = await lockEvent(tx, actor, input.eventId);
    if (event.status !== "completed") {
      throw new DomainError("conflict", "Gelmedi işareti yalnızca tamamlanmış etkinlikte verilebilir");
    }
    const result = await tx.execute<{ updated: number }>(sql`
      with flipped as (
        update ${reservations} set status = 'no_show', updated_at = now()
        where event_id = ${event.id} and status in ('pending', 'confirmed')
        returning customer_id
      ), per_customer as (
        select customer_id, count(*)::int as n from flipped group by customer_id
      ), bumped as (
        update ${customers} as c set no_show_count = c.no_show_count + p.n, updated_at = now()
        from per_customer as p where c.id = p.customer_id
        returning c.id
      )
      select (select count(*) from flipped)::int as updated, (select count(*) from bumped)::int as customers
    `);
    return { updated: result.rows[0]?.updated ?? 0 };
  });
}
