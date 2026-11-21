import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { db, pool, type Tx } from "@/db/client";
import * as schema from "@/db/schema";
import {
  checkInEvents,
  customers,
  eventTables,
  events,
  reservations,
  tableGroupTables,
  users,
} from "@/db/schema";
import {
  createAssignment,
  createBookingParents,
  createCustomer,
  createEvent,
  createReservation,
  createShift,
  createStaff,
  createTable,
  createTableGroup,
  pgErrorCode,
} from "../helpers/factories";
import { inRollback } from "./isolation";

/** İşlemi bir savepoint içinde çalıştırır ve verilen SQLSTATE ile reddedildiğini doğrular. */
async function expectPgError(tx: Tx, code: string, op: (sp: Tx) => Promise<unknown>): Promise<void> {
  let caught: unknown;
  try {
    await tx.transaction(async (sp) => {
      await op(sp);
    });
  } catch (err) {
    caught = err;
  }
  expect(caught, `beklenen hata ${code} fırlatılmadı`).toBeDefined();
  expect(pgErrorCode(caught)).toBe(code);
}

describe("veritabanı kısıtları: rezervasyon", () => {
  it("aynı masaya ikinci aktif rezervasyon 23505 ile reddedilir; ilki iptal edilince eklenir", async () => {
    await inRollback(async (tx) => {
      const { event, table, customer } = await createBookingParents(tx);
      const first = await createReservation(tx, { eventId: event.id, tableId: table.id, customerId: customer.id });

      await expectPgError(tx, "23505", (sp) =>
        createReservation(sp, { eventId: event.id, tableId: table.id, customerId: customer.id }),
      );

      await tx.update(reservations).set({ status: "cancelled" }).where(eq(reservations.id, first.id));
      const second = await createReservation(tx, { eventId: event.id, tableId: table.id, customerId: customer.id });
      expect(second.status).toBe("confirmed");
    });
  });

  it("her aktif durum (pending, confirmed, checked_in) masayı kilitler; no_show kilitlemez", async () => {
    await inRollback(async (tx) => {
      const { event, table, customer } = await createBookingParents(tx);
      const base = { eventId: event.id, tableId: table.id, customerId: customer.id };
      await createReservation(tx, { ...base, status: "no_show" });
      const pending = await createReservation(tx, { ...base, status: "pending" });
      for (const status of ["pending", "confirmed", "checked_in"] as const) {
        await expectPgError(tx, "23505", (sp) => createReservation(sp, { ...base, status }));
      }
      expect(pending.status).toBe("pending");
    });
  });

  it("başka etkinliğin masasıyla rezervasyon yapılamaz (masa-etkinlik bütünlüğü)", async () => {
    await inRollback(async (tx) => {
      const { event, customer } = await createBookingParents(tx);
      const other = await createEvent(tx);
      const foreignTable = await createTable(tx, other.id);
      await expectPgError(tx, "23503", (sp) =>
        createReservation(sp, { eventId: event.id, tableId: foreignTable.id, customerId: customer.id }),
      );
    });
  });

  it("paralel: aynı masaya 10 eşzamanlı ekleme → tam olarak 1 başarılı", async () => {
    // Gerçek eşzamanlılık için ebeveynler commit edilir ve 10 ekleme havuzdan ayrı
    // bağlantılarla yapılır. Paralel çalışan başka bir test dosyası truncateAll() ile
    // ebeveynleri silerse (23503) senaryo yeniden kurulur; doğrulama değişmez.
    // Havuzdan 10 ayrı bağlantı önceden alınır: her ekleme kendi PostgreSQL oturumunda koşar.
    const clients = await Promise.all(Array.from({ length: 10 }, () => pool.connect()));
    try {
      const pids = await Promise.all(
        clients.map(async (c) => (await c.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]?.pid),
      );
      expect(new Set(pids).size).toBe(10);
      const conns = clients.map((c) => drizzle(c, { schema }));

      for (let attempt = 1; ; attempt += 1) {
        const { event, table, customer } = await createBookingParents(db);
        const results = await Promise.allSettled(
          conns.map((conn) =>
            createReservation(conn, { eventId: event.id, tableId: table.id, customerId: customer.id }),
          ),
        );
        const codes = results.flatMap((r) => (r.status === "rejected" ? [pgErrorCode(r.reason)] : []));
        if (codes.some((c) => c !== "23505") && attempt < 3) continue;

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(codes).toEqual(Array.from({ length: 9 }, () => "23505"));

        await db.delete(reservations).where(eq(reservations.eventId, event.id));
        await db.delete(events).where(eq(events.id, event.id));
        await db.delete(customers).where(eq(customers.id, customer.id));
        await db.delete(users).where(eq(users.id, event.organizerId));
        return;
      }
    } finally {
      for (const c of clients) c.release();
    }
  });

  it("guest_count 0 ve 51 reddedilir (23514)", async () => {
    await inRollback(async (tx) => {
      const { event, table, customer } = await createBookingParents(tx);
      for (const guestCount of [0, 51]) {
        await expectPgError(tx, "23514", (sp) =>
          createReservation(sp, { eventId: event.id, tableId: table.id, customerId: customer.id, guestCount }),
        );
      }
      const ok = await createReservation(tx, {
        eventId: event.id,
        tableId: table.id,
        customerId: customer.id,
        guestCount: 50,
      });
      expect(ok.guestCount).toBe(50);
    });
  });

  it("rezervasyonu olan masa silinemez (23503)", async () => {
    await inRollback(async (tx) => {
      const { event, table, customer } = await createBookingParents(tx);
      await createReservation(tx, { eventId: event.id, tableId: table.id, customerId: customer.id });
      await expectPgError(tx, "23503", (sp) => sp.delete(eventTables).where(eq(eventTables.id, table.id)));
    });
  });

  it("rezervasyonu olan etkinlik silinemez (23503)", async () => {
    await inRollback(async (tx) => {
      const { event, table, customer } = await createBookingParents(tx);
      await createReservation(tx, { eventId: event.id, tableId: table.id, customerId: customer.id });
      await expectPgError(tx, "23503", (sp) => sp.delete(events).where(eq(events.id, event.id)));
    });
  });

  it("aynı idempotency_key ikinci kez eklenemez (23505)", async () => {
    await inRollback(async (tx) => {
      const { event, table, customer } = await createBookingParents(tx);
      const r = await createReservation(tx, { eventId: event.id, tableId: table.id, customerId: customer.id });
      const key = `key-${randomUUID()}`;
      const row = { reservationId: r.id, idempotencyKey: key, outcome: "checked_in" as const };
      await tx.insert(checkInEvents).values(row);
      await expectPgError(tx, "23505", (sp) => sp.insert(checkInEvents).values(row));
    });
  });
});

