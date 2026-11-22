import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Tx } from "@/db/client";
import { checkInEvents } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { pgCodeOf, pgConstraintOf } from "@/features/customers/pg-error";
import { lockEvent, MSG, type Executor } from "@/features/reservations/internal";
import { DomainError } from "@/lib/action";
import {
  assertCheckInOpen,
  CHECK_IN_MSG,
  fingerprint,
  markCheckedIn,
  publishCheckIn,
  readCheckIn,
  resolveReservation,
  type CheckInSuccess,
  type ReservationRef,
} from "./internal";
import { checkInInput, type CheckInInput } from "./schemas";

export type { CheckInOutcome, CheckInSuccess } from "./internal";
export { registerWalkIn, updateGuestCount } from "./walk-in-service";
export { eventStats, searchGuests, recentCheckIns, listCheckInEvents, type EventStats } from "./read-service";

/** Saklanan ilk sonuç: başarı ya da iş kuralı hatası (geçici veritabanı hataları saklanmaz). */
const storedResultSchema = z.union([
  z.object({
    ok: z.literal(true),
    data: z.object({
      outcome: z.enum(["checked_in", "already_checked_in"]),
      reservationId: z.string(),
      eventId: z.string(),
      guestName: z.string().nullable(),
      guestCount: z.number(),
      tableId: z.string(),
      tableLabel: z.string(),
      checkedInAt: z.string(),
      checkedInBy: z.object({ id: z.string(), username: z.string() }).nullable(),
    }),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum(["conflict", "not_found", "invalid"]),
    message: z.string(),
  }),
]);
type StoredResult = z.infer<typeof storedResultSchema>;

function refOf(input: z.infer<typeof checkInInput>): ReservationRef {
  if (input.token !== undefined) return { kind: "token", value: input.token };
  if (input.legacyHash !== undefined) return { kind: "legacyHash", value: input.legacyHash };
  if (input.reservationId !== undefined) return { kind: "reservationId", value: input.reservationId };
  throw new DomainError("invalid", "QR kod veya rezervasyon belirtilmedi");
}

function asDomainError(error: unknown): DomainError | null {
  if (error instanceof DomainError) return error;
  // Gelmedi misafirin masası bu arada başkasına verilmiş olabilir (aktif masa tekil index'i).
  if (pgCodeOf(error) === "23505" && pgConstraintOf(error) === "reservations_active_table_uq") {
    return new DomainError("conflict", MSG.tableTaken);
  }
  return null;
}

function logOutcome(result: StoredResult) {
  if (result.ok) return result.data.outcome;
  return result.code === "not_found" ? "not_found" : "invalid_status";
}

async function replay(tx: Tx, idempotencyKey: string, print: string): Promise<StoredResult> {
  const [row] = await tx
    .select({
      response: checkInEvents.response,
      requestFingerprint: checkInEvents.requestFingerprint,
    })
    .from(checkInEvents)
    .where(eq(checkInEvents.idempotencyKey, idempotencyKey));
  const stored = storedResultSchema.safeParse(row?.response);
  if (!row || row.requestFingerprint !== print || !stored.success) {
    return { ok: false, code: "conflict", message: CHECK_IN_MSG.keyReused };
  }
  return stored.data;
}

/**
 * Kapıda giriş (QR, eski QR hash'i ya da manuel). Tek transaction:
 * 1. `idempotencyKey` `check_in_events`'e `ON CONFLICT DO NOTHING` ile yazılır. Anahtar zaten varsa
 *    (ya da eşzamanlı bir istek yazıyorsa, onun commit'i beklenir) ilk çağrının saklanan sonucu döner.
 * 2. Karar bir kayıt noktasında verilir: etkinlik `FOR SHARE` kilitlenir, rezervasyon çözülür,
 *    tek koşullu UPDATE giriş yapar; sayaçlar ve canlı yayın aynı transaction'dadır.
 * 3. Sonuç (iş kuralı hatası dahil) anahtar satırına yazılır; tekrarlar aynı yanıtı alır.
 *
 * Zaten giriş yapılmışsa hata değil `already_checked_in` döner (kim, ne zaman). İptal edilmiş
 * rezervasyon ve başka etkinliğin QR'ı `conflict`, bilinmeyen kod `not_found` fırlatır.
 */
export async function checkIn(db: Executor, actor: Actor, raw: CheckInInput): Promise<CheckInSuccess> {
  const input = checkInInput.parse(raw);
  const ref = refOf(input);
  const print = fingerprint(input.eventId, ref);
  const clientTimestamp = input.clientTimestamp ? new Date(input.clientTimestamp) : null;

  const result = await db.transaction(async (tx): Promise<StoredResult> => {
    const [claimed] = await tx
      .insert(checkInEvents)
      .values({
        idempotencyKey: input.idempotencyKey,
        actorId: actor.id,
        clientTimestamp,
        outcome: "not_found",
        requestFingerprint: print,
      })
      .onConflictDoNothing({ target: checkInEvents.idempotencyKey })
      .returning({ id: checkInEvents.id });
    if (!claimed) return replay(tx, input.idempotencyKey, print);

    const found: { reservationId: string | null } = { reservationId: null };
    let stored: StoredResult;
    try {
      stored = await tx.transaction(async (sp): Promise<StoredResult> => {
        const event = await lockEvent(sp, actor, input.eventId);
        assertCheckInOpen(event);
        const reservationId = await resolveReservation(sp, event.id, ref);
        found.reservationId = reservationId;

        const changed = await markCheckedIn(sp, {
          reservationId,
          event,
          actorId: actor.id,
          clientTimestamp,
        });
        const { status, response } = await readCheckIn(
          sp,
          reservationId,
          changed ? "checked_in" : "already_checked_in",
        );
        if (response) {
          // "Zaten yapıldı" yanıtında yayın yok: durum değişmedi.
          if (changed) await publishCheckIn(sp, event.id, reservationId);
          return { ok: true, data: response };
        }
        if (status === "cancelled") throw new DomainError("conflict", CHECK_IN_MSG.cancelled);
        throw new DomainError("conflict", "Rezervasyonun durumu check-in için uygun değil");
      });
    } catch (error) {
      const domain = asDomainError(error);
      if (!domain) throw error;
      stored = { ok: false, code: domain.code, message: domain.message };
    }

    await tx
      .update(checkInEvents)
      .set({
        reservationId: found.reservationId,
        outcome: logOutcome(stored),
        response: stored,
      })
      .where(eq(checkInEvents.id, claimed.id));
    return stored;
  });

  if (!result.ok) throw new DomainError(result.code, result.message);
  return result.data;
}
