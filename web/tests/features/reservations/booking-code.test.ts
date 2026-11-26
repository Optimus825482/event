import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { customers, reservations } from "@/db/schema";
import { getReservationDetail, listReservations } from "@/features/reservations/queries";
import { createReservation } from "@/features/reservations/service";
import { truncateAll } from "../../helpers/db";
import { createCustomer } from "../../helpers/factories";
import { adminActor } from "../../helpers/actors";
import { pgConstraintOf } from "@/lib/pg-error";
import { actorOf, bookable, customerRow, rejection } from "./fixtures";

const codes = vi.hoisted(() => ({ queue: [] as string[], fallback: undefined as string | undefined }));

vi.mock("@/lib/short-code", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/short-code")>();
  return {
    ...original,
    randomBookingCode: () => codes.queue.shift() ?? codes.fallback ?? original.randomBookingCode(),
  };
});

describe("rezervasyon kodu", () => {
  beforeEach(async () => {
    codes.queue = [];
    codes.fallback = undefined;
    await truncateAll();
  });

  it("yeni rezervasyon R ile başlayan 7 karakterlik kod alır", async () => {
    const admin = await actorOf(adminActor());
    const { event, table, customer } = await bookable();
    const row = await createReservation(db, admin, {
      eventId: event.id,
      tableId: table.id,
      guestCount: 2,
      customerId: customer.id,
    });
    expect(row.bookingCode).toMatch(/^R[2-9A-HJ-NP-Z]{6}$/);
  });

  it("kod çakışırsa yeni kodla yeniden denenir", async () => {
    const admin = await actorOf(adminActor());
    const { event, table, customer } = await bookable();
    const other = await createCustomer(db);
    const first = await createReservation(db, admin, {
      eventId: event.id,
      tableId: table.id,
      guestCount: 2,
      customerId: other.id,
    });
    await db.update(reservations).set({ status: "cancelled" });
    codes.queue = [first.bookingCode, first.bookingCode, "RNEW234"];
    const row = await createReservation(db, admin, {
      eventId: event.id,
      tableId: table.id,
      guestCount: 2,
      customerId: customer.id,
    });
    expect(row.bookingCode).toBe("RNEW234");
    expect((await customerRow(customer.id)).totalReservations).toBe(1);
  });

  it("üç denemede de çakışırsa işlem geri alınır", async () => {
    const admin = await actorOf(adminActor());
    const { event, table, customer } = await bookable();
    const other = await createCustomer(db);
    const first = await createReservation(db, admin, {
      eventId: event.id,
      tableId: table.id,
      guestCount: 2,
      customerId: other.id,
    });
    await db.update(reservations).set({ status: "cancelled" });
    codes.fallback = first.bookingCode;
    const beforeCustomers = (await db.select().from(customers)).length;
    const error = await rejection(
      createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: customer.id }),
    );
    expect(pgConstraintOf(error)).toBe("reservations_booking_code_uq");
    expect(await db.select().from(reservations)).toHaveLength(1);
    expect(await db.select().from(customers)).toHaveLength(beforeCustomers);
    expect((await customerRow(customer.id)).totalReservations).toBe(0);
  });

  it("liste ve ayrıntı kodu döner", async () => {
    const admin = await actorOf(adminActor());
    const { event, table, customer } = await bookable();
    const row = await createReservation(db, admin, {
      eventId: event.id,
      tableId: table.id,
      guestCount: 2,
      customerId: customer.id,
    });
    const list = await listReservations(db, admin, { eventId: event.id, page: 1, pageSize: 20 });
    expect(list.items[0]?.bookingCode).toBe(row.bookingCode);
    const detail = await getReservationDetail(db, admin, row.id);
    expect(detail?.reservation.bookingCode).toBe(row.bookingCode);
  });
});
