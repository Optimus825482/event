import { and, asc, count, desc, eq, gte, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db as defaultDb } from "@/db/client";
import { customers, eventTables, events, reservations } from "@/db/schema";
import { RESERVATION_STATUSES, type ReservationStatus } from "@/domain/reservation-status";
import { requirePolicyActor } from "@/features/auth/permissions";
import type { Actor } from "@/features/auth/session";
import { authorize, can } from "@/features/auth/policy";
import { listRecipients } from "@/features/invitations/event-invitation";
import { searchCustomers } from "@/features/customers/queries";
import { DomainError } from "@/lib/action";
import { escapeLike, isUuid } from "@/lib/identifiers";
import { zonedDayStart, zonedNextDayStart } from "@/lib/time-zone";
import { MSG, type Executor } from "./internal";
import { getReservationPlan } from "./plan-service";
import { availableTables } from "./read-service";
import { listReservationsInput, type ListReservationsInput } from "./schemas";


async function accessibleEvent(db: Executor, actor: Actor, eventId: string) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) throw new DomainError("not_found", MSG.eventNotFound);
  return event;
}

/** `withCustomer` yalnızca `customers:view` olanlar içindir; yoksa yalnızca rezervasyonun kendi alanlarında aranır. */
function searchCondition(q: string, withCustomer: boolean): SQL | undefined {
  const pattern = `%${escapeLike(q)}%`;
  const conditions: SQL[] = [
    ilike(reservations.guestName, pattern),
    ilike(reservations.guestEmail, pattern),
    ilike(eventTables.label, pattern),
  ];
  if (withCustomer) conditions.push(ilike(customers.fullName, pattern));
  const digits = q.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length >= 3) {
    if (withCustomer) conditions.push(ilike(customers.phoneNormalized, `%${digits}%`));
    conditions.push(sql`regexp_replace(coalesce(${reservations.guestPhone}, ''), '\\D', '', 'g') like ${`%${digits}%`}`);
  }
  return or(...conditions);
}

