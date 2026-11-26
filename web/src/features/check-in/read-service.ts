import { and, asc, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { customers, eventTables, events, orders, reservations, tickets } from "@/db/schema";
import type { ReservationStatus } from "@/domain/reservation-status";
import type { Actor } from "@/features/auth/session";
import { MSG, type Executor } from "@/features/reservations/internal";
import { getSalesTotals } from "@/features/ticketing/stats";
import { DomainError } from "@/lib/action";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import type { SearchGuestsInput } from "./schemas";
import { toEventStats, type EventStats } from "./stats";
import { escapeLike } from "@/lib/identifiers";
import { normalizeCode } from "@/lib/short-code";

export type { EventStats } from "./stats";

const SEARCH_LIMIT = 50;
async function assertEventAccess(db: Executor, actor: Actor, eventId: string) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) throw new DomainError("not_found", MSG.eventNotFound);
  return event;
}

/** Check-in ekranı başlığı için etkinlik (erişim denetimli). */
export async function getCheckInEvent(db: Executor, actor: Actor, eventId: string) {
  const event = await assertEventAccess(db, actor, eventId);
  return {
    id: event.id,
    name: event.name,
    status: event.status,
    startsAt: event.startsAt,
  };
}

/**
 * Etkinlik istatistikleri — tek sorgu (etkinlik erişimi + durum sayıları + kişi toplamları).
 * Beklenen = bekleyen + onaylı + giriş yaptı; kalan = bekleyen + onaylı.
 */
export async function eventStats(db: Executor, actor: Actor, eventId: string): Promise<EventStats> {
  const n = (status: ReservationStatus) =>
    sql<number>`(count(${reservations.id}) filter (where ${reservations.status} = ${status}))::int`;
  const [row] = await db
    .select({
      organizerId: events.organizerId,
      pending: n("pending"),
      confirmed: n("confirmed"),
      checkedIn: n("checked_in"),
      cancelled: n("cancelled"),
      noShow: n("no_show"),
      expectedGuests: sql<number>`coalesce(sum(${reservations.guestCount}) filter (where ${reservations.status} in ('pending', 'confirmed', 'checked_in')), 0)::int`,
      checkedInGuests: sql<number>`coalesce(sum(${reservations.guestCount}) filter (where ${reservations.status} = 'checked_in'), 0)::int`,
    })
    .from(events)
    .leftJoin(reservations, eq(reservations.eventId, events.id))
    .where(eq(events.id, eventId))
    .groupBy(events.id);
  if (!row) throw new DomainError("not_found", MSG.eventNotFound);
  const sales = await getSalesTotals(db, eventId);
  return toEventStats(
    {
      pending: row.pending,
      confirmed: row.confirmed,
      checkedIn: row.checkedIn,
      cancelled: row.cancelled,
      noShow: row.noShow,
      expectedGuests: row.expectedGuests,
      checkedInGuests: row.checkedInGuests,
    },
    // Demo biletler de kapıdan girer; `issued` demo hariç olduğundan ayrıca eklenir.
    { issued: sales.issued + sales.demoIssued, checkedIn: sales.checkedIn },
  );
}

export type GuestRow = {
  reservationId: string;
  status: ReservationStatus;
  guestName: string;
  phoneLast4: string | null;
  guestCount: number;
  tableId: string;
  tableLabel: string;
  tableCapacity: number;
  checkedInAt: string | null;
  isBlacklisted: boolean;
};

function searchCondition(q: string): SQL | undefined {
  const pattern = `%${escapeLike(q)}%`;
  const conditions: SQL[] = [
    ilike(reservations.guestName, pattern),
    ilike(customers.fullName, pattern),
    ilike(eventTables.label, pattern),
  ];
  const digits = q.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length >= 3) {
    conditions.push(ilike(customers.phoneNormalized, `%${digits}%`));
    conditions.push(
      sql`regexp_replace(coalesce(${reservations.guestPhone}, ''), '\\D', '', 'g') like ${`%${digits}%`}`,
    );
  }
  const code = normalizeCode(q);
  if (code.length === 7 && code.startsWith("R")) conditions.push(eq(reservations.bookingCode, code));
  return or(...conditions);
}

/**
 * Manuel arama: ada, telefona ya da masa etiketine göre (en çok 50 satır, masa etiketine göre).
 * Telefon kapıda yalnızca son 4 hanesiyle gösterilir.
 */
export async function searchGuests(db: Executor, actor: Actor, input: SearchGuestsInput): Promise<GuestRow[]> {
  const event = await assertEventAccess(db, actor, input.eventId);
  const conditions: SQL[] = [eq(reservations.eventId, event.id)];
  if (input.q) {
    const search = searchCondition(input.q);
    if (search) conditions.push(search);
  }
  const rows = await db
    .select({
      reservationId: reservations.id,
      status: reservations.status,
      guestName: sql<string>`coalesce(${reservations.guestName}, ${customers.fullName})`,
      phone: sql<string | null>`coalesce(${reservations.guestPhone}, ${customers.phone})`,
      guestCount: reservations.guestCount,
      tableId: reservations.tableId,
      tableLabel: eventTables.label,
      tableCapacity: eventTables.capacity,
      checkedInAt: reservations.checkedInAt,
      isBlacklisted: customers.isBlacklisted,
    })
    .from(reservations)
    .innerJoin(
      eventTables,
      and(eq(eventTables.eventId, reservations.eventId), eq(eventTables.id, reservations.tableId)),
    )
    .innerJoin(customers, eq(customers.id, reservations.customerId))
    .where(and(...conditions))
    .orderBy(asc(eventTables.label), asc(reservations.id))
    .limit(SEARCH_LIMIT);
  return rows.map(({ phone, checkedInAt, ...row }) => {
    const digits = phone?.replace(/\D/g, "") ?? "";
    return {
      ...row,
      phoneLast4: digits.length >= 4 ? digits.slice(-4) : null,
      checkedInAt: checkedInAt?.toISOString() ?? null,
    };
  });
}

