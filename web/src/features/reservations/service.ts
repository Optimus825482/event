import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { customers, reservations } from "@/db/schema";
import { can } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { findOrCreateCustomer } from "@/features/customers/find-or-create";
import { DomainError } from "@/lib/action";
import { pgCodeOf, pgConstraintOf } from "@/lib/pg-error";
import { randomBookingCode } from "@/lib/short-code";
import {
  ACTIVE_STATUSES,
  assertBookable,
  assertCapacity,
  assertCasinoTable,
  assertEventOpen,
  assertNotBlacklisted,
  bumpTotalReservations,
  inTransaction,
  lockEvent,
  lockReservation,
  lockTable,
  MSG,
  publishReservationChange,
  type Executor,
  type ReservationRow,
} from "./internal";
import { signQrToken } from "./qr-token";
import type { CreateReservationInput, UpdateReservationInput } from "./schemas";

export { availableTables, lookupReservationByQr, type AvailableTable, type QrLookup } from "./read-service";
export { cancelReservation, cancelReservations, changeReservationStatus, markNoShows } from "./status-service";
export type { ReservationRow } from "./internal";

/**
 * Müşteri kaydını bağlamak/ön doldurmak için `customers:view` gerekir. Yetkisiz kullanıcı için
 * bilinmeyen müşteriyle aynı hata verilir (varlık sızdırılmaz).
 */
async function canReadCustomers(actor: Actor): Promise<boolean> {
  return can(actor, "customers", "view");
}

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
  /** Açık bir transaction içinden çağıran, izni önceden çözüp verir (havuzdan ikinci bağlantı alınmaz). */
  options: { mayReadCustomers?: boolean } = {},
): Promise<ReservationRow> {
  const mayReadCustomers = options.mayReadCustomers ?? (await canReadCustomers(actor));
  if (input.customerId && !mayReadCustomers) throw new DomainError("not_found", "Müşteri bulunamadı");
  return inTransaction(db, async (tx) => {
    const event = await lockEvent(tx, actor, input.eventId);
    assertBookable(event);
    const table = await lockTable(tx, event.id, input.tableId);
    assertCasinoTable(table);
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
    const row = await insertWithBookingCode(tx, {
      id,
      eventId: event.id,
      tableId: table.id,
      customerId: found.id,
      guestCount: input.guestCount,
      // Eşleşen müşterinin iletişim bilgisi yalnızca `customers:view` olana ön doldurulur.
      guestName: input.guestName ?? (mayReadCustomers ? customer?.fullName : undefined) ?? null,
      guestPhone: input.guestPhone ?? (mayReadCustomers ? customer?.phone : undefined) ?? null,
      guestEmail: input.guestEmail ?? (mayReadCustomers ? customer?.email : undefined) ?? null,
      specialRequests: input.specialRequests ?? null,
      status: "confirmed",
      qrToken: signQrToken(id),
    });
    await bumpTotalReservations(tx, found.id, 1);
    await publishReservationChange(tx, event.id, row.id);
    return row;
  });
}

const BOOKING_CODE_ATTEMPTS = 3;

/**
 * Rezervasyonu ekler. Kısa kod (`reservations_booking_code_uq`) çakışırsa ekleme, kayıt noktası
 * (savepoint) içinde yeni kodla en çok 3 kez denenir; ana işlem (müşteri kaydı, kilitler) bozulmaz.
 * Üçüncüde de çakışırsa hata yukarı çıkar. Başka hatalar (ör. dolu masa) hemen yükselir.
 */
async function insertWithBookingCode(
  tx: Tx,
  values: Omit<typeof reservations.$inferInsert, "bookingCode">,
): Promise<ReservationRow> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const [row] = await tx.transaction((sp) =>
        sp.insert(reservations).values({ ...values, bookingCode: randomBookingCode() }).returning(),
      );
      if (!row) throw new Error("rezervasyon eklenemedi");
      return row;
    } catch (error) {
      const clash = pgCodeOf(error) === "23505" && pgConstraintOf(error) === "reservations_booking_code_uq";
      if (!clash || attempt >= BOOKING_CODE_ATTEMPTS) throw error;
    }
  }
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
    if (table.id !== reservation.tableId) assertCasinoTable(table);
    // Kapasite yalnızca masa ya da kişi sayısı değişince denetlenir; önceden kapasiteyi aşan
    // (örn. içe aktarılmış) bir rezervasyonun yalnızca adı/telefonu düzenlenebilir.
    if (table.id !== reservation.tableId || guestCount !== reservation.guestCount) assertCapacity(guestCount, table);

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
    await publishReservationChange(tx, event.id, row.id);
    return row;
  });
}
