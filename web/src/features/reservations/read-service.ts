import { and, asc, eq, inArray, ne, type SQL } from "drizzle-orm";
import { eventTables, events, reservations } from "@/db/schema";
import type { ReservationStatus } from "@/domain/reservation-status";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { ACTIVE_STATUSES, MSG, type Executor } from "./internal";
import { verifyQrToken } from "./qr-token";

export type AvailableTable = {
  id: string;
  label: string;
  capacity: number;
  isLoca: boolean;
  tableTypeId: string | null;
  /** Masadaki aktif rezervasyon (yoksa `null`). */
  reservationId: string | null;
  available: boolean;
};

/**
 * Etkinliğin masaları ve müsaitlikleri — tek sorgu, tek kaynak: etiket ve kapasite `event_tables`
 * satırından, doluluk aktif rezervasyonlarla LEFT JOIN'den gelir. Kısmi tekil index masa başına
 * en çok bir aktif rezervasyon garanti ettiği için satırlar çoğalmaz. `excludeReservationId`,
 * düzenlenen rezervasyonun kendi masasını müsait gösterir. Liste bilgi amaçlıdır; yazmada karar
 * yine veritabanınındır.
 */
export async function availableTables(
  db: Executor,
  actor: Actor,
  input: { eventId: string; excludeReservationId?: string },
): Promise<AvailableTable[]> {
  const [event] = await db
    .select({ organizerId: events.organizerId })
    .from(events)
    .where(eq(events.id, input.eventId));
  if (!event) throw new DomainError("not_found", MSG.eventNotFound);

  const joinOn: SQL[] = [
    eq(reservations.eventId, eventTables.eventId),
    eq(reservations.tableId, eventTables.id),
    inArray(reservations.status, [...ACTIVE_STATUSES]),
  ];
  if (input.excludeReservationId) joinOn.push(ne(reservations.id, input.excludeReservationId));

  const rows = await db
    .select({
      id: eventTables.id,
      label: eventTables.label,
      capacity: eventTables.capacity,
      isLoca: eventTables.isLoca,
      tableTypeId: eventTables.tableTypeId,
      reservationId: reservations.id,
    })
    .from(eventTables)
    .leftJoin(reservations, and(...joinOn))
    .where(eq(eventTables.eventId, input.eventId))
    .orderBy(asc(eventTables.label));
  return rows.map((row) => ({ ...row, available: row.reservationId === null }));
}

export type QrLookup = {
  reservationId: string;
  eventId: string;
  tableId: string;
  tableLabel: string;
  tableCapacity: number;
  customerId: string;
  status: ReservationStatus;
  guestCount: number;
  guestName: string | null;
  checkedInAt: Date | null;
};

/**
 * QR belirtecini doğrular ve rezervasyonu GÜNCEL masasıyla döndürür (belirteç masa taşımaz).
 * İmza geçersizse, rezervasyon yoksa ya da satırda saklanan belirteç farklıysa `null`.
 * Yetki denetimi çağıranın (check-in) işidir.
 */
export async function lookupReservationByQr(db: Executor, token: string): Promise<QrLookup | null> {
  const verified = verifyQrToken(token);
  if (!verified) return null;
  const [row] = await db
    .select({
      reservationId: reservations.id,
      eventId: reservations.eventId,
      tableId: reservations.tableId,
      tableLabel: eventTables.label,
      tableCapacity: eventTables.capacity,
      customerId: reservations.customerId,
      status: reservations.status,
      guestCount: reservations.guestCount,
      guestName: reservations.guestName,
      checkedInAt: reservations.checkedInAt,
    })
    .from(reservations)
    .innerJoin(
      eventTables,
      and(eq(eventTables.eventId, reservations.eventId), eq(eventTables.id, reservations.tableId)),
    )
    .where(and(eq(reservations.id, verified.reservationId), eq(reservations.qrToken, token)));
  return row ?? null;
}
