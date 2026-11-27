import { and, asc, eq, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { buyerFullNameSql, ticketStatusSql } from "@/db/sql-fragments";
import { eventTables, orders, tickets } from "@/db/schema";
import { verifyQrToken } from "@/features/reservations/qr-token";

/** Faz 8'in (giriş) okuduğu bilet görünümü. Salt okurdur; yazma `orders-service`'tedir. */
export type TicketLookup = {
  ticketId: string;
  orderId: string;
  eventId: string;
  tableId: string;
  tableLabel: string;
  status: "held" | "issued" | "expired";
  buyerName: string | null;
  pnr: string | null;
  checkedInAt: Date | null;
};

const byLabel = (a: string, b: string) =>
  a.localeCompare(b, "tr", { numeric: true });

const columns = {
  ticketId: tickets.id,
  orderId: tickets.orderId,
  eventId: tickets.eventId,
  tableId: tickets.tableId,
  tableLabel: eventTables.label,
  // Süresi dolmuş tutma, süpürülmemiş olsa da `expired` okunur (DB saatiyle).
  status: ticketStatusSql(),
  buyerName: sql<
    string | null
  >`case when ${orders.status} = 'paid' then ${buyerFullNameSql()} else null end`,
  pnr: orders.pnr,
  checkedInAt: tickets.checkedInAt,
};

/** QR belirteciyle bilet: imza geçerli olmalı ve belirteç biletin kayıtlı QR'ıyla birebir eşleşmeli. */
export async function findTicketByQr(
  ex: Db | Tx,
  token: string,
): Promise<TicketLookup | null> {
  const verified = verifyQrToken(token);
  if (!verified) return null;
  const [row] = await ex
    .select(columns)
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(eventTables, eq(eventTables.id, tickets.tableId))
    .where(
      and(eq(tickets.id, verified.reservationId), eq(tickets.qrToken, token)),
    );
  return row ?? null;
}

/** Siparişin biletleri: masa etiketi, sonra oluşturulma sırası. */
export async function listOrderTickets(
  ex: Db | Tx,
  orderId: string,
): Promise<TicketLookup[]> {
  const rows = await ex
    .select(columns)
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(eventTables, eq(eventTables.id, tickets.tableId))
    .where(eq(tickets.orderId, orderId))
    .orderBy(asc(tickets.createdAt), asc(tickets.id));
  // Dizi sıralaması kararlıdır: aynı etiketin biletleri `created_at` sırasını korur.
  return rows.sort((a, b) => byLabel(a.tableLabel, b.tableLabel));
}
