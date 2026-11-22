import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { customers, reservations } from "@/db/schema";
import type { Role } from "@/features/auth/roles";
import type { Actor } from "@/features/auth/session";
import { DomainError } from "@/lib/action";
import { createCustomer, createEvent, createTable, createUser } from "../../helpers/factories";

export const TABLE_TAKEN = "Bu masa için aktif bir rezervasyon var";

export async function actorOf(role: Role): Promise<Actor> {
  const u = await createUser(db, { role });
  return { id: u.id, username: u.username, role, staffId: null };
}

/** Yayında bir etkinlik, bir masa (kapasite 4) ve bir müşteri. */
export async function bookable(organizerId?: string) {
  const event = await createEvent(db, { status: "published", ...(organizerId ? { organizerId } : {}) });
  const table = await createTable(db, event.id, { capacity: 4, label: "A1" });
  const customer = await createCustomer(db);
  return { event, table, customer };
}

export async function activeRows(eventId: string, tableId: string) {
  const rows = await db.select().from(reservations).where(eq(reservations.eventId, eventId));
  return rows.filter((r) => r.tableId === tableId && ["pending", "confirmed", "checked_in"].includes(r.status));
}

export async function customerRow(id: string) {
  const [row] = await db.select().from(customers).where(eq(customers.id, id));
  if (!row) throw new Error("müşteri yok");
  return row;
}

export async function reservationRow(id: string) {
  const [row] = await db.select().from(reservations).where(eq(reservations.id, id));
  if (!row) throw new Error("rezervasyon yok");
  return row;
}

/** `promise` reddedildiyse hatayı döndürür; başarılıysa testi düşürür. */
export async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("başarısızlık bekleniyordu");
}

export async function expectDomain(promise: Promise<unknown>, code: "conflict" | "not_found", message?: string | RegExp) {
  const error = await rejection(promise);
  if (!(error instanceof DomainError)) throw new Error(`DomainError bekleniyordu: ${String(error)}`);
  if (error.code !== code) throw new Error(`"${code}" bekleniyordu, gelen "${error.code}": ${error.message}`);
  if (typeof message === "string" && error.message !== message) {
    throw new Error(`Mesaj "${message}" bekleniyordu, gelen "${error.message}"`);
  }
  if (message instanceof RegExp && !message.test(error.message)) {
    throw new Error(`Mesaj ${String(message)} ile eşleşmedi: "${error.message}"`);
  }
  return error;
}

export { createTable };
