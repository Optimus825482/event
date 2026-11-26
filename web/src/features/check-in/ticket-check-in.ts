import { and, eq, sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { eventTables, orders, tickets, users } from "@/db/schema";
import type { EventRow } from "@/features/events/service";
import { DomainError } from "@/lib/action";
import { CHECK_IN_MSG, checkedInAtExpr, publishCheckIn, type CheckInOutcome, type CheckInSuccess } from "./internal";

/**
 * Tek koşullu UPDATE: yalnızca henüz girmemiş `issued` bilet içeri alınır. Eşzamanlı isteklerden
 * yalnızca biri satır döndürür (diğerleri satır kilidini bekler, güncel durumu yeniden değerlendirir).
 */
export async function markTicketCheckedIn(
  tx: Tx,
  input: { ticketId: string; eventId: string; actorId: string; clientTimestamp: Date | null; gate: number | null },
): Promise<boolean> {
  const rows = await tx
    .update(tickets)
    .set({
      checkedInAt: checkedInAtExpr(input.clientTimestamp),
      checkedInBy: input.actorId,
      checkInGate: input.gate,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(tickets.id, input.ticketId),
        eq(tickets.eventId, input.eventId),
        eq(tickets.status, "issued"),
        sql`${tickets.checkedInAt} is null`,
      ),
    )
    .returning({ id: tickets.id });
  return rows.length > 0;
}

/** Biletin güncel giriş bilgisini okur; giriş yapılmışsa yanıtı, değilse (zaman duyarlı) durumu döndürür. */
export async function readTicketCheckIn(
  tx: Tx,
  ticketId: string,
  outcome: CheckInOutcome,
): Promise<{ status: "held" | "issued" | "expired"; response: CheckInSuccess | null }> {
  const [row] = await tx
    .select({
      // Süresi dolmuş tutma, süpürülmemiş olsa da `expired` okunur (DB saatiyle).
      status: sql<
        "held" | "issued" | "expired"
      >`case when ${tickets.status} = 'held' and ${orders.status} = 'pending' and ${orders.holdExpiresAt} <= clock_timestamp() then 'expired' else ${tickets.status} end`,
      ticketId: tickets.id,
      eventId: tickets.eventId,
      tableId: tickets.tableId,
      tableLabel: eventTables.label,
      pnr: orders.pnr,
      buyerFirstName: orders.buyerFirstName,
      buyerLastName: orders.buyerLastName,
      checkedInAt: tickets.checkedInAt,
      gate: tickets.checkInGate,
      byId: users.id,
      byUsername: users.username,
    })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(eventTables, and(eq(eventTables.eventId, tickets.eventId), eq(eventTables.id, tickets.tableId)))
    .leftJoin(users, eq(users.id, tickets.checkedInBy))
    .where(eq(tickets.id, ticketId));
  if (!row) throw new DomainError("not_found", CHECK_IN_MSG.ticketNotFound);
  if (!row.checkedInAt) return { status: row.status, response: null };
  const name = [row.buyerFirstName, row.buyerLastName].filter((p) => p && p.trim() !== "").join(" ");
  const response: CheckInSuccess = {
    outcome,
    kind: "ticket",
    reservationId: null,
    ticketId: row.ticketId,
    pnr: row.pnr,
    gate: row.gate,
    eventId: row.eventId,
    guestName: name === "" ? null : name,
    guestCount: 1,
    tableId: row.tableId,
    tableLabel: row.tableLabel,
    checkedInAt: row.checkedInAt.toISOString(),
    checkedInBy: row.byId && row.byUsername ? { id: row.byId, username: row.byUsername } : null,
  };
  return { status: row.status, response };
}

/** Bileti içeri alır ya da "zaten yapıldı" yanıtını döndürür; ödenmemiş/süresi dolmuş bilet `conflict` verir. */
export async function checkInTicket(
  sp: Tx,
  input: { ticketId: string; event: EventRow; actorId: string; clientTimestamp: Date | null; gate: number | null },
): Promise<CheckInSuccess> {
  const changed = await markTicketCheckedIn(sp, {
    ticketId: input.ticketId,
    eventId: input.event.id,
    actorId: input.actorId,
    clientTimestamp: input.clientTimestamp,
    gate: input.gate,
  });
  const { status, response } = await readTicketCheckIn(sp, input.ticketId, changed ? "checked_in" : "already_checked_in");
  if (response) {
    // "Zaten yapıldı" yanıtında yayın yok: durum değişmedi.
    if (changed) await publishCheckIn(sp, input.event.id, input.ticketId);
    return response;
  }
  if (status === "held") throw new DomainError("conflict", CHECK_IN_MSG.ticketUnpaid);
  throw new DomainError("conflict", CHECK_IN_MSG.ticketExpired);
}
