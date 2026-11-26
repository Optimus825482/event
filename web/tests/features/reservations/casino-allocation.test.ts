import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { customers, reservations } from "@/db/schema";
import { inTransaction } from "@/features/reservations/internal";
import { availableTables, changeReservationStatus, createReservation, updateReservation } from "@/features/reservations/service";
import { truncateAll } from "../../helpers/db";
import { createCustomer, createEvent, createTable } from "../../helpers/factories";
import { setAllocation } from "../../helpers/seating";
import { adminActor } from "../../helpers/actors";
import { actorOf, customerRow, expectDomain, reservationRow } from "./fixtures";

const NOT_CASINO = "Bu masa Casino'ya ayrılmamış";

async function rowCounts() {
  const [r, c] = await Promise.all([db.select().from(reservations), db.select().from(customers)]);
  return { reservations: r.length, customers: c.length };
}

describe("rezervasyon yalnızca Casino masasına", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it.each(["pending", "online", "closed"] as const)(
    "%s masaya rezervasyon yapılamaz; müşteri kaydı da yazılmaz",
    async (allocation) => {
      const admin = await actorOf(adminActor());
      const event = await createEvent(db, { status: "published" });
      const table = await createTable(db, event.id, { capacity: 4, allocation });
      await expectDomain(
        createReservation(db, admin, {
          eventId: event.id,
          tableId: table.id,
          guestCount: 2,
          guestName: "Yeni Misafir",
          guestPhone: "05321234567",
        }),
        "conflict",
        NOT_CASINO,
      );
      expect(await rowCounts()).toEqual({ reservations: 0, customers: 0 });
    },
  );

  it("casino masaya rezervasyon yapılır", async () => {
    const admin = await actorOf(adminActor());
    const event = await createEvent(db, { status: "published" });
    const table = await createTable(db, event.id, { capacity: 4, allocation: "casino" });
    const customer = await createCustomer(db);
    const row = await createReservation(db, admin, {
      eventId: event.id,
      tableId: table.id,
      guestCount: 2,
      customerId: customer.id,
    });
    expect(row.status).toBe("confirmed");
  });

  it("rezervasyon casino olmayan masaya taşınamaz", async () => {
    const admin = await actorOf(adminActor());
    const event = await createEvent(db, { status: "published" });
    const casino = await createTable(db, event.id, { capacity: 4, allocation: "casino" });
    const pending = await createTable(db, event.id, { capacity: 4, allocation: "pending" });
    const customer = await createCustomer(db);
    const row = await createReservation(db, admin, {
      eventId: event.id,
      tableId: casino.id,
      guestCount: 2,
      customerId: customer.id,
    });
    await expectDomain(updateReservation(db, admin, { id: row.id, tableId: pending.id }), "conflict", NOT_CASINO);
    expect((await reservationRow(row.id)).tableId).toBe(casino.id);
  });

  it("masası serbest bırakılmış iptal rezervasyon yeniden etkinleştirilemez", async () => {
    const admin = await actorOf(adminActor());
    const event = await createEvent(db, { status: "published" });
    const table = await createTable(db, event.id, { capacity: 4, allocation: "casino" });
    const customer = await createCustomer(db);
    const row = await createReservation(db, admin, {
      eventId: event.id,
      tableId: table.id,
      guestCount: 2,
      customerId: customer.id,
    });
    await changeReservationStatus(db, admin, { id: row.id, status: "cancelled" });
    await setAllocation(db, [table.id], "pending");
    const before = (await customerRow(customer.id)).totalReservations;

    await expectDomain(changeReservationStatus(db, admin, { id: row.id, status: "confirmed" }), "conflict", NOT_CASINO);
    expect((await reservationRow(row.id)).status).toBe("cancelled");
    expect((await customerRow(customer.id)).totalReservations).toBe(before);
  });

  it("servis denetimi atlansa da yabancı anahtar aynı mesaja çevrilir", async () => {
    const event = await createEvent(db, { status: "published" });
    const table = await createTable(db, event.id, { capacity: 4, allocation: "pending" });
    const customer = await createCustomer(db);
    await expectDomain(
      inTransaction(db, (tx) =>
        tx.insert(reservations).values({
          eventId: event.id,
          tableId: table.id,
          customerId: customer.id,
          guestCount: 2,
          status: "confirmed",
          qrToken: "x",
          bookingCode: "RTEST234",
        }),
      ),
      "conflict",
      NOT_CASINO,
    );
  });

  it("olmayan müşteri hâlâ genel mesajı alır", async () => {
    const event = await createEvent(db, { status: "published" });
    const table = await createTable(db, event.id, { capacity: 4, allocation: "casino" });
    await expectDomain(
      inTransaction(db, (tx) =>
        tx.insert(reservations).values({
          eventId: event.id,
          tableId: table.id,
          customerId: randomUUID(),
          guestCount: 2,
          status: "confirmed",
          qrToken: "x",
          bookingCode: "RTEST234",
        }),
      ),
      "conflict",
      "Masa veya müşteri artık mevcut değil",
    );
  });

  it("availableTables tahsisi döner; yalnızca rezervasyonsuz casino masası müsaittir", async () => {
    const admin = await actorOf(adminActor());
    const event = await createEvent(db, { status: "published" });
    await createTable(db, event.id, { label: "A1", capacity: 4, allocation: "casino" });
    const a2 = await createTable(db, event.id, { label: "A2", capacity: 4, allocation: "casino" });
    await createTable(db, event.id, { label: "A3", capacity: 4, allocation: "pending" });
    await createTable(db, event.id, { label: "A4", capacity: 4, allocation: "online" });
    const customer = await createCustomer(db);
    await createReservation(db, admin, { eventId: event.id, tableId: a2.id, guestCount: 2, customerId: customer.id });

    const tables = await availableTables(db, admin, { eventId: event.id });
    expect(tables.map((t) => [t.label, t.allocation, t.available])).toEqual([
      ["A1", "casino", true],
      ["A2", "casino", false],
      ["A3", "pending", false],
      ["A4", "online", false],
    ]);
  });
});
