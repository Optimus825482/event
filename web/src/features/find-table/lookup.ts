import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { customers, events, reservations } from "@/db/schema";
import { findOrderByPnr } from "@/features/ticketing/orders-service";
import { lastNameKeyOf, nameKey } from "@/lib/name-key";
import { parseBookingCode, parsePnr } from "@/lib/code-format";
import { createFindTableLimiters, FindTableRateLimitedError, type FindTableLimiters } from "./rate-limit";
import { signFindTableToken } from "./token";
import { eventWindowOpen } from "./window";

const DUMMY_DIGEST = createHash("sha256").update("find-table:no-such-key").digest();

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

async function guard(limiter: FindTableLimiters["ip"], key: string): Promise<void> {
  let decision;
  try {
    decision = await limiter.check(key);
  } catch {
    // Sınırlayıcı çalışmıyorsa arama kapalı kalır.
    throw new FindTableRateLimitedError(60);
  }
  if (!decision.allowed) throw new FindTableRateLimitedError(decision.retryAfterSeconds);
}

async function eventInWindow(db: Db, eventId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eventWindowOpen()));
  return row !== undefined;
}

/**
 * Kod (PNR ya da rezervasyon kodu) + soyad ile masa görünümü belirteci üretir. Eşleşmeyen her durum `null`;
 * ret nedeni dışarı verilmez. Kod ve soyad günlüğe yazılmaz.
 */
export async function findTableByCode(
  db: Db,
  input: { code: string; lastName: string },
  ctx: { ip: string },
  deps: { limiters?: FindTableLimiters } = {},
): Promise<{ token: string } | null> {
  const limiters = deps.limiters ?? createFindTableLimiters(db);
  // IP sayacı her denemeyi önce sayar (eşzamanlı patlamalar da sınırlanır); başarılı arama sayımı geri alır,
  // böylece yalnızca başarısız denemeler (yanlış kod/soyad, biçimsiz kod) birikir.
  await guard(limiters.ip, ctx.ip);
  const found = await lookup(db, input, limiters);
  if (found) await limiters.ip.refund?.(ctx.ip);
  return found;
}

async function lookup(
  db: Db,
  input: { code: string; lastName: string },
  limiters: FindTableLimiters,
): Promise<{ token: string } | null> {
  const pnrCode = parsePnr(input.code);
  const code = pnrCode ?? parseBookingCode(input.code);
  if (code === null) return null;
  const isPnr = pnrCode !== null;
  await guard(limiters.code, code);

  const wanted = nameKey(input.lastName);
  if (wanted === "") return null;

  if (isPnr) {
    const found = await findOrderByPnr(db, { pnr: code, lastName: input.lastName });
    if (!found || !(await eventInWindow(db, found.eventId))) return null;
    return { token: signFindTableToken("order", found.orderId) };
  }

  const [row] = await db
    .select({
      id: reservations.id,
      name: sql<string>`coalesce(${reservations.guestName}, ${customers.fullName})`,
    })
    .from(reservations)
    .innerJoin(customers, eq(customers.id, reservations.customerId))
    .innerJoin(events, eq(events.id, reservations.eventId))
    .where(
      and(
        eq(reservations.bookingCode, code),
        inArray(reservations.status, ["pending", "confirmed", "checked_in"]),
        eventWindowOpen(),
      ),
    );
  const storedKey = row ? lastNameKeyOf(row.name) : "";
  const same = timingSafeEqual(digest(wanted), storedKey === "" ? DUMMY_DIGEST : digest(storedKey));
  if (!row || storedKey === "" || !same) return null;
  return { token: signFindTableToken("reservation", row.id) };
}
