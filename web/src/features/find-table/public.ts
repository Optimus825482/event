import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { eventTables, events, orders, reservations, tickets } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { formatEventWhen } from "@/features/invitations/public";
import { getFloorPlan } from "@/features/venue/plan-service";
import type { FloorPlanData } from "@/features/venue/plan-types";
import { verifyFindTableToken } from "./token";
import { eventWindowOpen } from "./window";

export type PublicTableView = {
  eventName: string;
  eventDate: string;
  tables: { id: string; label: string; seats: number }[];
  plan: FloorPlanData;
};

type Located = { eventId: string; eventName: string; startsAt: Date; tables: { id: string; label: string; seats: number }[] };

async function locateOrder(db: Db | Tx, orderId: string): Promise<Located | null> {
  const [order] = await db
    .select({ eventId: events.id, eventName: events.name, startsAt: events.startsAt })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .where(and(eq(orders.id, orderId), eq(orders.status, "paid"), eventWindowOpen()));
  if (!order) return null;
  const rows = await db
    .select({ id: eventTables.id, label: eventTables.label, seats: sql<number>`count(*)::int` })
    .from(tickets)
    .innerJoin(eventTables, and(eq(eventTables.eventId, tickets.eventId), eq(eventTables.id, tickets.tableId)))
    .where(and(eq(tickets.orderId, orderId), eq(tickets.status, "issued")))
    .groupBy(eventTables.id, eventTables.label)
    .orderBy(asc(eventTables.label), asc(eventTables.id));
  if (rows.length === 0) return null;
  return { ...order, tables: rows };
}

async function locateReservation(db: Db | Tx, reservationId: string): Promise<Located | null> {
  const [row] = await db
    .select({
      eventId: events.id,
      eventName: events.name,
      startsAt: events.startsAt,
      id: eventTables.id,
      label: eventTables.label,
      seats: reservations.guestCount,
    })
    .from(reservations)
    .innerJoin(events, eq(events.id, reservations.eventId))
    .innerJoin(eventTables, and(eq(eventTables.eventId, reservations.eventId), eq(eventTables.id, reservations.tableId)))
    .where(
      and(
        eq(reservations.id, reservationId),
        inArray(reservations.status, ["pending", "confirmed", "checked_in"]),
        eventWindowOpen(),
      ),
    );
  if (!row) return null;
  return {
    eventId: row.eventId,
    eventName: row.eventName,
    startsAt: row.startsAt,
    tables: [{ id: row.id, label: row.label, seats: row.seats }],
  };
}

/**
 * Herkese açık "masamı bul" görünümü. İmza doğrulanmadan veritabanına gidilmez. Yanıt yalnızca etkinlik adı,
 * tarih, kişinin masaları (etiket + yer sayısı) ve beyaz listeyle süzülmüş yerleşim planını içerir.
 */
export async function getPublicTableView(db: Db | Tx, token: string): Promise<PublicTableView | null> {
  const target = verifyFindTableToken(token);
  if (!target) return null;
  const located = target.kind === "order" ? await locateOrder(db, target.id) : await locateReservation(db, target.id);
  if (!located) return null;

  // getFloorPlan yetkilendirme yapmaz (çağıranın işidir); actor kullanılmaz.
  const plan = await getFloorPlan(db, null as unknown as Actor, located.eventId);
  return {
    eventName: located.eventName,
    eventDate: formatEventWhen(located.startsAt).date,
    tables: located.tables,
    plan: {
      canvas: plan.canvas,
      decor: plan.decor,
      lines: plan.lines ?? [],
      tables: plan.tables.map((t) => ({
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        x: t.x,
        y: t.y,
        rotation: t.rotation,
        isLoca: t.isLoca,
        shape: t.shape,
        color: t.color,
      })),
    },
  };
}
