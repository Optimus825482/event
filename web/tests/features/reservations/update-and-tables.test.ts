import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventTables, events } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { signQrToken } from "@/features/reservations/qr-token";
import {
  availableTables,
  createReservation,
  lookupReservationByQr,
  updateReservation,
} from "@/features/reservations/service";
import { truncateAll } from "../../helpers/db";
import { createCustomer, createReservation as seedReservation } from "../../helpers/factories";
import { actorOf, legacyActorOf, bookable, createTable, expectDomain, reservationRow, TABLE_TAKEN } from "./fixtures";
import { adminActor } from "../../helpers/actors";

describe("updateReservation", () => {
  let admin: Actor;

  beforeEach(async () => {
    await truncateAll();
    admin = await actorOf(adminActor());
  });

  it("masa ve kişi sayısı değişir; QR belirteci aynı kalır", async () => {
    const { event, table, customer } = await bookable();
    const row = await createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: customer.id });
    const big = await createTable(db, event.id, { capacity: 10, label: "B7" });

    const updated = await updateReservation(db, admin, { id: row.id, tableId: big.id, guestCount: 9, guestName: "Yeni Ad" });
    expect(updated).toMatchObject({ tableId: big.id, guestCount: 9, guestName: "Yeni Ad", qrToken: row.qrToken });
  });

  it("dolu masaya taşıma aynı mesajla conflict, satır değişmez", async () => {
    const { event, table, customer } = await bookable();
    const t2 = await createTable(db, event.id, { capacity: 4 });
    const other = await createCustomer(db);
    const a = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
    await seedReservation(db, { eventId: event.id, tableId: t2.id, customerId: other.id });

    await expectDomain(updateReservation(db, admin, { id: a.id, tableId: t2.id }), "conflict", TABLE_TAKEN);
    expect((await reservationRow(a.id)).tableId).toBe(table.id);
  });

  it("kişi sayısı yeni ya da mevcut masanın kapasitesini aşarsa conflict (madde 4)", async () => {
    const { event, table, customer } = await bookable();
    const small = await createTable(db, event.id, { capacity: 2 });
    const row = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id, guestCount: 3 });

    await expectDomain(updateReservation(db, admin, { id: row.id, tableId: small.id }), "conflict", /kapasitesini \(2\)/);
    await expectDomain(updateReservation(db, admin, { id: row.id, guestCount: 5 }), "conflict", /kapasitesini \(4\)/);
    expect((await reservationRow(row.id)).guestCount).toBe(3);
  });

  it("kapasiteyi önceden aşan rezervasyonun adı düzenlenebilir; masa ya da kişi sayısı değişince kapasite denetlenir", async () => {
    const { event, table, customer } = await bookable();
    const row = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id, guestCount: 12 });

    const renamed = await updateReservation(db, admin, { id: row.id, guestName: "Yeni Ad", tableId: table.id, guestCount: 12 });
    expect(renamed).toMatchObject({ guestName: "Yeni Ad", guestCount: 12 });
    await expectDomain(updateReservation(db, admin, { id: row.id, guestCount: 13 }), "conflict", /kapasitesini/);
  });

  it("başka etkinliğin masasına taşınamaz", async () => {
    const { event, table, customer } = await bookable();
    const foreign = await bookable();
    const row = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
    await expectDomain(updateReservation(db, admin, { id: row.id, tableId: foreign.table.id }), "not_found");
  });

  it("iptal edilmiş rezervasyon ve tamamlanmış etkinlik düzenlenemez", async () => {
    const { event, table, customer } = await bookable();
    const cancelled = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id, status: "cancelled" });
    await expectDomain(updateReservation(db, admin, { id: cancelled.id, guestCount: 1 }), "conflict", /düzenlenemez/);

    const t2 = await createTable(db, event.id);
    const live = await seedReservation(db, { eventId: event.id, tableId: t2.id, customerId: customer.id });
    await db.update(events).set({ status: "completed" }).where(eq(events.id, event.id));
    await expectDomain(updateReservation(db, admin, { id: live.id, guestCount: 1 }), "conflict", /tamamlanmış/);
  });

  it("null misafir alanlarını temizler, verilmeyenleri korur", async () => {
    const { event, table, customer } = await bookable();
    const row = await seedReservation(db, {
      eventId: event.id,
      tableId: table.id,
      customerId: customer.id,
      guestName: "Ad",
      specialRequests: "Vegan",
    });
    const updated = await updateReservation(db, admin, { id: row.id, specialRequests: null });
    expect(updated.specialRequests).toBeNull();
    expect(updated.guestName).toBe("Ad");
  });
});

