import { createHash } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { customers, eventTables, reservations, users } from "@/db/schema";
import type { EventRow } from "@/features/events/service";
import { publish } from "@/features/realtime/publish";
import { verifyQrToken } from "@/features/reservations/qr-token";
import { DomainError } from "@/lib/action";
import type { CheckInSuccess } from "./result-schema";

export const CHECK_IN_MSG = {
  invalidCode: "QR kod geçersiz veya rezervasyon bulunamadı",
  otherEvent: "Bu QR kod başka bir etkinliğe ait",
  cancelled: "Rezervasyon iptal edilmiş; check-in yapılamaz",
  keyReused: "Bu istek anahtarı başka bir istek için kullanılmış",
  reservationNotFound: "Rezervasyon bulunamadı",
} as const;

/** İstemci zaman damgası, en fazla bu kadar eskiyse giriş zamanı olarak kabul edilir. */
export const CLIENT_TIMESTAMP_MAX_AGE_HOURS = 24;

export type CheckInOutcome = "checked_in" | "already_checked_in";

/** Check-in yanıtı (bkz. `result-schema.ts`). Yalnızca JSON değerleri içerir: saklanan yanıt ile ilk yanıt birebir aynıdır. */
export type { CheckInSuccess };

export type ReservationRef =
  { kind: "token"; value: string } | { kind: "legacyHash"; value: string } | { kind: "reservationId"; value: string };

export function fingerprint(eventId: string, ref: ReservationRef): string {
  return createHash("sha256").update(`${eventId}\n${ref.kind}\n${ref.value}`).digest("hex");
}

/** Walk-in isteğinin özeti: aynı anahtar başka masa/ad/kişi sayısıyla gelirse tekrar sayılmaz. */
export function walkInFingerprint(input: {
  eventId: string;
  tableId: string;
  guestName: string;
  guestCount: number;
  guestPhone?: string | undefined;
}): string {
  const parts = [input.eventId, input.tableId, input.guestName.trim(), String(input.guestCount), input.guestPhone?.trim() ?? ""];
  return createHash("sha256").update(["walk-in", ...parts].join("\n")).digest("hex");
}

/** Check-in yalnızca yayında, devam eden ya da tamamlanmış etkinlikte yapılır (geç gelen misafir). */
export function assertCheckInOpen(event: EventRow): void {
  if (event.status === "draft") throw new DomainError("conflict", "Etkinlik taslak durumunda; check-in yapılamaz");
  if (event.status === "cancelled") throw new DomainError("conflict", "Etkinlik iptal edilmiş; check-in yapılamaz");
}

/** Belirteç/hash/kimlikten rezervasyonu bulur ve etkinliğe ait olduğunu denetler. */
export async function resolveReservation(tx: Tx, eventId: string, ref: ReservationRef): Promise<string> {
  let where: SQL | undefined;
  if (ref.kind === "token") {
    const verified = verifyQrToken(ref.value);
    if (!verified) throw new DomainError("not_found", CHECK_IN_MSG.invalidCode);
    // Taşınan eski kayıtlarda satırdaki belirteç farklı olabilir: imza + satır eşleşmesi birlikte aranır.
    where = and(eq(reservations.id, verified.reservationId), eq(reservations.qrToken, ref.value));
  } else if (ref.kind === "legacyHash") {
    where = eq(reservations.legacyQrHash, ref.value);
  } else {
    where = eq(reservations.id, ref.value);
  }
  const [row] = await tx.select({ id: reservations.id, eventId: reservations.eventId }).from(reservations).where(where);
  if (!row) {
    throw new DomainError(
      "not_found",
      ref.kind === "reservationId" ? CHECK_IN_MSG.reservationNotFound : CHECK_IN_MSG.invalidCode,
    );
  }
  if (row.eventId !== eventId) throw new DomainError("conflict", CHECK_IN_MSG.otherEvent);
  return row.id;
}

/**
 * Tek koşullu UPDATE: yalnızca bekleyen/onaylı/gelmedi rezervasyon giriş yapar. Eşzamanlı isteklerden
 * yalnızca biri satır döndürür (diğerleri satır kilidini bekler, güncel durumu yeniden değerlendirir ve
 * boş döner). `previous_status`, aynı ifadedeki `FOR UPDATE` alt sorgusundan gelir (PostgreSQL 17'de
 * RETURNING eski değeri veremez); gelmedi sayacının geri alınması için gerekir. Satır döndüyse müşteri
 * sayaçları aynı transaction'da güncellenir.
 *
 * Giriş zamanı: istemci zaman damgası gelecekte değilse ve 24 saatten eski değilse o, yoksa sunucu zamanı.
 */
