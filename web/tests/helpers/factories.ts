import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import {
  customers,
  eventStaffAssignments,
  eventTables,
  events,
  reservations,
  staff,
  tableGroups,
  users,
  workShifts,
} from "@/db/schema";

/** Fabrikalar `db`, transaction (`tx`) ya da tek bir havuz bağlantısına bağlı drizzle ile çalışır. */
export type Executor = Pick<NodePgDatabase<typeof schema>, "insert">;

type Overrides<T> = Partial<T>;

function uniq(): string {
  return randomUUID().slice(0, 8);
}

/** Hata zincirinde (`err`, `err.cause`, ...) PostgreSQL SQLSTATE kodunu bulur. */
export function pgErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current === "object" && "code" in current && typeof current.code === "string") {
      return current.code;
    }
    current = typeof current === "object" && "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

export async function createUser(ex: Executor, o: Overrides<typeof users.$inferInsert> = {}) {
  const u = uniq();
  const [row] = await ex
    .insert(users)
    .values({ name: `Kullanıcı ${u}`, email: `u-${u}@test.local`, username: `u_${u}`, ...o })
    .returning();
  if (!row) throw new Error("kullanıcı eklenemedi");
  return row;
}

export async function createCustomer(ex: Executor, o: Overrides<typeof customers.$inferInsert> = {}) {
  const [row] = await ex
    .insert(customers)
    .values({ fullName: `Müşteri ${uniq()}`, ...o })
    .returning();
  if (!row) throw new Error("müşteri eklenemedi");
  return row;
}

export async function createEvent(ex: Executor, o: Overrides<typeof events.$inferInsert> = {}) {
  const organizerId = o.organizerId ?? (await createUser(ex)).id;
  const [row] = await ex
    .insert(events)
    .values({ name: `Etkinlik ${uniq()}`, startsAt: new Date("2027-01-10T18:00:00Z"), organizerId, ...o })
    .returning();
  if (!row) throw new Error("etkinlik eklenemedi");
  return row;
}

export async function createTable(
  ex: Executor,
  eventId: string,
  o: Overrides<typeof eventTables.$inferInsert> = {},
) {
  const [row] = await ex
    .insert(eventTables)
    .values({ eventId, label: `M-${uniq()}`, capacity: 8, x: 0, y: 0, ...o })
    .returning();
  if (!row) throw new Error("masa eklenemedi");
  return row;
}

export async function createReservation(
  ex: Executor,
  v: { eventId: string; tableId: string; customerId: string } & Overrides<typeof reservations.$inferInsert>,
) {
  const [row] = await ex
    .insert(reservations)
    .values({ guestCount: 2, status: "confirmed", qrToken: `qr-${randomUUID()}`, ...v })
    .returning();
  if (!row) throw new Error("rezervasyon eklenemedi");
  return row;
}

/** Etkinlik + masa + müşteri: rezervasyon için asgari ebeveyn satırlar. */
export async function createBookingParents(ex: Executor) {
  const event = await createEvent(ex);
  const table = await createTable(ex, event.id);
  const customer = await createCustomer(ex);
  return { event, table, customer };
}

export async function createStaff(ex: Executor, o: Overrides<typeof staff.$inferInsert> = {}) {
  const u = uniq();
  const [row] = await ex
    .insert(staff)
    .values({ sicilNo: `S-${u}`, fullName: `Personel ${u}`, ...o })
    .returning();
  if (!row) throw new Error("personel eklenemedi");
  return row;
}

export async function createTableGroup(
  ex: Executor,
  eventId: string,
  o: Overrides<typeof tableGroups.$inferInsert> = {},
) {
  const [row] = await ex
    .insert(tableGroups)
    .values({ eventId, name: `Grup ${uniq()}`, ...o })
    .returning();
  if (!row) throw new Error("masa grubu eklenemedi");
  return row;
}

export async function createShift(ex: Executor, o: Overrides<typeof workShifts.$inferInsert> = {}) {
  const [row] = await ex
    .insert(workShifts)
    .values({ name: `Vardiya ${uniq()}`, startTime: "18:00", endTime: "02:00", ...o })
    .returning();
  if (!row) throw new Error("vardiya eklenemedi");
  return row;
}

export async function createAssignment(
  ex: Executor,
  v: { eventId: string; staffId: string } & Overrides<typeof eventStaffAssignments.$inferInsert>,
) {
  const [row] = await ex
    .insert(eventStaffAssignments)
    .values({ assignmentType: "table", ...v })
    .returning();
  if (!row) throw new Error("atama eklenemedi");
  return row;
}
