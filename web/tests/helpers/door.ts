import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { checkInEvents, events, tickets } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import type { OrderView } from "@/features/ticketing/orders-service";
import { memberActor, persistActor } from "./actors";
import { createEvent, createTable } from "./factories";
import { setStage } from "./planning";
import { openOnline, setFinalPrices } from "./seating";
import { createPaidOrder } from "./ticketing";

/** Kapı testlerinin alıcısı; `createPaidOrder`'ın varsayılanından ayrı tutulur. */
export type DoorBuyer = { firstName: string; lastName: string; email: string };

export const DEFAULT_BUYER: DoorBuyer = { firstName: "Deniz", lastName: "Yılmaz", email: "deniz@example.com" };

export type TicketedEvent = {
  event: typeof events.$inferSelect;
  tables: { id: string; label: string }[];
  order: OrderView;
  tickets: OrderView["tickets"];
  buyer: DoorBuyer;
};

/**
 * Online masaları açar (`pending` yaratılır, `openOnline` ile yuvaları kurulur) ve ödenmiş sipariş üretir.
 * Kapasite `max(4, adet + 2)`; etkinliğin kesin fiyatı ve aşaması çağıran tarafından kurulmuş olmalıdır.
 */
async function sellTables(
  eventId: string,
  specs: { label: string; quantity: number }[],
  buyer: DoorBuyer,
): Promise<{ tables: { id: string; label: string }[]; order: OrderView }> {
  const tables: { id: string; label: string }[] = [];
  for (const spec of specs) {
    const row = await createTable(db, eventId, {
      label: spec.label,
      capacity: Math.max(4, spec.quantity + 2),
      saleCategory: "standard",
      allocation: "pending",
    });
    tables.push({ id: row.id, label: row.label });
  }
  await db.transaction((tx) =>
    openOnline(
      tx,
      eventId,
      tables.map((t) => t.id),
    ),
  );
  const order = await createPaidOrder(db, {
    eventId,
    items: specs.map((spec, i) => ({ tableId: tables[i]!.id, quantity: spec.quantity })),
    buyer,
  });
  if (order.status !== "paid" || order.tickets.length === 0) throw new Error("ödenmiş sipariş üretilemedi");
  return { tables, order };
}

/**
 * Satışta (`on_sale`, kesin `standard` fiyatı 100.00) bir etkinlik ve tek ödenmiş sipariş. Varsayılan
 * `status: "active"`, `seats: [2, 1]`: `B1`'den 2, `B2`'den 1 bilet.
 */
export async function ticketedEvent(
  options: { status?: "published" | "active"; seats?: readonly number[]; buyer?: DoorBuyer } = {},
): Promise<TicketedEvent> {
  const buyer = options.buyer ?? DEFAULT_BUYER;
  const seats = options.seats ?? [2, 1];
  const created = await createEvent(db, { status: options.status ?? "active" });
  await setStage(db, created.id, "on_sale");
  await setFinalPrices(db, created.id, { standard: "100.00" });
  const { tables, order } = await sellTables(
    created.id,
    seats.map((quantity, i) => ({ label: `B${i + 1}`, quantity })),
    buyer,
  );
  const [event] = await db.select().from(events).where(eq(events.id, created.id));
  if (!event) throw new Error("etkinlik okunamadı");
  return { event, tables, order, tickets: order.tickets, buyer };
}

/** Aynı etkinliğe yeni online masalar ve bunlarda ödenmiş bir sipariş (yük testi için). */
export async function addPaidOrder(
  eventId: string,
  tables: { label: string; quantity: number }[],
  buyer: DoorBuyer = DEFAULT_BUYER,
): Promise<OrderView> {
  return (await sellTables(eventId, tables, buyer)).order;
}

export async function ticketRow(ticketId: string): Promise<typeof tickets.$inferSelect> {
  const [row] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  if (!row) throw new Error("bilet yok");
  return row;
}

/** Siparişin bilet kimlikleri `tickets` tablosundan (tutulan siparişte de çalışır), oluşturulma sırasıyla. */
export async function ticketIdsOf(orderId: string): Promise<string[]> {
  const rows = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.orderId, orderId))
    .orderBy(asc(tickets.createdAt), asc(tickets.id));
  return rows.map((r) => r.id);
}

/** Biletin giriş kayıtları, oluşturulma sırasıyla. */
export async function ticketLog(ticketId: string): Promise<(typeof checkInEvents.$inferSelect)[]> {
  return db
    .select()
    .from(checkInEvents)
    .where(eq(checkInEvents.ticketId, ticketId))
    .orderBy(asc(checkInEvents.createdAt), asc(checkInEvents.id));
}

/** Bileti doğrudan girmiş işaretler; giriş kaydı yazmaz. Yalnızca test kurulumu içindir. */
export async function stampTicketCheckIn(ticketId: string, at: Date = new Date()): Promise<void> {
  await db.update(tickets).set({ checkedInAt: at }).where(eq(tickets.id, ticketId));
}

/** Kapı görevlisi: Casino üyesi, yalnızca `check_in` görüntüleme + oluşturma. */
export async function doorActor(): Promise<Actor> {
  return persistActor(db, memberActor("casino", { check_in: "vc--" }));
}

