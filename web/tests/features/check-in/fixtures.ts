import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { checkInEvents, customers, events, reservations } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { createReservation as bookReservation } from "@/features/reservations/service";
import { managerActor, persistActor } from "../../helpers/actors";
import { createCustomer, createEvent, createTable } from "../../helpers/factories";

export { expectDomain, rejection } from "../reservations/fixtures";

export async function actorOf(actor: Actor): Promise<Actor> {
  return persistActor(db, actor);
}

/**
 * Devam eden bir etkinlik, kapasitesi 4 olan "A1" masası ve bu masada gerçek rezervasyon servisiyle
 * oluşturulmuş onaylı bir rezervasyon (imzalı QR belirteci ile).
 */
export async function bookedGuest(options: { organizerId?: string; status?: "published" | "active" } = {}) {
  const organizer = options.organizerId
    ? managerActor("casino", { id: options.organizerId })
    : await persistActor(db, managerActor("casino"));
  const organizerId = organizer.id;
  const event = await createEvent(db, {
    status: options.status ?? "active",
    organizerId,
  });
  const table = await createTable(db, event.id, { capacity: 4, label: "A1" });
  const customer = await createCustomer(db);
  const reservation = await bookReservation(db, organizer, {
    eventId: event.id,
    tableId: table.id,
    guestCount: 2,
    customerId: customer.id,
  });
  return { event, table, customer, reservation };
}

export function key(): string {
  return randomUUID();
}

export async function reservationRow(id: string) {
  const [row] = await db.select().from(reservations).where(eq(reservations.id, id));
  if (!row) throw new Error("rezervasyon yok");
  return row;
}

export async function customerRow(id: string) {
  const [row] = await db.select().from(customers).where(eq(customers.id, id));
  if (!row) throw new Error("müşteri yok");
  return row;
}

export async function checkInLog(reservationId: string) {
  return db.select().from(checkInEvents).where(eq(checkInEvents.reservationId, reservationId));
}

export async function setEventStatus(id: string, status: "draft" | "published" | "active" | "completed" | "cancelled") {
  await db.update(events).set({ status }).where(eq(events.id, id));
}

export async function setReservationStatus(id: string, status: "pending" | "confirmed" | "cancelled" | "no_show") {
  await db.update(reservations).set({ status }).where(eq(reservations.id, id));
}
