import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { customers, reservations } from "@/db/schema";
import { checkIn } from "@/features/check-in/service";
import { signQrToken } from "@/features/reservations/qr-token";
import { createReservation as bookReservation } from "@/features/reservations/service";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { createCustomer, createReservation, createTable } from "../../helpers/factories";
import {
  actorOf,
  bookedGuest,
  checkInLog,
  customerRow,
  expectDomain,
  key,
  reservationRow,
  setEventStatus,
  setReservationStatus,
} from "./fixtures";

describe("checkIn", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("imzalı QR ile giriş yapar, sayacı artırır ve kaydı saklar", async () => {
    const { event, table, customer, reservation } = await bookedGuest();
    const door = await actorOf("controller");
    const before = Date.now();

    const result = await checkIn(db, door, {
      eventId: event.id,
      idempotencyKey: key(),
      token: reservation.qrToken,
    });

    expect(result).toMatchObject({
      outcome: "checked_in",
      reservationId: reservation.id,
      eventId: event.id,
      tableId: table.id,
      tableLabel: "A1",
      guestCount: 2,
      checkedInBy: { id: door.id, username: door.username },
    });
    expect(Date.parse(result.checkedInAt)).toBeGreaterThanOrEqual(before - 1000);
    const row = await reservationRow(reservation.id);
    expect(row.status).toBe("checked_in");
    expect(row.checkedInBy).toBe(door.id);
    expect(row.checkedInAt?.toISOString()).toBe(result.checkedInAt);
    const c = await customerRow(customer.id);
    expect(c.totalAttendedEvents).toBe(1);
    expect(c.lastEventId).toBe(event.id);
    const log = await checkInLog(reservation.id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ outcome: "checked_in", actorId: door.id });
    expect(log[0]?.response).toEqual({ ok: true, data: result });
  });

  it("zaten giriş yapmışsa hata değil 'already_checked_in' ve kimin/ne zaman yaptığını döner", async () => {
    const { event, customer, reservation } = await bookedGuest();
    const first = await actorOf("controller");
    const second = await actorOf("staff");
    const done = await checkIn(db, first, {
      eventId: event.id,
      idempotencyKey: key(),
      token: reservation.qrToken,
    });

    const again = await checkIn(db, second, {
      eventId: event.id,
      idempotencyKey: key(),
      token: reservation.qrToken,
    });

    expect(again.outcome).toBe("already_checked_in");
    expect(again.checkedInAt).toBe(done.checkedInAt);
    expect(again.checkedInBy).toEqual({
      id: first.id,
      username: first.username,
    });
    expect((await customerRow(customer.id)).totalAttendedEvents).toBe(1);
    const outcomes = (await checkInLog(reservation.id)).map((r) => r.outcome).sort();
    expect(outcomes).toEqual(["already_checked_in", "checked_in"]);
  });

  it("iptal edilmiş rezervasyon conflict verir, hiçbir şey değişmez", async () => {
    const { event, customer, reservation } = await bookedGuest();
    await setReservationStatus(reservation.id, "cancelled");
    const door = await actorOf("controller");

    await expectDomain(
      checkIn(db, door, {
        eventId: event.id,
        idempotencyKey: key(),
        token: reservation.qrToken,
      }),
      "conflict",
      "Rezervasyon iptal edilmiş; check-in yapılamaz",
    );
    expect((await reservationRow(reservation.id)).status).toBe("cancelled");
    expect((await customerRow(customer.id)).totalAttendedEvents).toBe(0);
    expect((await checkInLog(reservation.id)).map((r) => r.outcome)).toEqual(["invalid_status"]);
  });

  it("gelmedi (no_show) işaretli misafir giriş yapabilir; gelmedi sayacı geri alınır", async () => {
    const { event, customer, reservation } = await bookedGuest();
    await setReservationStatus(reservation.id, "no_show");
    await db.update(customers).set({ noShowCount: 1 }).where(eq(customers.id, customer.id));
    await setEventStatus(event.id, "completed");
    const door = await actorOf("controller");

    const result = await checkIn(db, door, {
      eventId: event.id,
      idempotencyKey: key(),
      token: reservation.qrToken,
    });

    expect(result.outcome).toBe("checked_in");
    const c = await customerRow(customer.id);
    expect(c.totalAttendedEvents).toBe(1);
    expect(c.noShowCount).toBe(0);
  });

  it("gelmedi misafirin masası başkasına verildiyse conflict verir ve sayaçlar değişmez", async () => {
    const { event, table, customer, reservation } = await bookedGuest();
    await setReservationStatus(reservation.id, "no_show");
    const other = await createCustomer(db);
    await createReservation(db, {
      eventId: event.id,
      tableId: table.id,
      customerId: other.id,
      qrToken: signQrToken(randomUUID()),
    });
    const door = await actorOf("controller");

    await expectDomain(
      checkIn(db, door, {
        eventId: event.id,
        idempotencyKey: key(),
        reservationId: reservation.id,
      }),
      "conflict",
      "Bu masa için aktif bir rezervasyon var",
    );
    expect((await reservationRow(reservation.id)).status).toBe("no_show");
    expect((await customerRow(customer.id)).totalAttendedEvents).toBe(0);
  });

  it("eski QR hash'i (legacy_qr_hash) ile giriş yapar", async () => {
    const { event, reservation } = await bookedGuest();
    const legacyHash = "0123456789abcdef0123456789abcdef";
    await db.update(reservations).set({ legacyQrHash: legacyHash }).where(eq(reservations.id, reservation.id));
    const door = await actorOf("controller");

    const result = await checkIn(db, door, {
      eventId: event.id,
      idempotencyKey: key(),
      legacyHash,
    });

    expect(result).toMatchObject({
      outcome: "checked_in",
      reservationId: reservation.id,
    });
    expect((await reservationRow(reservation.id)).status).toBe("checked_in");
  });

  it("manuel aramadan rezervasyon kimliğiyle giriş yapar", async () => {
    const { event, reservation } = await bookedGuest();
    const door = await actorOf("staff");
    const result = await checkIn(db, door, {
      eventId: event.id,
      idempotencyKey: key(),
      reservationId: reservation.id,
    });
    expect(result.outcome).toBe("checked_in");
  });

  it("başka etkinliğin geçerli QR'ı conflict verir ve o rezervasyona dokunmaz", async () => {
    const a = await bookedGuest();
    const b = await bookedGuest();
    const door = await actorOf("controller");

    await expectDomain(
      checkIn(db, door, {
        eventId: b.event.id,
        idempotencyKey: key(),
        token: a.reservation.qrToken,
      }),
      "conflict",
      "Bu QR kod başka bir etkinliğe ait",
    );
    expect((await reservationRow(a.reservation.id)).status).toBe("confirmed");
  });

  it("geçersiz, kurcalanmış ya da satırla eşleşmeyen belirteç not_found verir", async () => {
    const { event, reservation } = await bookedGuest();
    const door = await actorOf("controller");
    const message = "QR kod geçersiz veya rezervasyon bulunamadı";
    await expectDomain(
      checkIn(db, door, {
        eventId: event.id,
        idempotencyKey: key(),
        token: "bozuk",
      }),
      "not_found",
      message,
    );
    await expectDomain(
      checkIn(db, door, {
        eventId: event.id,
        idempotencyKey: key(),
        token: `${reservation.qrToken}x`,
      }),
      "not_found",
      message,
    );
    await expectDomain(
      checkIn(db, door, {
        eventId: event.id,
        idempotencyKey: key(),
        token: signQrToken(randomUUID()),
      }),
      "not_found",
      message,
    );
    await expectDomain(
      checkIn(db, door, {
        eventId: event.id,
        idempotencyKey: key(),
        legacyHash: "ffffffffffffffffffffffffffffffff",
      }),
      "not_found",
      message,
    );
    expect((await reservationRow(reservation.id)).status).toBe("confirmed");
  });

  it("istemci zaman damgası yalnızca geçmiş 24 saat içindeyse giriş zamanı olur", async () => {
    const door = await actorOf("controller");
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const valid = await bookedGuest();
    const r1 = await checkIn(db, door, {
      eventId: valid.event.id,
      idempotencyKey: key(),
      token: valid.reservation.qrToken,
      clientTimestamp: hourAgo.toISOString(),
    });
    expect(r1.checkedInAt).toBe(hourAgo.toISOString());
    expect((await checkInLog(valid.reservation.id))[0]?.clientTimestamp?.toISOString()).toBe(hourAgo.toISOString());

    for (const offset of [10 * 60 * 1000, -25 * 60 * 60 * 1000]) {
      const guest = await bookedGuest();
      const clientTimestamp = new Date(Date.now() + offset);
      const before = Date.now();
      const result = await checkIn(db, door, {
        eventId: guest.event.id,
        idempotencyKey: key(),
        token: guest.reservation.qrToken,
        clientTimestamp: clientTimestamp.toISOString(),
      });
      const at = Date.parse(result.checkedInAt);
      expect(at).toBeGreaterThanOrEqual(before - 1000);
      expect(at).toBeLessThanOrEqual(Date.now() + 1000);
      // Ham istemci değeri yine de kayıt için saklanır.
      expect((await checkInLog(guest.reservation.id))[0]?.clientTimestamp?.toISOString()).toBe(
        clientTimestamp.toISOString(),
      );
    }
  });

  it("aynı anahtarla tekrar, ilk sonucu (başarısızlık dahil) aynen döndürür; farklı istekte anahtar reddedilir", async () => {
    const { event, reservation } = await bookedGuest();
    const door = await actorOf("controller");
    const k = key();
    await setReservationStatus(reservation.id, "cancelled");
    await expectDomain(
      checkIn(db, door, {
        eventId: event.id,
        idempotencyKey: k,
        token: reservation.qrToken,
      }),
      "conflict",
    );

    // Durum sonradan düzelse de aynı anahtarın sonucu değişmez; yeni anahtar yeni karar verir.
    await setReservationStatus(reservation.id, "confirmed");
    await expectDomain(
      checkIn(db, door, {
        eventId: event.id,
        idempotencyKey: k,
        token: reservation.qrToken,
      }),
      "conflict",
      "Rezervasyon iptal edilmiş; check-in yapılamaz",
    );
    const ok = await checkIn(db, door, {
      eventId: event.id,
      idempotencyKey: key(),
      token: reservation.qrToken,
    });
    expect(ok.outcome).toBe("checked_in");

    await expectDomain(
      checkIn(db, door, {
        eventId: event.id,
        idempotencyKey: k,
        reservationId: reservation.id,
      }),
      "conflict",
      "Bu istek anahtarı başka bir istek için kullanılmış",
    );
  });

  it("organizatör başka organizatörün etkinliğinde not_found alır", async () => {
    const { event, reservation } = await bookedGuest();
    const stranger = await actorOf("organizer");
    await expectDomain(
      checkIn(db, stranger, {
        eventId: event.id,
        idempotencyKey: key(),
        token: reservation.qrToken,
      }),
      "not_found",
      "Etkinlik bulunamadı",
    );
    expect((await reservationRow(reservation.id)).status).toBe("confirmed");
  });

  it("taslak veya iptal edilmiş etkinlikte check-in yapılamaz", async () => {
    const door = await actorOf("controller");
    for (const status of ["draft", "cancelled"] as const) {
      const { event, reservation } = await bookedGuest();
      await setEventStatus(event.id, status);
      await expectDomain(
        checkIn(db, door, {
          eventId: event.id,
          idempotencyKey: key(),
          token: reservation.qrToken,
        }),
        "conflict",
        /check-in yapılamaz/,
      );
      expect((await reservationRow(reservation.id)).status).toBe("confirmed");
    }
  });

  it("spec §13 madde 8 (QR): içe aktarma yolu (transaction içinde createReservation) imzalı QR üretir ve check-in onu kabul eder", async () => {
    const { event } = await bookedGuest();
    const table = await createTable(db, event.id, { capacity: 6, label: "B2" });
    const admin = await actorOf("admin");
    const imported = await db.transaction((tx) =>
      bookReservation(tx, admin, {
        eventId: event.id,
        tableId: table.id,
        guestCount: 3,
        guestName: "Excel Misafiri",
      }),
    );
    const door = await actorOf("controller");
    const result = await checkIn(db, door, {
      eventId: event.id,
      idempotencyKey: key(),
      token: imported.qrToken,
    });
    expect(result).toMatchObject({
      outcome: "checked_in",
      tableLabel: "B2",
      guestName: "Excel Misafiri",
    });
  });
});
