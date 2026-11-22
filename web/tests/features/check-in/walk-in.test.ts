import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { db, pool } from "@/db/client";
import { customers, reservations } from "@/db/schema";
import { registerWalkIn, updateGuestCount } from "@/features/check-in/service";
import { verifyQrToken } from "@/features/reservations/qr-token";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { createTable } from "../../helpers/factories";
import {
  actorOf,
  bookedGuest,
  checkInLog,
  customerRow,
  expectDomain,
  reservationRow,
  setReservationStatus,
} from "./fixtures";

describe("registerWalkIn", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("müşteri + boş masada rezervasyon + giriş tek seferde; sayaçlar 1", async () => {
    const { event } = await bookedGuest();
    const table = await createTable(db, event.id, { capacity: 6, label: "K7" });
    const door = await actorOf("controller");

    const result = await registerWalkIn(db, door, {
      eventId: event.id,
      tableId: table.id,
      guestName: "  Kapı Misafiri  ",
      guestCount: 5,
      guestPhone: "0532 111 22 33",
    });

    expect(result).toMatchObject({
      outcome: "checked_in",
      tableLabel: "K7",
      guestName: "Kapı Misafiri",
      guestCount: 5,
      checkedInBy: { id: door.id, username: door.username },
    });
    const row = await reservationRow(result.reservationId);
    expect(row.status).toBe("checked_in");
    expect(verifyQrToken(row.qrToken)).toEqual({ reservationId: row.id });
    const customer = await customerRow(row.customerId);
    expect(customer).toMatchObject({
      fullName: "Kapı Misafiri",
      phoneNormalized: "+905321112233",
    });
    expect(customer.totalReservations).toBe(1);
    expect(customer.totalAttendedEvents).toBe(1);
    expect((await checkInLog(row.id)).map((r) => r.outcome)).toEqual(["checked_in"]);
  });

  it("M6: havuzda yalnızca tek boş bağlantı varken bile tamamlanır (transaction içinde ikinci bağlantı alınmaz)", async () => {
    const { event } = await bookedGuest();
    const table = await createTable(db, event.id, { capacity: 6, label: "K8" });
    const door = await actorOf("controller");
    const held: PoolClient[] = [];
    try {
      for (let i = 0; i < (pool.options.max ?? 10) - 1; i += 1) held.push(await pool.connect());
      const outcome = await Promise.race([
        registerWalkIn(db, door, {
          eventId: event.id,
          tableId: table.id,
          guestName: "Havuz Testi",
          guestCount: 2,
        }).then((r) => r.outcome),
        new Promise<string>((resolve) => setTimeout(() => resolve("zaman aşımı"), 5_000)),
      ]);
      expect(outcome).toBe("checked_in");
    } finally {
      for (const client of held) client.release();
    }
  }, 20_000);

  it("dolu masada conflict verir ve hiçbir şey yazılmaz (müşteri dahil)", async () => {
    const { event, table } = await bookedGuest();
    const door = await actorOf("controller");
    const customersBefore = (await db.select().from(customers)).length;

    await expectDomain(
      registerWalkIn(db, door, {
        eventId: event.id,
        tableId: table.id,
        guestName: "Yeni Kişi",
        guestCount: 2,
        guestPhone: "05441234567",
      }),
      "conflict",
      "Bu masa için aktif bir rezervasyon var",
    );
    expect((await db.select().from(customers)).length).toBe(customersBefore);
    expect(await db.select().from(reservations).where(eq(reservations.eventId, event.id))).toHaveLength(1);
  });

  it("kapasiteyi aşan walk-in conflict verir", async () => {
    const { event } = await bookedGuest();
    const table = await createTable(db, event.id, { capacity: 2, label: "K2" });
    const door = await actorOf("controller");
    await expectDomain(
      registerWalkIn(db, door, {
        eventId: event.id,
        tableId: table.id,
        guestName: "Kalabalık",
        guestCount: 3,
      }),
      "conflict",
      "Kişi sayısı (3) masa kapasitesini (2) aşıyor",
    );
    expect(await db.select().from(reservations).where(eq(reservations.tableId, table.id))).toHaveLength(0);
  });

  it("iptal edilmiş rezervasyonun masası walk-in için kullanılabilir", async () => {
    const { event, table, reservation } = await bookedGuest();
    await setReservationStatus(reservation.id, "cancelled");
    const door = await actorOf("controller");
    const result = await registerWalkIn(db, door, {
      eventId: event.id,
      tableId: table.id,
      guestName: "Boş Masa",
      guestCount: 1,
    });
    expect(result.outcome).toBe("checked_in");
  });
});

describe("updateGuestCount", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("kapasiteye kadar kabul eder, aşımı reddeder", async () => {
    const { event, reservation } = await bookedGuest();
    const door = await actorOf("controller");

    expect(
      await updateGuestCount(db, door, {
        eventId: event.id,
        reservationId: reservation.id,
        guestCount: 4,
      }),
    ).toEqual({
      reservationId: reservation.id,
      guestCount: 4,
    });
    await expectDomain(
      updateGuestCount(db, door, {
        eventId: event.id,
        reservationId: reservation.id,
        guestCount: 5,
      }),
      "conflict",
      "Kişi sayısı (5) masa kapasitesini (4) aşıyor",
    );
    expect((await reservationRow(reservation.id)).guestCount).toBe(4);
  });

  it("giriş yapmış misafirin kişi sayısı da değişebilir", async () => {
    const { event, reservation } = await bookedGuest();
    await db.update(reservations).set({ status: "checked_in" }).where(eq(reservations.id, reservation.id));
    const door = await actorOf("controller");
    const result = await updateGuestCount(db, door, {
      eventId: event.id,
      reservationId: reservation.id,
      guestCount: 3,
    });
    expect(result.guestCount).toBe(3);
  });

  it("başka etkinliğin rezervasyonu not_found", async () => {
    const a = await bookedGuest();
    const b = await bookedGuest();
    const door = await actorOf("controller");
    await expectDomain(
      updateGuestCount(db, door, {
        eventId: b.event.id,
        reservationId: a.reservation.id,
        guestCount: 1,
      }),
      "not_found",
      "Rezervasyon bulunamadı",
    );
  });
});
