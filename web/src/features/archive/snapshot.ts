import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import {
  type ArchiveDetails,
  eventArchives,
  eventExtraStaff,
  eventStaffAssignments,
  eventTables,
  reservations,
  tickets,
} from "@/db/schema";
import { effectiveSellable, SALE_CATEGORIES, SALE_CATEGORY_LABELS } from "@/domain/seating";
import { getEventOrThrow } from "@/features/events/service";
import { getFinanceSummary } from "@/features/finance/queries";
import { getSalesTotals } from "@/features/ticketing/stats";

/** `archivedAt` (zorunlu sütun) `archiveEvent`'te eklenir; anlık görüntü onu taşımaz. */
type ArchiveInsert = Omit<typeof eventArchives.$inferInsert, "archivedAt">;

/** Masa metrikleri (Karar 9): casino kapasitesi, online masaların fiilen satışa açılan koltuğu. */
async function tableMetrics(tx: Tx, eventId: string) {
  const rows = await tx
    .select({
      allocation: eventTables.allocation,
      capacity: eventTables.capacity,
      sellableSeats: eventTables.sellableSeats,
    })
    .from(eventTables)
    .where(eq(eventTables.eventId, eventId));
  const m = {
    tableCount: rows.length,
    totalCapacity: 0,
    casinoTableCount: 0,
    casinoSeatCount: 0,
    onlineTableCount: 0,
    sellableSeatCount: 0,
  };
  for (const t of rows) {
    m.totalCapacity += t.capacity;
    if (t.allocation === "casino") {
      m.casinoTableCount += 1;
      m.casinoSeatCount += t.capacity;
    } else if (t.allocation === "online") {
      m.onlineTableCount += 1;
      m.sellableSeatCount += effectiveSellable(t);
    }
  }
  return m;
}

/** Rezervasyon metrikleri (Karar 8): iptaller sayılmaz; bekleyen/onaylı rezervasyon gelmemiş sayılır. */
async function reservationMetrics(tx: Tx, eventId: string) {
  const [row] = await tx
    .select({
      reservationCount: sql<number>`count(*) filter (where ${reservations.status} <> 'cancelled')::int`,
      reservationsCheckedIn: sql<number>`count(*) filter (where ${reservations.status} = 'checked_in')::int`,
      reservationsNoShow: sql<number>`count(*) filter (where ${reservations.status} in ('no_show', 'pending', 'confirmed'))::int`,
      guestsExpected: sql<number>`coalesce(sum(${reservations.guestCount}) filter (where ${reservations.status} <> 'cancelled'), 0)::int`,
      guestsCheckedIn: sql<number>`coalesce(sum(${reservations.guestCount}) filter (where ${reservations.status} = 'checked_in'), 0)::int`,
    })
    .from(reservations)
    .where(eq(reservations.eventId, eventId));
  return {
    reservationCount: row?.reservationCount ?? 0,
    reservationsCheckedIn: row?.reservationsCheckedIn ?? 0,
    reservationsNoShow: row?.reservationsNoShow ?? 0,
    guestsExpected: row?.guestsExpected ?? 0,
    guestsCheckedIn: row?.guestsCheckedIn ?? 0,
  };
}

/** F&B ekibi (Karar 10): etkin atamalardaki tekil personel + etkin ek personel. */
async function fnbStaffCount(tx: Tx, eventId: string): Promise<number> {
  const [assigned] = await tx
    .select({ n: sql<number>`count(distinct ${eventStaffAssignments.staffId})::int` })
    .from(eventStaffAssignments)
    .where(and(eq(eventStaffAssignments.eventId, eventId), eq(eventStaffAssignments.isActive, true)));
  const [extra] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(eventExtraStaff)
    .where(and(eq(eventExtraStaff.eventId, eventId), eq(eventExtraStaff.isActive, true)));
  return (assigned?.n ?? 0) + (extra?.n ?? 0);
}