export async function markCheckedIn(
  tx: Tx,
  input: {
    reservationId: string;
    event: EventRow;
    actorId: string;
    clientTimestamp: Date | null;
    gate: number | null;
  },
): Promise<boolean> {
  const ts = input.clientTimestamp ? input.clientTimestamp.toISOString() : null;
  const checkedInAt = sql`case
      when ${ts}::timestamptz is not null
        and ${ts}::timestamptz <= now()
        and ${ts}::timestamptz >= now() - make_interval(hours => ${CLIENT_TIMESTAMP_MAX_AGE_HOURS})
      then ${ts}::timestamptz else now() end`;
  const result = await tx.execute<{
    customer_id: string;
    previous_status: string;
  }>(sql`
    update ${reservations} as r
    set status = 'checked_in', checked_in_at = ${checkedInAt}, checked_in_by = ${input.actorId}, check_in_gate = ${input.gate}::smallint, updated_at = now()
    from (
      select id, status as previous_status from ${reservations}
      where id = ${input.reservationId} and event_id = ${input.event.id}
      for update
    ) as target
    where r.id = target.id and r.status in ('pending', 'confirmed', 'no_show')
    returning r.customer_id, target.previous_status
  `);
  const row = result.rows[0];
  if (!row) return false;

  await tx
    .update(customers)
    .set({
      totalAttendedEvents: sql`${customers.totalAttendedEvents} + 1`,
      noShowCount:
        row.previous_status === "no_show"
          ? sql`greatest(${customers.noShowCount} - 1, 0)`
          : sql`${customers.noShowCount}`,
      lastEventId: sql`case when ${customers.lastEventAt} is null or ${customers.lastEventAt} <= ${input.event.startsAt} then ${input.event.id}::uuid else ${customers.lastEventId} end`,
      lastEventAt: sql`greatest(${customers.lastEventAt}, ${input.event.startsAt})`,
    })
    .where(eq(customers.id, row.customer_id));
  return true;
}

/** Rezervasyonun güncel giriş bilgisini okur; giriş yapılmışsa yanıtı, değilse durumu döndürür. */
export async function readCheckIn(tx: Tx, reservationId: string, outcome: CheckInOutcome) {
  const [row] = await tx
    .select({
      status: reservations.status,
      reservationId: reservations.id,
      eventId: reservations.eventId,
      guestName: reservations.guestName,
      guestCount: reservations.guestCount,
      tableId: reservations.tableId,
      tableLabel: eventTables.label,
      checkedInAt: reservations.checkedInAt,
      gate: reservations.checkInGate,
      byId: users.id,
      byUsername: users.username,
    })
    .from(reservations)
    .innerJoin(
      eventTables,
      and(eq(eventTables.eventId, reservations.eventId), eq(eventTables.id, reservations.tableId)),
    )
    .leftJoin(users, eq(users.id, reservations.checkedInBy))
    .where(eq(reservations.id, reservationId));
  if (!row) throw new DomainError("not_found", CHECK_IN_MSG.reservationNotFound);
  if (row.status !== "checked_in") return { status: row.status, response: null };
  const response: CheckInSuccess = {
    outcome,
    kind: "reservation",
    reservationId: row.reservationId,
    ticketId: null,
    pnr: null,
    gate: row.gate,
    eventId: row.eventId,
    guestName: row.guestName,
    guestCount: row.guestCount,
    tableId: row.tableId,
    tableLabel: row.tableLabel,
    // Eski verideki giriş zamanı boş olabilir; yanıt her zaman bir zaman taşır.
    checkedInAt: (row.checkedInAt ?? new Date(0)).toISOString(),
    checkedInBy: row.byId && row.byUsername ? { id: row.byId, username: row.byUsername } : null,
  };
  return { status: row.status, response };
}

/** Giriş olayları: kapıdaki diğer ekranlar listeyi ve istatistikleri yeniler. Commit ile teslim edilir. */
export async function publishCheckIn(tx: Tx, eventId: string, reservationId: string): Promise<void> {
  await publish(tx, { type: "guest.checked_in", eventId, id: reservationId });
  await publish(tx, { type: "stats.updated", eventId });
}
