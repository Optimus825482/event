import { and, asc, eq, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { buyerFullNameSql, ticketStatusSql } from "@/db/sql-fragments";
import { eventSaleSettings, eventTables, orders, tableSeatSlots, tickets } from "@/db/schema";
import { seatNoShown, type SaleMode } from "@/domain/seating";
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
  seatNo: number | null;
};

const byLabel = (a: string, b: string) => a.localeCompare(b, "tr", { numeric: true });

const columns = {
  ticketId: tickets.id,
  orderId: tickets.orderId,
  eventId: tickets.eventId,
  tableId: tickets.tableId,
  tableLabel: eventTables.label,
  // Süresi dolmuş tutma, süpürülmemiş olsa da `expired` okunur (DB saatiyle).
  status: ticketStatusSql(),
  buyerName: sql<string | null>`case when ${orders.status} = 'paid' then ${buyerFullNameSql()} else null end`,
  pnr: orders.pnr,
  checkedInAt: tickets.checkedInAt,
  rawSeatNo: tableSeatSlots.seatNo,
  isLoca: eventTables.isLoca,
  saleMode: eventSaleSettings.saleMode,
};

type RawRow = {
  ticketId: string;
  orderId: string;
  eventId: string;
  tableId: string;
  tableLabel: string;
  status: "held" | "issued" | "expired";
  buyerName: string | null;
  pnr: string | null;
  checkedInAt: Date | null;
  rawSeatNo: number | null;
  isLoca: boolean;
  saleMode: SaleMode | null;
};

function toLookup(row: RawRow): TicketLookup {
  const saleMode = row.saleMode ?? "seat";
  const seatNo = row.status !== "expired" && seatNoShown({ saleMode, isLoca: row.isLoca }) ? row.rawSeatNo : null;
  return {
    ticketId: row.ticketId,
    orderId: row.orderId,
    eventId: row.eventId,
    tableId: row.tableId,
    tableLabel: row.tableLabel,
    status: row.status,
    buyerName: row.buyerName,
    pnr: row.pnr,
    checkedInAt: row.checkedInAt,
    seatNo,
  };
}

/** QR belirteciyle bilet: imza geçerli olmalı ve belirteç biletin kayıtlı QR'ıyla birebir eşleşmeli. */
export async function findTicketByQr(ex: Db | Tx, token: string): Promise<TicketLookup | null> {
  const verified = verifyQrToken(token);
  if (!verified) return null;
  const [row] = await ex
    .select(columns)
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(eventTables, eq(eventTables.id, tickets.tableId))
    .leftJoin(tableSeatSlots, eq(tableSeatSlots.id, tickets.seatSlotId))
    .leftJoin(eventSaleSettings, eq(eventSaleSettings.eventId, tickets.eventId))
    .where(and(eq(tickets.id, verified.reservationId), eq(tickets.qrToken, token)));
  return row ? toLookup(row) : null;
}

/** Siparişin biletleri: masa etiketi, sonra sandalye numarası, sonra bilet kimliği (kalıcı sıra). */
export async function listOrderTickets(ex: Db | Tx, orderId: string): Promise<TicketLookup[]> {
  const rows = await ex
    .select(columns)
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(eventTables, eq(eventTables.id, tickets.tableId))
    .leftJoin(tableSeatSlots, eq(tableSeatSlots.id, tickets.seatSlotId))
    .leftJoin(eventSaleSettings, eq(eventSaleSettings.eventId, tickets.eventId))
    .where(eq(tickets.orderId, orderId))
    .orderBy(sql`${tableSeatSlots.seatNo} asc nulls last`, asc(tickets.id));
  // Aynı işlemde yazılan biletlerin `created_at` değeri eşittir; sıra etikete ve sandalyeye dayanır.
  return rows
    .sort(
      (a, b) =>
        byLabel(a.tableLabel, b.tableLabel) ||
        (a.rawSeatNo ?? Number.MAX_SAFE_INTEGER) - (b.rawSeatNo ?? Number.MAX_SAFE_INTEGER) ||
        (a.ticketId < b.ticketId ? -1 : a.ticketId > b.ticketId ? 1 : 0),
    )
    .map(toLookup);
}