/** Etkinliğin rezervasyonları: ada/telefona/masaya göre arama, durum süzgeci, sayfalama, durum sayıları. */
export async function listReservations(db: Executor, actor: Actor, raw: ListReservationsInput) {
  authorize(actor, "reservations", "view");
  const input = listReservationsInput.parse(raw);
  const event = await accessibleEvent(db, actor, input.eventId);
  const seeCustomers = can(actor, "customers", "view");

  const conditions: SQL[] = [eq(reservations.eventId, event.id)];
  if (input.status) conditions.push(eq(reservations.status, input.status));
  if (input.q) {
    const search = searchCondition(input.q, seeCustomers);
    if (search) conditions.push(search);
  }
  const where = and(...conditions);
  const joinTable = and(eq(eventTables.eventId, reservations.eventId), eq(eventTables.id, reservations.tableId));

  const [items, totals, byStatus] = await Promise.all([
    db
      .select({
        id: reservations.id,
        bookingCode: reservations.bookingCode,
        status: reservations.status,
        guestCount: reservations.guestCount,
        guestName: reservations.guestName,
        guestPhone: reservations.guestPhone,
        guestEmail: reservations.guestEmail,
        specialRequests: reservations.specialRequests,
        tableId: reservations.tableId,
        tableLabel: eventTables.label,
        tableCapacity: eventTables.capacity,
        customerId: reservations.customerId,
        customerName: customers.fullName,
        isBlacklisted: customers.isBlacklisted,
        createdAt: reservations.createdAt,
      })
      .from(reservations)
      .innerJoin(eventTables, joinTable)
      .innerJoin(customers, eq(customers.id, reservations.customerId))
      .where(where)
      .orderBy(desc(reservations.createdAt), desc(reservations.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    db
      .select({ n: count() })
      .from(reservations)
      .innerJoin(eventTables, joinTable)
      .innerJoin(customers, eq(customers.id, reservations.customerId))
      .where(where),
    db
      .select({ status: reservations.status, n: count() })
      .from(reservations)
      .where(eq(reservations.eventId, event.id))
      .groupBy(reservations.status),
  ]);

  const statusCounts = Object.fromEntries(RESERVATION_STATUSES.map((s) => [s, 0])) as Record<ReservationStatus, number>;
  for (const row of byStatus) statusCounts[row.status] = row.n;

  const visible = seeCustomers ? items : items.map((item) => ({ ...item, customerName: null }));
  return { event, items: visible, total: totals[0]?.n ?? 0, page: input.page, pageSize: input.pageSize, statusCounts };
}

/**
 * Tek rezervasyon (masa ve müşteri ile). Yoksa ya da erişilemiyorsa `null`. `customer` bloğu
 * (ad, iletişim, sayaçlar) yalnızca `customers:view` olanlara döner; `isBlacklisted` durum
 * işlemleri için herkese döner.
 */
export async function getReservationDetail(db: Executor, actor: Actor, id: string) {
  authorize(actor, "reservations", "view");
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({
      reservation: reservations,
      tableLabel: eventTables.label,
      tableCapacity: eventTables.capacity,
      customer: {
        id: customers.id,
        fullName: customers.fullName,
        phone: customers.phone,
        email: customers.email,
        isBlacklisted: customers.isBlacklisted,
        noShowCount: customers.noShowCount,
        totalReservations: customers.totalReservations,
      },
      event: events,
    })
    .from(reservations)
    .innerJoin(eventTables, and(eq(eventTables.eventId, reservations.eventId), eq(eventTables.id, reservations.tableId)))
    .innerJoin(customers, eq(customers.id, reservations.customerId))
    .innerJoin(events, eq(events.id, reservations.eventId))
    .where(eq(reservations.id, id));
  if (!row) return null;
  const { customer, ...rest } = row;
  return { ...rest, isBlacklisted: customer.isBlacklisted, customer: can(actor, "customers", "view") ? customer : null };
}

function rethrowNotFound(error: unknown): never {
  if (error instanceof DomainError && error.code === "not_found") notFound();
  throw error;
}

// --- Sunucu Bileşenleri için yükleyiciler (oturumdaki kullanıcıyla) ---

export async function loadReservationList(eventId: string, raw: Omit<ListReservationsInput, "eventId">) {
  const actor = await requirePolicyActor();
  authorize(actor, "reservations", "view");
  if (!isUuid(eventId)) notFound();
  try {
    return { actor, ...(await listReservations(defaultDb, actor, { ...raw, eventId })) };
  } catch (error) {
    return rethrowNotFound(error);
  }
}

export async function loadNewReservationPage(eventId: string, customerQuery: string | undefined) {
  const actor = await requirePolicyActor();
  authorize(actor, "reservations", "view");
  if (!isUuid(eventId)) notFound();
  try {
    const event = await accessibleEvent(defaultDb, actor, eventId);
    const tables = await availableTables(defaultDb, actor, { eventId });
    const { plan, statuses } = await getReservationPlan(defaultDb, actor, eventId);
    const q = customerQuery?.trim();
    const customerResults =
      q && can(actor, "customers", "view") ? (await searchCustomers(defaultDb, actor, { q, pageSize: 10 })).items : [];
    return { actor, event, tables, plan, statuses, customerResults };
  } catch (error) {
    return rethrowNotFound(error);
  }
}

export async function loadReservationDetail(eventId: string, id: string) {
  const actor = await requirePolicyActor();
  authorize(actor, "reservations", "view");
  const detail = await getReservationDetail(defaultDb, actor, id);
  if (!detail || detail.event.id !== eventId) notFound();
  const tables = await availableTables(defaultDb, actor, { eventId, excludeReservationId: id });
  return { actor, ...detail, tables };
}

/** Etkinlik rezervasyon haritası (durum renkli plan + masa rezervasyonları). */
export async function loadReservationMap(eventId: string) {
  const actor = await requirePolicyActor();
  authorize(actor, "reservations", "view");
  if (!isUuid(eventId)) notFound();
  try {
    return await getReservationPlan(defaultDb, actor, eventId);
  } catch (error) {
    return rethrowNotFound(error);
  }
}

/**
 * Rezervasyon ana ekranı: bugünden itibaren (iptal edilmemiş) yaklaşan etkinlikler, en yakın önce.
 * İlk etkinlik hero kartında gösterilir.
 */
export async function loadReservationDashboard(raw: { search?: string }) {
  const actor = await requirePolicyActor();
  authorize(actor, "reservations", "view");
  const search = raw.search?.trim() || undefined;
  const dayStart = zonedDayStart(new Date());

  const conditions: SQL[] = [gte(events.startsAt, dayStart), ne(events.status, "cancelled")];
  if (search) conditions.push(ilike(events.name, `%${escapeLike(search)}%`));

  const items = await defaultDb
    .select({
      id: events.id,
      name: events.name,
      status: events.status,
      startsAt: events.startsAt,
      reservationCount: sql<number>`(select count(*)::int from ${reservations} where ${reservations.eventId} = "events"."id")`,
      checkedInCount: sql<number>`(select count(*)::int from ${reservations} where ${reservations.eventId} = "events"."id" and ${reservations.status} = 'checked_in')`,
      tableCount: sql<number>`(select count(*)::int from ${eventTables} where ${eventTables.eventId} = "events"."id")`,
      capacity: sql<number>`(select coalesce(sum(${eventTables.capacity}), 0)::int from ${eventTables} where ${eventTables.eventId} = "events"."id")`,
    })
    .from(events)
    .where(and(...conditions))
    .orderBy(asc(events.startsAt), asc(events.id))
    .limit(48);

  const dayEnd = zonedNextDayStart(dayStart);
  const todayCount = items.filter((e) => e.startsAt < dayEnd).length;
  return { actor, search, items, todayCount };
}

/** E-davetiye penceresi için alıcılar; yalnızca `invitations:view` olanlara döner, yoksa `null`. */
export async function loadInvitationRecipients(actor: Actor, eventId: string) {
  if (!can(actor, "invitations", "view")) return null;
  return listRecipients(defaultDb, actor, { eventId });
}