/** Kapı dağılımı (Karar 12): kapı numarası artan, kapısı boş grup (`null`) en sonda. */
async function gateBreakdown(tx: Tx, eventId: string): Promise<ArchiveDetails["gates"]> {
  const [ticketRows, reservationRows] = await Promise.all([
    tx
      .select({ gate: tickets.checkInGate, n: sql<number>`count(*)::int` })
      .from(tickets)
      .where(and(eq(tickets.eventId, eventId), isNotNull(tickets.checkedInAt)))
      .groupBy(tickets.checkInGate),
    tx
      .select({ gate: reservations.checkInGate, n: sql<number>`count(*)::int` })
      .from(reservations)
      .where(and(eq(reservations.eventId, eventId), eq(reservations.status, "checked_in")))
      .groupBy(reservations.checkInGate),
  ]);
  const byGate = new Map<number | null, { gate: number | null; tickets: number; reservations: number }>();
  const slot = (gate: number | null) => {
    let s = byGate.get(gate);
    if (!s) {
      s = { gate, tickets: 0, reservations: 0 };
      byGate.set(gate, s);
    }
    return s;
  };
  for (const r of ticketRows) slot(r.gate).tickets = r.n;
  for (const r of reservationRows) slot(r.gate).reservations = r.n;
  return [...byGate.values()].sort((a, b) => {
    if (a.gate === null) return b.gate === null ? 0 : 1;
    if (b.gate === null) return -1;
    return a.gate - b.gate;
  });
}

/**
 * Etkinliğin anlık görüntüsünü kaynak tablolardan kurar; yalnızca okur. `revision`, `archivedAt` ve
 * `archivedBy` `archiveEvent`'indir. Para alanları kaynak dizgelerden aynen kopyalanır (aritmetik yok).
 */
export async function buildArchiveSnapshot(tx: Tx, eventId: string): Promise<ArchiveInsert> {
  const event = await getEventOrThrow(tx, eventId);
  const [finance, sales, tablesM, resM, staffCount, gates] = await Promise.all([
    getFinanceSummary(tx, eventId),
    getSalesTotals(tx, eventId),
    tableMetrics(tx, eventId),
    reservationMetrics(tx, eventId),
    fnbStaffCount(tx, eventId),
    gateBreakdown(tx, eventId),
  ]);

  const details: ArchiveDetails = {
    categories: SALE_CATEGORIES.map((category) => ({
      category,
      label: SALE_CATEGORY_LABELS[category],
      issued: sales.byCategory[category].issued,
      revenue: sales.byCategory[category].revenue,
    })),
    financeItems: finance.items.map((i) => ({
      direction: i.direction,
      category: i.category,
      label: i.label,
      estimatedAmount: i.estimatedAmount,
      actualAmount: i.actualAmount,
    })),
    gates,
  };

  return {
    eventId,
    eventName: event.name,
    startsAt: event.startsAt,
    eventType: event.eventType,
    artistId: event.artistId,
    artistName: event.artistName,
    currency: finance.currency,
    artistFee: finance.artistFee,
    estimatedExpense: finance.estimatedExpense,
    actualExpense: finance.actualExpense,
    estimatedOtherIncome: finance.estimatedOtherIncome,
    actualOtherIncome: finance.actualOtherIncome,
    ticketsSold: sales.issued,
    ticketRevenue: sales.revenue,
    demoTicketsSold: sales.demoIssued,
    demoTicketRevenue: sales.demoRevenue,
    ticketsCheckedIn: sales.checkedIn,
    ...tablesM,
    ...resM,
    fnbStaffCount: staffCount,
    details,
  };
}

/** Anlık görüntüyü yazar; varsa `revision + 1` ile üzerine yazar. Durum denetimi çağırandadır. */
export async function archiveEvent(tx: Tx, eventId: string, actorId: string | null): Promise<void> {
  const snap = await buildArchiveSnapshot(tx, eventId);
  const now = new Date();
  const values: Partial<ArchiveInsert> = { ...snap };
  delete values.eventId;
  await tx
    .insert(eventArchives)
    .values({ ...snap, revision: 1, archivedAt: now, archivedBy: actorId })
    .onConflictDoUpdate({
      target: eventArchives.eventId,
      set: {
        ...values,
        revision: sql`${eventArchives.revision} + 1`,
        archivedAt: now,
        archivedBy: actorId,
      },
    });
}
