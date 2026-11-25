import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { customers, reservations } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import {
  changeReservationStatus,
  createReservation,
  updateReservation,
} from "@/features/reservations/service";
import { DomainError } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import { createCustomer, createReservation as seedReservation } from "../../helpers/factories";
import { activeRows, actorOf, bookable, createTable, customerRow, TABLE_TAKEN } from "./fixtures";
import { adminActor } from "../../helpers/actors";

/** Her çağrı `db` alır; `db.transaction` havuzdan kendi bağlantısını çeker (gerçek eşzamanlılık). */
async function settle<T>(calls: (() => Promise<T>)[]) {
  const results = await Promise.allSettled(calls.map((call) => call()));
  const ok = results.filter((r): r is PromiseFulfilledResult<Awaited<T>> => r.status === "fulfilled");
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  return { ok, failed };
}

function expectAllConflicts(failed: PromiseRejectedResult[]) {
  for (const f of failed) {
    expect(f.reason).toBeInstanceOf(DomainError);
    expect((f.reason as DomainError).code).toBe("conflict");
    expect((f.reason as DomainError).message).toBe(TABLE_TAKEN);
  }
}

describe("eşzamanlılık (spec §13 madde 1, 6, 15)", () => {
  let admin: Actor;

  beforeEach(async () => {
    await truncateAll();
    admin = await actorOf(adminActor());
  });

  it("aynı masaya 10 eşzamanlı rezervasyon: 1 başarı, 9 conflict, tek aktif satır", async () => {
    const { event, table } = await bookable();
    const guests = await Promise.all(Array.from({ length: 10 }, () => createCustomer(db)));

    const { ok, failed } = await settle(
      guests.map(
        (g) => () => createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: g.id }),
      ),
    );

    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(9);
    expectAllConflicts(failed);
    expect(await activeRows(event.id, table.id)).toHaveLength(1);
    expect(await db.select().from(reservations)).toHaveLength(1);

    const winner = ok[0]?.value.customerId;
    const counters = await db.select({ id: customers.id, n: customers.totalReservations }).from(customers);
    for (const c of counters) expect(c.n).toBe(c.id === winner ? 1 : 0);
  });

  it("aynı masaya 10 eşzamanlı, yeni müşterili rezervasyon: oluşturulan müşteriler de geri alınır", async () => {
    const { event, table, customer } = await bookable();
    const { ok, failed } = await settle(
      Array.from(
        { length: 10 },
        (_, i) => () =>
          createReservation(db, admin, {
            eventId: event.id,
            tableId: table.id,
            guestCount: 2,
            guestName: `Misafir ${i}`,
            guestPhone: `0532 000 00 ${String(i).padStart(2, "0")}`,
          }),
      ),
    );
    expect(ok).toHaveLength(1);
    expectAllConflicts(failed);
    const rows = await db.select().from(customers);
    expect(rows.map((r) => r.id).sort()).toEqual([customer.id, ok[0]?.value.customerId].sort());
  });

  it("aynı telefonla farklı masalara 8 eşzamanlı rezervasyon tek müşteri üretir (madde 15)", async () => {
    const { event } = await bookable();
    const tables = await Promise.all(Array.from({ length: 8 }, () => createTable(db, event.id, { capacity: 4 })));
    const { ok, failed } = await settle(
      tables.map(
        (t, i) => () =>
          createReservation(db, admin, {
            eventId: event.id,
            tableId: t.id,
            guestCount: 2,
            guestName: `Aynı Kişi ${i}`,
            guestPhone: i % 2 ? "+90 532 999 88 77" : "05329998877",
          }),
      ),
    );
    expect(failed).toHaveLength(0);
    expect(ok).toHaveLength(8);
    const created = await db.select().from(customers).where(eq(customers.phoneNormalized, "+905329998877"));
    expect(created).toHaveLength(1);
    expect(created[0]?.totalReservations).toBe(8);
    expect(new Set(ok.map((r) => r.value.customerId)).size).toBe(1);
  });

  it("iki rezervasyonu eşzamanlı aynı boş masaya taşımak: tek başarı", async () => {
    const { event, table, customer } = await bookable();
    const t2 = await createTable(db, event.id, { capacity: 4 });
    const free = await createTable(db, event.id, { capacity: 4 });
    const other = await createCustomer(db);
    const a = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
    const b = await seedReservation(db, { eventId: event.id, tableId: t2.id, customerId: other.id });

    const { ok, failed } = await settle([a, b].map((r) => () => updateReservation(db, admin, { id: r.id, tableId: free.id })));
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expectAllConflicts(failed);
    expect(await activeRows(event.id, free.id)).toHaveLength(1);
  });

  it("aynı masadaki iki iptal rezervasyonu eşzamanlı yeniden onaylamak: tek başarı (madde 6)", async () => {
    const { event, table, customer } = await bookable();
    const other = await createCustomer(db);
    const a = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id, status: "cancelled" });
    const b = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: other.id, status: "cancelled" });

    const { ok, failed } = await settle(
      [a, b].map((r) => () => changeReservationStatus(db, admin, { id: r.id, status: "confirmed" })),
    );
    expect(ok).toHaveLength(1);
    expectAllConflicts(failed);
    expect(await activeRows(event.id, table.id)).toHaveLength(1);
  });

  it("iptal edilmişi yeniden onaylama ile yeni rezervasyon yarışında tek aktif satır kalır", async () => {
    const { event, table, customer } = await bookable();
    const other = await createCustomer(db);
    const cancelled = await seedReservation(db, {
      eventId: event.id,
      tableId: table.id,
      customerId: customer.id,
      status: "cancelled",
    });
    const { ok, failed } = await settle<unknown>([
      () => changeReservationStatus(db, admin, { id: cancelled.id, status: "confirmed" }),
      () => createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: other.id }),
    ]);
    expect(ok).toHaveLength(1);
    expectAllConflicts(failed);
    expect(await activeRows(event.id, table.id)).toHaveLength(1);
    const totals = (await customerRow(customer.id)).totalReservations + (await customerRow(other.id)).totalReservations;
    expect(totals).toBe(1);
  });
});
