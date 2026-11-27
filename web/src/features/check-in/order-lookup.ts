import { eq } from "drizzle-orm";
import { events, orders } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { MSG, type Executor } from "@/features/reservations/internal";
import { parsePnr } from "@/features/ticketing/pnr";
import { listOrderTickets } from "@/features/ticketing/tickets-read";
import { DomainError } from "@/lib/action";
import { joinFullName } from "@/lib/full-name";
import type { FindOrderInput } from "./schemas";

export type DoorOrder = {
  orderId: string;
  pnr: string;
  buyerName: string;
  tickets: { ticketId: string; tableId: string; tableLabel: string; checkedInAt: string | null }[];
};

/**
 * Kapıda PNR ile sipariş araması. Başka etkinliğin, ödenmemiş, biçimsiz ya da bilinmeyen PNR için
 * ayrım yapmadan `null` döner; yalnızca `issued` biletler listelenir. İkinci etken istenmez
 * (oturumlu görevli). Alıcı e-postası ve telefonu dönmez.
 */
export async function findOrderAtDoor(db: Executor, _actor: Actor, input: FindOrderInput): Promise<DoorOrder | null> {
  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, input.eventId));
  if (!event) throw new DomainError("not_found", MSG.eventNotFound);
  const pnr = parsePnr(input.pnr);
  if (!pnr) return null;
  const [order] = await db
    .select({
      id: orders.id,
      pnr: orders.pnr,
      eventId: orders.eventId,
      status: orders.status,
      first: orders.buyerFirstName,
      last: orders.buyerLastName,
    })
    .from(orders)
    .where(eq(orders.pnr, pnr));
  if (!order || order.pnr === null || order.eventId !== event.id || order.status !== "paid") return null;
  const rows = (await listOrderTickets(db, order.id)).filter((t) => t.status === "issued");
  rows.sort(
    (a, b) => a.tableLabel.localeCompare(b.tableLabel, "tr", { numeric: true }) || a.ticketId.localeCompare(b.ticketId),
  );
  return {
    orderId: order.id,
    pnr: order.pnr,
    buyerName: joinFullName(order.first, order.last),
    tickets: rows.map((t) => ({
      ticketId: t.ticketId,
      tableId: t.tableId,
      tableLabel: t.tableLabel,
      checkedInAt: t.checkedInAt?.toISOString() ?? null,
    })),
  };
}