export type RecentCheckIn = {
  /** Liste anahtarı: rezervasyon ya da bilet kimliği. */
  id: string;
  kind: "reservation" | "ticket";
  reservationId: string | null;
  guestName: string;
  tableLabel: string;
  guestCount: number;
  checkedInAt: string | null;
};

/** Son giriş yapanlar: rezervasyon ve bilet girişleri tek listede (en yeni önce). */
export async function recentCheckIns(
  db: Executor,
  actor: Actor,
  eventId: string,
  limit = 10,
): Promise<RecentCheckIn[]> {
  const event = await assertEventAccess(db, actor, eventId);
  const reservationRows = await db
    .select({
      reservationId: reservations.id,
      guestName: sql<string>`coalesce(${reservations.guestName}, ${customers.fullName})`,
      tableLabel: eventTables.label,
      guestCount: reservations.guestCount,
      checkedInAt: reservations.checkedInAt,
    })
    .from(reservations)
    .innerJoin(
      eventTables,
      and(eq(eventTables.eventId, reservations.eventId), eq(eventTables.id, reservations.tableId)),
    )
    .innerJoin(customers, eq(customers.id, reservations.customerId))
    .where(and(eq(reservations.eventId, event.id), eq(reservations.status, "checked_in")))
    .orderBy(sql`${reservations.checkedInAt} desc nulls last`, desc(reservations.id))
    .limit(limit);
  const ticketRows = await db
    .select({
      ticketId: tickets.id,
      firstName: orders.buyerFirstName,
      lastName: orders.buyerLastName,
      tableLabel: eventTables.label,
      checkedInAt: tickets.checkedInAt,
    })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(eventTables, and(eq(eventTables.eventId, tickets.eventId), eq(eventTables.id, tickets.tableId)))
    .where(and(eq(tickets.eventId, event.id), eq(tickets.status, "issued"), isNotNull(tickets.checkedInAt)))
    .orderBy(desc(tickets.checkedInAt), desc(tickets.id))
    .limit(limit);
  const merged: RecentCheckIn[] = [
    ...reservationRows.map((r) => ({
      id: r.reservationId,
      kind: "reservation" as const,
      reservationId: r.reservationId,
      guestName: r.guestName,
      tableLabel: r.tableLabel,
      guestCount: r.guestCount,
      checkedInAt: r.checkedInAt?.toISOString() ?? null,
    })),
    ...ticketRows.map((t) => ({
      id: t.ticketId,
      kind: "ticket" as const,
      reservationId: null,
      guestName:
        [t.firstName, t.lastName].filter((p) => p && p.trim() !== "").join(" ") || "Bilet",
      tableLabel: t.tableLabel,
      guestCount: 1,
      checkedInAt: t.checkedInAt?.toISOString() ?? null,
    })),
  ];
  // ISO dizgeleri aynı biçimde olduğundan sözcük sırası zaman sırasıdır; zamansız satırlar sona.
  merged.sort((a, b) => {
    if (a.checkedInAt === b.checkedInAt) return a.id < b.id ? 1 : -1;
    if (a.checkedInAt === null) return 1;
    if (b.checkedInAt === null) return -1;
    return a.checkedInAt < b.checkedInAt ? 1 : -1;
  });
  return merged.slice(0, limit);
}

export type CheckInEvent = {
  id: string;
  name: string;
  status: "published" | "active" | "completed";
  startsAt: Date;
  isToday: boolean;
};

/**
 * Check-in için etkinlik seçici: yayında/devam eden ve son 3 günde tamamlanmış etkinlikler.
 * Sıra: devam eden → bugün (Kıbrıs saati) başlayan → başlangıcı şimdiye en yakın.
 */
export async function listCheckInEvents(db: Executor): Promise<CheckInEvent[]> {
  const isToday = sql<boolean>`(${events.startsAt} at time zone ${APP_TIME_ZONE}::text)::date = (now() at time zone ${APP_TIME_ZONE}::text)::date`;
  const conditions: SQL[] = [
    or(
      inArray(events.status, ["published", "active"]),
      and(eq(events.status, "completed"), sql`${events.startsAt} >= now() - interval '3 days'`),
    ) ?? sql`false`,
  ];
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      status: events.status,
      startsAt: events.startsAt,
      isToday,
    })
    .from(events)
    .where(and(...conditions))
    .orderBy(
      sql`(${events.status} = 'active') desc`,
      sql`${isToday} desc`,
      sql`abs(extract(epoch from (${events.startsAt} - now())))`,
      asc(events.id),
    )
    .limit(50);
  return rows.flatMap((r) =>
    r.status === "published" || r.status === "active" || r.status === "completed" ? [{ ...r, status: r.status }] : [],
  );
}
