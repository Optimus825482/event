import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { customers, reservations } from "@/db/schema";
import { checkIn } from "@/features/check-in/service";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { actorOf, bookedGuest, checkInLog, customerRow, key, reservationRow } from "./fixtures";
import { memberActor } from "../../helpers/actors";

const N = 10;

// Her çağrı `db` alır: `db.transaction` havuzdan ayrı bir bağlantı açar, yani gerçek eşzamanlılık.
describe("spec §13 madde 2: aynı QR ile eşzamanlı check-in", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it(`${N} eşzamanlı istek, farklı anahtarlar: tek 'checked_in', ${N - 1} 'already_checked_in', sayaç +1`, async () => {
    const { event, customer, reservation } = await bookedGuest();
    const doors = await Promise.all(Array.from({ length: N }, () => actorOf(memberActor("casino", { check_in: "vc--" }))));

    const results = await Promise.all(
      doors.map((door) =>
        checkIn(db, door, {
          eventId: event.id,
          idempotencyKey: key(),
          token: reservation.qrToken,
        }),
      ),
    );

    const winners = results.filter((r) => r.outcome === "checked_in");
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "already_checked_in")).toHaveLength(N - 1);
    const winner = winners[0];
    for (const r of results) {
      expect(r.checkedInAt).toBe(winner?.checkedInAt);
      expect(r.checkedInBy).toEqual(winner?.checkedInBy);
    }
    expect((await customerRow(customer.id)).totalAttendedEvents).toBe(1);
    expect((await reservationRow(reservation.id)).checkedInBy).toBe(winner?.checkedInBy?.id);
    const log = await checkInLog(reservation.id);
    expect(log).toHaveLength(N);
    expect(log.filter((r) => r.outcome === "checked_in")).toHaveLength(1);
  });

  it(`${N} eşzamanlı istek, aynı anahtar (çevrimdışı kuyruk tekrarı): birebir aynı yanıt, sayaç +1, tek kayıt`, async () => {
    const { event, customer, reservation } = await bookedGuest();
    const door = await actorOf(memberActor("casino", { check_in: "vc--" }));
    const idempotencyKey = key();

    const results = await Promise.all(
      Array.from({ length: N }, () =>
        checkIn(db, door, {
          eventId: event.id,
          idempotencyKey,
          token: reservation.qrToken,
        }),
      ),
    );

    expect(results[0]?.outcome).toBe("checked_in");
    for (const r of results) expect(r).toEqual(results[0]);
    expect((await customerRow(customer.id)).totalAttendedEvents).toBe(1);
    expect(await checkInLog(reservation.id)).toHaveLength(1);

    // Sonradan gelen tekrar da (kuyruk yeniden gönderimi) aynı yanıtı alır.
    const later = await checkIn(db, door, {
      eventId: event.id,
      idempotencyKey,
      token: reservation.qrToken,
    });
    expect(later).toEqual(results[0]);
  });

  it("aynı misafirin no_show kaydına eşzamanlı girişler gelmedi sayacını yalnızca bir kez geri alır", async () => {
    const { event, customer, reservation } = await bookedGuest();
    await db.update(reservations).set({ status: "no_show" }).where(eq(reservations.id, reservation.id));
    await db.update(customers).set({ noShowCount: 2 }).where(eq(customers.id, customer.id));
    const door = await actorOf(memberActor("casino", { check_in: "vc--" }));

    const results = await Promise.all(
      Array.from({ length: N }, () =>
        checkIn(db, door, {
          eventId: event.id,
          idempotencyKey: key(),
          reservationId: reservation.id,
        }),
      ),
    );

    expect(results.filter((r) => r.outcome === "checked_in")).toHaveLength(1);
    const c = await customerRow(customer.id);
    expect(c.totalAttendedEvents).toBe(1);
    expect(c.noShowCount).toBe(1);
  });
});