describe("QR doğrulama (spec §13 madde 7)", () => {
  let admin: Actor;

  beforeEach(async () => {
    await truncateAll();
    admin = await actorOf(adminActor());
  });

  it("masa değişince aynı QR yeni masayı döndürür", async () => {
    const { event, table, customer } = await bookable();
    const row = await createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: customer.id });
    expect(await lookupReservationByQr(db, row.qrToken)).toMatchObject({
      reservationId: row.id,
      eventId: event.id,
      tableId: table.id,
      tableLabel: "A1",
      status: "confirmed",
    });

    const moved = await createTable(db, event.id, { capacity: 6, label: "VIP-3" });
    await updateReservation(db, admin, { id: row.id, tableId: moved.id });
    expect(await lookupReservationByQr(db, row.qrToken)).toMatchObject({ tableId: moved.id, tableLabel: "VIP-3" });

    await db.update(eventTables).set({ label: "VIP-9" }).where(eq(eventTables.id, moved.id));
    expect(await lookupReservationByQr(db, row.qrToken)).toMatchObject({ tableLabel: "VIP-9" });
  });

  it("kurcalanmış, başka anahtarlı ya da kayıtta olmayan belirteç null döner", async () => {
    const { event, table, customer } = await bookable();
    const row = await createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: customer.id });
    expect(await lookupReservationByQr(db, `${row.qrToken}x`)).toBeNull();
    expect(await lookupReservationByQr(db, signQrToken(row.id, Buffer.from("z".repeat(32))))).toBeNull();
    expect(await lookupReservationByQr(db, signQrToken(crypto.randomUUID()))).toBeNull();
    // İmzası geçerli ama satırda saklanan belirteç farklıysa (ör. taşınan eski kayıt) kabul edilmez.
    const legacy = await seedReservation(db, { eventId: event.id, tableId: (await createTable(db, event.id)).id, customerId: customer.id });
    expect(await lookupReservationByQr(db, signQrToken(legacy.id))).toBeNull();
  });
});

describe("availableTables (spec §13 madde 5)", () => {
  let admin: Actor;

  beforeEach(async () => {
    await truncateAll();
    admin = await actorOf(adminActor());
  });

  it("etiket ve kapasite event_tables'tan gelir; aktif rezervasyonlu masa müsait değildir", async () => {
    const { event, table, customer } = await bookable();
    const b = await createTable(db, event.id, { capacity: 10, label: "B1", isLoca: true });
    const c = await createTable(db, event.id, { capacity: 6, label: "C1" });
    await createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: customer.id });
    await seedReservation(db, { eventId: event.id, tableId: c.id, customerId: customer.id, status: "cancelled" });
    await seedReservation(db, { eventId: event.id, tableId: b.id, customerId: customer.id, status: "no_show" });

    const list = await availableTables(db, admin, { eventId: event.id });
    expect(list.map((t) => [t.label, t.capacity, t.available])).toEqual([
      ["A1", 4, false],
      ["B1", 10, true],
      ["C1", 6, true],
    ]);
    expect(list.find((t) => t.label === "B1")?.isLoca).toBe(true);

    await db.update(eventTables).set({ capacity: 12, label: "B1-yeni" }).where(eq(eventTables.id, b.id));
    const after = await availableTables(db, admin, { eventId: event.id });
    expect(after.find((t) => t.id === b.id)).toMatchObject({ label: "B1-yeni", capacity: 12, available: true });
  });

  it("excludeReservationId ile rezervasyonun kendi masası müsait görünür", async () => {
    const { event, table, customer } = await bookable();
    const row = await createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: customer.id });
    const list = await availableTables(db, admin, { eventId: event.id, excludeReservationId: row.id });
    expect(list[0]?.available).toBe(true);
  });

  it("müsait listedeki her masaya rezervasyon yapılabilir, dolu olana yapılamaz", async () => {
    const { event, table, customer } = await bookable();
    await createTable(db, event.id, { capacity: 4, label: "A2" });
    await createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: customer.id });
    for (const t of await availableTables(db, admin, { eventId: event.id })) {
      const attempt = createReservation(db, admin, {
        eventId: event.id,
        tableId: t.id,
        guestCount: 2,
        customerId: (await createCustomer(db)).id,
      });
      if (t.available) await expect(attempt).resolves.toMatchObject({ tableId: t.id });
      else await expectDomain(attempt, "conflict", TABLE_TAKEN);
    }
  });

  it("organizatör başkasının etkinliğinde not_found", async () => {
    const organizer = await legacyActorOf("organizer");
    const { event } = await bookable();
    await expectDomain(availableTables(db, organizer, { eventId: event.id }), "not_found");
  });
});
