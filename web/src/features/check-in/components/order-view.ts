import { displayPnr } from "../door-code";
import { gateLabel } from "../gates";
import type { DoorOrder } from "../order-lookup";
import type { CheckInSuccess } from "../result-schema";

/** Giriş yapmamış ve gönderimi reddedilmemiş biletler, liste sırasıyla. */
export function selectableTicketIds(order: DoorOrder, failedIds: readonly string[] = []): string[] {
  return order.tickets.filter((t) => t.checkedInAt === null && !failedIds.includes(t.ticketId)).map((t) => t.ticketId);
}

export function orderSummary(order: DoorOrder): string {
  const inside = order.tickets.filter((t) => t.checkedInAt !== null).length;
  return `${order.tickets.length} bilet · ${inside} giriş yaptı`;
}

/** Başarı bandındaki kişi satırı. */
export function resultLine(result: CheckInSuccess): string {
  const name = result.guestName ?? "Misafir";
  const parts =
    result.kind === "ticket"
      ? [name, "Bilet", ...(result.pnr ? [`PNR ${displayPnr(result.pnr)}`] : [])]
      : [name, `${result.guestCount} kişi`];
  if (result.gate !== null) parts.push(gateLabel(result.gate));
  return parts.join(" · ");
}