describe("veritabanı kısıtları: etkinlik ve masa", () => {
  it("capacity 0 reddedilir (23514)", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      await expectPgError(tx, "23514", (sp) => createTable(sp, event.id, { capacity: 0 }));
    });
  });

  it("ends_at <= starts_at reddedilir (23514); ends_at NULL kabul edilir", async () => {
    await inRollback(async (tx) => {
      const startsAt = new Date("2027-01-10T18:00:00Z");
      await expectPgError(tx, "23514", (sp) => createEvent(sp, { startsAt, endsAt: startsAt }));
      await expectPgError(tx, "23514", (sp) =>
        createEvent(sp, { startsAt, endsAt: new Date("2027-01-10T17:00:00Z") }),
      );
      const open = await createEvent(tx, { startsAt, endsAt: null });
      expect(open.endsAt).toBeNull();
    });
  });

  it("aynı etkinlikte aynı etiketli iki masa olamaz (23505)", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      await createTable(tx, event.id, { label: "A1" });
      await expectPgError(tx, "23505", (sp) => createTable(sp, event.id, { label: "A1" }));
    });
  });
});

describe("veritabanı kısıtları: ekip, grup ve atama", () => {
  it("aynı masa aynı etkinlikte ikinci bir gruba eklenemez (23505)", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const table = await createTable(tx, event.id);
      const g1 = await createTableGroup(tx, event.id);
      const g2 = await createTableGroup(tx, event.id);
      await tx.insert(tableGroupTables).values({ eventId: event.id, tableGroupId: g1.id, tableId: table.id });
      await expectPgError(tx, "23505", (sp) =>
        sp.insert(tableGroupTables).values({ eventId: event.id, tableGroupId: g2.id, tableId: table.id }),
      );
    });
  });

  it("aynı personel aynı etkinlik + vardiyaya iki kez atanamaz (23505)", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const person = await createStaff(tx);
      const shift = await createShift(tx);
      const v = { eventId: event.id, staffId: person.id, shiftId: shift.id };
      await createAssignment(tx, v);
      await expectPgError(tx, "23505", (sp) => createAssignment(sp, v));
    });
  });

  it("shift_id NULL iken de aynı personel aynı etkinliğe iki kez atanamaz (NULLS NOT DISTINCT)", async () => {
    await inRollback(async (tx) => {
      const event = await createEvent(tx);
      const person = await createStaff(tx);
      await createAssignment(tx, { eventId: event.id, staffId: person.id, shiftId: null });
      await expectPgError(tx, "23505", (sp) =>
        createAssignment(sp, { eventId: event.id, staffId: person.id, shiftId: null }),
      );
    });
  });
});

describe("veritabanı kısıtları: müşteri", () => {
  it("aynı phone_normalized ile ikinci müşteri eklenemez; ikisi de NULL ise eklenebilir", async () => {
    await inRollback(async (tx) => {
      const phone = `+90555${Math.floor(Math.random() * 1e7)}`;
      await createCustomer(tx, { phone, phoneNormalized: phone });
      await expectPgError(tx, "23505", (sp) => createCustomer(sp, { phone, phoneNormalized: phone }));

      const a = await createCustomer(tx, { phoneNormalized: null });
      const b = await createCustomer(tx, { phoneNormalized: null });
      expect(a.id).not.toBe(b.id);
    });
  });
});

describe("şema geneli", () => {
  it("hiçbir tabloda 'timestamp without time zone' sütunu yoktur", async () => {
    const res = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from information_schema.columns
          where table_schema = 'public' and data_type = 'timestamp without time zone'`,
    );
    expect(res.rows[0]?.n).toBe(0);

    const tz = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from information_schema.columns
          where table_schema = 'public' and data_type = 'timestamp with time zone'
            and table_name in ('events', 'reservations', 'check_in_events')`,
    );
    expect(tz.rows[0]?.n).toBeGreaterThan(0);
  });
});
