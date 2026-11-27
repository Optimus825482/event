import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventTables, orders, paymentAttempts, tableSeatSlots, tickets } from "@/db/schema";
import type { SaleCategory } from "@/domain/seating";
import { authorize } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { getEventOrThrow } from "@/features/events/service";
import { getSaleSettings } from "@/features/seating/settings-service";
import { DomainError } from "@/lib/action";
import { byLabel } from "@/lib/compare";
import { getSeatOccupancy } from "./occupancy";
import { getSalesTotals } from "./stats";

export type OrderListRow = {
  orderId: string;
  status: "pending" | "paid";
  pnr: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  seatCount: number;
  tableLabels: string[];
  total: string;
  currency: string;
  isDemo: boolean;
  paidAt: string | null;
  holdExpiresAt: string;
  eticketSentAt: string | null;
  createdAt: string;
};

export type TableOccupancyRow = {
  tableId: string;
  label: string;
  category: SaleCategory;
  seats: number;
  held: number;
  issued: number;
};

export type OrdersOverview = {
  eventId: string;
  eventName: string;
  currency: string;
  orders: OrderListRow[];
  occupancy: TableOccupancyRow[];
  totals: { issued: number; revenue: string; demoIssued: number; demoRevenue: string };
};

export type OrderDetail = OrderListRow & {
  eventId: string;
  buyerPhone: string | null;
  tickets: {
    ticketId: string;
    tableLabel: string;
    category: SaleCategory;
    unitPrice: string;
    status: "held" | "issued" | "expired";
    qrPayload: string | null;
    checkedInAt: string | null;
  }[];
  attempts: {
    outcome: "approved" | "declined" | "error";
    provider: string;
    amount: string;
    isDemo: boolean;
    at: string;
  }[];
};

/** Listede yer alan siparişler: ödenmiş ve süresi dolmamış (DB saatiyle) tutmalar. */
const listed = or(
  eq(orders.status, "paid"),
  and(eq(orders.status, "pending"), sql`${orders.holdExpiresAt} > clock_timestamp()`),
);

const orderColumns = {
  id: orders.id,
  eventId: orders.eventId,
  status: orders.status,
  pnr: orders.pnr,
  buyerFirstName: orders.buyerFirstName,
  buyerLastName: orders.buyerLastName,
  buyerEmail: orders.buyerEmail,
  buyerPhone: orders.buyerPhone,
  totalAmount: orders.totalAmount,
  currency: orders.currency,
  isDemo: orders.isDemo,
  paidAt: orders.paidAt,
  holdExpiresAt: orders.holdExpiresAt,
  eticketSentAt: orders.eticketSentAt,
  createdAt: orders.createdAt,
};

type OrderRecord = {
  id: string;
  status: string;
  pnr: string | null;
  buyerFirstName: string | null;
  buyerLastName: string | null;
  buyerEmail: string | null;
  totalAmount: string;
  currency: string;
  isDemo: boolean;
  paidAt: Date | null;
  holdExpiresAt: Date;
  eticketSentAt: Date | null;
  createdAt: Date;
};

function toListRow(order: OrderRecord, labels: string[], seatCount: number): OrderListRow {
  const name = `${order.buyerFirstName ?? ""} ${order.buyerLastName ?? ""}`.trim();
  return {
    orderId: order.id,
    status: order.status === "paid" ? "paid" : "pending",
    pnr: order.pnr,
    buyerName: name === "" ? null : name,
    buyerEmail: order.buyerEmail,
    seatCount,
    tableLabels: labels,
    total: order.totalAmount,
    currency: order.currency,
    isDemo: order.isDemo,
    paidAt: order.paidAt?.toISOString() ?? null,
    holdExpiresAt: order.holdExpiresAt.toISOString(),
    eticketSentAt: order.eticketSentAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
  };
}

