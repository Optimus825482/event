import { and, eq, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { customers, eventTables, events, reservations } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { pgCodeOf, pgConstraintOf } from "@/lib/pg-error";
import { publish } from "@/features/realtime/publish";
import { canAccessEvent } from "@/features/events/access";
import { EVENT_STATUS_LABELS } from "@/features/events/labels";
import type { EventRow } from "@/features/events/service";
import { DomainError } from "@/lib/action";

export type Executor = Db | Tx;
export type ReservationRow = typeof reservations.$inferSelect;
export type EventTableRow = typeof eventTables.$inferSelect;

export const MSG = {
  tableTaken: "Bu masa için aktif bir rezervasyon var",
  eventNotFound: "Etkinlik bulunamadı",
  reservationNotFound: "Rezervasyon bulunamadı",
  tableNotFound: "Masa bu etkinlikte bulunamadı",
  blacklisted: "Müşteri kara listede; rezervasyon yalnızca yönetici onayıyla yapılabilir",
  reservationsClosed: "Bu etkinlik rezervasyona kapalı",
  eventClosed: "Rezervasyon, tamamlanmış veya iptal edilmiş etkinlikte değiştirilemez",
  guestCountRange: "Kişi sayısı 1 ile 50 arasında olmalıdır",
  missingParent: "Masa veya müşteri artık mevcut değil",
} as const;

/** Rezervasyon değişimini (liste/masa/istatistik) aynı transaction içinde yayar; rollback'te teslim edilmez. */
export async function publishReservationChange(tx: Tx, eventId: string, id?: string): Promise<void> {
  await publish(tx, { type: "reservation.changed", eventId, ...(id ? { id } : {}) });
  await publish(tx, { type: "stats.updated", eventId, ...(id ? { id } : {}) });
}

export const ACTIVE_STATUSES = ["pending", "confirmed", "checked_in"] as const;

/**
 * Yazma transaction'ı: `db` verilirse havuzdan yeni bir bağlantıyla, `tx` verilirse kayıt noktası
 * (savepoint) olarak çalışır (toplu içe aktarma satır başına geri alabilsin). Veritabanı hataları
 * anlamlı `DomainError`'a çevrilir; çifte rezervasyonu kısmi tekil index belirler.
 */
export async function inTransaction<T>(executor: Executor, fn: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await executor.transaction(fn);
  } catch (error) {
    throw mapDbError(error);
  }
}

function mapDbError(error: unknown): unknown {
  if (error instanceof DomainError) return error;
  const code = pgCodeOf(error);
  if (code === "23505" && pgConstraintOf(error) === "reservations_active_table_uq") {
    return new DomainError("conflict", MSG.tableTaken);
  }
  if (code === "23514" && pgConstraintOf(error) === "reservations_guest_count_range") {
    return new DomainError("conflict", MSG.guestCountRange);
  }
  if (code === "23503") return new DomainError("conflict", MSG.missingParent);
  return error;
}

export { canAccessEvent };

/**
 * Etkinliği `FOR SHARE` ile kilitler: durum geçişi (`FOR UPDATE`) ve yerleşim kaydı
 * (`FOR UPDATE`) bu transaction bitene kadar bekler; eşzamanlı rezervasyonlar birbirini beklemez.
 */
export async function lockEvent(tx: Tx, actor: Actor, eventId: string, notFound: string = MSG.eventNotFound) {
  const [event] = await tx.select().from(events).where(eq(events.id, eventId)).for("share");
  if (!event || !canAccessEvent(actor, event)) throw new DomainError("not_found", notFound);
  return event;
}

/** Yeni rezervasyon ve iptalden geri dönüş: yalnızca yayında/devam eden ve rezervasyonu açık etkinlik. */
export function assertBookable(event: EventRow): void {
  if (event.status !== "published" && event.status !== "active") {
    throw new DomainError(
      "conflict",
      `Etkinlik "${EVENT_STATUS_LABELS[event.status]}" durumunda; rezervasyona açık değil`,
    );
  }
  if (!event.reservationEnabled) throw new DomainError("conflict", MSG.reservationsClosed);
}

export function assertEventOpen(event: EventRow): void {
  if (event.status === "completed" || event.status === "cancelled") {
    throw new DomainError("conflict", MSG.eventClosed);
  }
}

/** Masayı `FOR SHARE` ile kilitler: eşzamanlı yerleşim kaydı kapasiteyi bu transaction içinde değiştiremez. */
export async function lockTable(tx: Tx, eventId: string, tableId: string): Promise<EventTableRow> {
  const [table] = await tx
    .select()
    .from(eventTables)
    .where(and(eq(eventTables.eventId, eventId), eq(eventTables.id, tableId)))
    .for("share");
  if (!table) throw new DomainError("not_found", MSG.tableNotFound);
  return table;
}

export function assertCapacity(guestCount: number, table: Pick<EventTableRow, "capacity">): void {
  if (guestCount > table.capacity) {
    throw new DomainError("conflict", `Kişi sayısı (${guestCount}) masa kapasitesini (${table.capacity}) aşıyor`);
  }
}

/** Kara listedeki müşteri yalnızca yönetici açıkça onaylarsa (`overrideBlacklist`) geçer. */
export function assertNotBlacklisted(actor: Actor, isBlacklisted: boolean, override: boolean | undefined): void {
  if (isBlacklisted && !(actor.role === "admin" && override === true)) {
    throw new DomainError("conflict", MSG.blacklisted);
  }
}

/** Rezervasyonu kilitler. Sıra (etkinlik → rezervasyon → masa) oluşturmayla aynıdır; kilitlenme olmaz. */
export async function lockReservation(tx: Tx, actor: Actor, id: string) {
  const [ref] = await tx.select({ eventId: reservations.eventId }).from(reservations).where(eq(reservations.id, id));
  if (!ref) throw new DomainError("not_found", MSG.reservationNotFound);
  const event = await lockEvent(tx, actor, ref.eventId, MSG.reservationNotFound);
  const [reservation] = await tx.select().from(reservations).where(eq(reservations.id, id)).for("update");
  if (!reservation) throw new DomainError("not_found", MSG.reservationNotFound);
  return { event, reservation };
}

/** `customers.total_reservations` sayacını aynı transaction içinde değiştirir (negatife inmez). */
export async function bumpTotalReservations(tx: Tx, customerId: string, delta: 1 | -1): Promise<void> {
  await tx
    .update(customers)
    .set({ totalReservations: sql`greatest(${customers.totalReservations} + ${delta}, 0)` })
    .where(eq(customers.id, customerId));
}
