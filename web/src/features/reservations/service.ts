import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { customers, reservations } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { findOrCreateCustomer } from "@/features/customers/find-or-create";
import { DomainError } from "@/lib/action";
import {
  ACTIVE_STATUSES,
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
import { signQrToken } from "./qr-token";
import type { CreateReservationInput, UpdateReservationInput } from "./schemas";

export { availableTables, lookupReservationByQr, type AvailableTable, type QrLookup } from "./read-service";
export { cancelReservation, changeReservationStatus, markNoShows } from "./status-service";
export type { ReservationRow } from "./internal";

/**
 * Yeni rezervasyon (durum `confirmed`). Tek transaction: etkinlik ve masa `FOR SHARE` kilitlenir,
 * kapasite güncel masa satırından denetlenir, müşteri bulunur/oluşturulur, kara liste uygulanır,
 * kimlik önceden üretilip imzalı QR belirteciyle tek INSERT yapılır. Masanın boş olup olmadığı
 * önceden sorgulanmaz: kısmi tekil index (`reservations_active_table_uq`) karar verir, `23505`
 * "Bu masa için aktif bir rezervasyon var" olur. `tx` verilirse kayıt noktası olarak çalışır.
 */
export async function createReservation(
  db: Executor,
  actor: Actor,
  input: CreateReservationInput,
): Promise<ReservationRow> {
  return inTransaction(db, async (tx) => {
    const event = await lockEvent(tx, actor, input.eventId);
    assertBookable(event);
    const table = await lockTable(tx, event.id, input.tableId);
    assertCapacity(input.guestCount, table);

    const found = await findOrCreateCustomer(tx, {
      customerId: input.customerId,
      phone: input.guestPhone,
      email: input.guestEmail,
      fullName: input.guestName,
    });
    assertNotBlacklisted(actor, found.isBlacklisted, input.overrideBlacklist);
    const [customer] = await tx
      .select({ fullName: customers.fullName, phone: customers.phone, email: customers.email })
      .from(customers)
      .where(eq(customers.id, found.id));

    const id = randomUUID();
    const [row] = await tx
      .insert(reservations)
      .values({
        id,
        eventId: event.id,
        tableId: table.id,
        customerId: found.id,
        guestCount: input.guestCount,
        guestName: input.guestName ?? customer?.fullName ?? null,
        guestPhone: input.guestPhone ?? customer?.phone ?? null,
        guestEmail: input.guestEmail ?? customer?.email ?? null,
        specialRequests: input.specialRequests ?? null,
        status: "confirmed",
        qrToken: signQrToken(id),
      })
      .returning();
    if (!row) throw new Error("rezervasyon eklenemedi");
    await bumpTotalReservations(tx, found.id, 1);
    return row;
  });
}

const pick = <T>(next: T | undefined, current: T): T => (next === undefined ? current : next);

/**
 * Masa, kişi sayısı ve misafir bilgisini değiştirir. Masa değişimi oluşturmayla aynı kurallardan
 * geçer (aynı etkinliğin masası, kapasite, tekil index). QR belirteci değişmez; masa bilgisi
 * taşımadığı için doğrulama yeni masayı döndürür.
 */
export async function updateReservation(
  db: Executor,
  actor: Actor,
  input: UpdateReservationInput,
): Promise<ReservationRow> {
  return inTransaction(db, async (tx) => {
    const { event, reservation } = await lockReservation(tx, actor, input.id);
    assertEventOpen(event);
    if (!(ACTIVE_STATUSES as readonly string[]).includes(reservation.status)) {
      throw new DomainError("conflict", "İptal edilmiş ya da gelmedi olarak işaretlenmiş rezervasyon düzenlenemez");
    }
    const guestCount = input.guestCount ?? reservation.guestCount;
    const table = await lockTable(tx, event.id, input.tableId ?? reservation.tableId);
    assertCapacity(guestCount, table);

    const [row] = await tx
      .update(reservations)
      .set({
        tableId: table.id,
        guestCount,
        guestName: pick(input.guestName, reservation.guestName),
        guestPhone: pick(input.guestPhone, reservation.guestPhone),
        guestEmail: pick(input.guestEmail, reservation.guestEmail),
        specialRequests: pick(input.specialRequests, reservation.specialRequests),
      })
      .where(eq(reservations.id, reservation.id))
      .returning();
    if (!row) throw new DomainError("not_found", MSG.reservationNotFound);
    return row;
  });
}