/** Etkinliğin iç sipariş ekranı: sipariş listesi, online masaların doluluğu ve satış toplamları. */
export async function getOrdersOverview(ex: Db | Tx, actor: Actor, eventId: string): Promise<OrdersOverview> {
  authorize(actor, "ticketing", "view");
  const event = await getEventOrThrow(ex, eventId);
  const { currency } = await getSaleSettings(ex, eventId);

  const orderRows = await ex
    .select(orderColumns)
    .from(orders)
    .where(and(eq(orders.eventId, eventId), listed))
    .orderBy(desc(orders.createdAt), desc(orders.id));

  const labelsByOrder = new Map<string, string[]>();
  const countByOrder = new Map<string, number>();
  if (orderRows.length > 0) {
    const ticketRows = await ex
      .select({ orderId: tickets.orderId, label: eventTables.label })
      .from(tickets)
      .innerJoin(eventTables, eq(eventTables.id, tickets.tableId))
      .where(
        and(
          inArray(
            tickets.orderId,
            orderRows.map((o) => o.id),
          ),
          inArray(tickets.status, ["held", "issued"]),
        ),
      );
    for (const t of ticketRows) {
      countByOrder.set(t.orderId, (countByOrder.get(t.orderId) ?? 0) + 1);
      const labels = labelsByOrder.get(t.orderId) ?? [];
      if (!labels.includes(t.label)) labels.push(t.label);
      labelsByOrder.set(t.orderId, labels);
    }
  }

  const tableRows = await ex
    .select({ id: eventTables.id, label: eventTables.label, category: eventTables.saleCategory })
    .from(eventTables)
    .where(and(eq(eventTables.eventId, eventId), eq(eventTables.allocation, "online")));
  const slotRows = await ex
    .select({ tableId: tableSeatSlots.tableId, seats: sql<number>`count(*)::int` })
    .from(tableSeatSlots)
    .where(eq(tableSeatSlots.eventId, eventId))
    .groupBy(tableSeatSlots.tableId);
  const slots = new Map(slotRows.map((r) => [r.tableId, r.seats]));
  const taken = await getSeatOccupancy(ex, eventId);
  const occupancy: TableOccupancyRow[] = tableRows
    .sort((a, b) => byLabel(a.label, b.label))
    .map((t) => ({
      tableId: t.id,
      label: t.label,
      category: t.category,
      seats: slots.get(t.id) ?? 0,
      held: taken.get(t.id)?.held ?? 0,
      issued: taken.get(t.id)?.issued ?? 0,
    }));

  const sales = await getSalesTotals(ex, eventId);
  return {
    eventId,
    eventName: event.name,
    currency,
    orders: orderRows.map((o) =>
      toListRow(o, (labelsByOrder.get(o.id) ?? []).sort(byLabel), countByOrder.get(o.id) ?? 0),
    ),
    occupancy,
    totals: {
      issued: sales.issued,
      revenue: sales.revenue,
      demoIssued: sales.demoIssued,
      demoRevenue: sales.demoRevenue,
    },
  };
}

/** Sipariş ayrıntısı: alıcı, biletler (QR yükleriyle) ve ödeme denemeleri. */
export async function getOrderDetail(
  ex: Db | Tx,
  actor: Actor,
  input: { eventId: string; orderId: string },
): Promise<OrderDetail> {
  authorize(actor, "ticketing", "view");
  const [order] = await ex
    .select(orderColumns)
    .from(orders)
    .where(and(eq(orders.id, input.orderId), eq(orders.eventId, input.eventId)));
  if (!order) throw new DomainError("not_found", "Sipariş bulunamadı");

  const ticketRows = await ex
    .select({
      ticketId: tickets.id,
      tableLabel: eventTables.label,
      category: tickets.saleCategory,
      unitPrice: tickets.unitPrice,
      // Süresi dolmuş ama süpürülmemiş tutma `expired` okunur (DB saatiyle).
      status: sql<
        "held" | "issued" | "expired"
      >`case when ${tickets.status} = 'held' and ${orders.status} = 'pending' and ${orders.holdExpiresAt} <= clock_timestamp() then 'expired' else ${tickets.status} end`,
      qrPayload: tickets.qrToken,
      checkedInAt: tickets.checkedInAt,
    })
    .from(tickets)
    .innerJoin(orders, eq(orders.id, tickets.orderId))
    .innerJoin(eventTables, eq(eventTables.id, tickets.tableId))
    .where(eq(tickets.orderId, order.id))
    .orderBy(asc(tickets.createdAt), asc(tickets.id));
  ticketRows.sort((a, b) => byLabel(a.tableLabel, b.tableLabel));

  const attemptRows = await ex
    .select({
      outcome: paymentAttempts.outcome,
      provider: paymentAttempts.provider,
      amount: paymentAttempts.amount,
      isDemo: paymentAttempts.isDemo,
      at: paymentAttempts.createdAt,
    })
    .from(paymentAttempts)
    .where(eq(paymentAttempts.orderId, order.id))
    .orderBy(asc(paymentAttempts.createdAt), asc(paymentAttempts.id));

  const active = ticketRows.filter((t) => t.status !== "expired");
  const labels = [...new Set(active.map((t) => t.tableLabel))].sort(byLabel);
  return {
    ...toListRow(order, labels, active.length),
    eventId: order.eventId,
    buyerPhone: order.buyerPhone,
    tickets: ticketRows.map((t) => ({
      ...t,
      qrPayload: t.status === "issued" ? t.qrPayload : null,
      checkedInAt: t.checkedInAt?.toISOString() ?? null,
    })),
    attempts: attemptRows.map((a) => ({ ...a, at: a.at.toISOString() })),
  };
}
