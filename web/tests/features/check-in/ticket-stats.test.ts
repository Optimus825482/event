import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventStats, recentCheckIns } from "@/features/check-in/service";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { doorActor, stampTicketCheckIn, ticketedEvent } from "../../helpers/door";
import { createCustomer, createReservation, createTable } from "../../helpers/factories";
import { createPendingHold, expireOrder } from "../../helpers/ticketing";
import { bookedGuest } from "./fixtures";

describe("istatistik ve son girişlerde bilet", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("eventStats bilet sayılarını döner; rezervasyon alanları değişmez", async () => {
    const door = await doorActor();
    const te = await ticketedEvent(); // test siparişleri demo sağlayıcıyla ödenir: demo biletler de sayılır
    expect(await eventStats(db, door, te.event.id)).toMatchObject({
      ticketsIssued: 3,
      ticketsCheckedIn: 0,
      totalExpected: 0,
      checkedIn: 0,
      checkInPercentage: 0,
    });
    await stampTicketCheckIn(te.tickets[0]!.ticketId);
    expect(await eventStats(db, door, te.event.id)).toMatchObject({
      ticketsIssued: 3,
      ticketsCheckedIn: 1,
      checkedIn: 0,
      checkedInGuests: 0,
    });
  });

  it("tutulan ve süresi dolmuş biletler sayılmaz", async () => {
    const door = await doorActor();
    const te = await ticketedEvent();
    const [t1, t2] = te.tables;
    const hold = await createPendingHold(db, { eventId: te.event.id, items: [{ tableId: t1!.id, quantity: 2 }] });
    const expired = await createPendingHold(db, { eventId: te.event.id, items: [{ tableId: t2!.id, quantity: 3 }] });
    await expireOrder(db, expired.orderId);
    expect(hold.orderId).not.toBe(expired.orderId);
    expect(await eventStats(db, door, te.event.id)).toMatchObject({ ticketsIssued: 3, ticketsCheckedIn: 0 });
  });

  it("bileti olmayan etkinlikte ikisi de 0", async () => {
    const door = await doorActor();
    const { event } = await bookedGuest();
    expect(await eventStats(db, door, event.id)).toMatchObject({
      ticketsIssued: 0,
      ticketsCheckedIn: 0,
      totalExpected: 1,
    });
  });

  it("recentCheckIns: bilet ve rezervasyon girişleri tek listede, en yeni önce", async () => {
    const door = await doorActor();
    const te = await ticketedEvent();
    const table = await createTable(db, te.event.id, { label: "C1", capacity: 4 });
    const customer = await createCustomer(db);
    const reservation = await createReservation(db, {
      eventId: te.event.id,
      tableId: table.id,
      customerId: customer.id,
      status: "checked_in",
      checkedInAt: new Date("2026-11-26T18:00:00Z"),
    });
    await stampTicketCheckIn(te.tickets[0]!.ticketId, new Date("2026-11-26T18:05:00Z"));
    await stampTicketCheckIn(te.tickets[1]!.ticketId, new Date("2026-11-26T17:55:00Z"));
    const list = await recentCheckIns(db, door, te.event.id);
    expect(list.map((r) => r.kind)).toEqual(["ticket", "reservation", "ticket"]);
    expect(list[0]).toMatchObject({
      kind: "ticket",
      reservationId: null,
      guestName: "Deniz Yılmaz",
      guestCount: 1,
      tableLabel: "B1",
    });
    expect(list[1]).toMatchObject({ kind: "reservation", id: reservation.id, reservationId: reservation.id });
    expect(new Set(list.map((r) => r.id)).size).toBe(3);
  });

  it("recentCheckIns sınırı birleşik listeye uygular", async () => {
    const door = await doorActor();
    const te = await ticketedEvent();
    const table = await createTable(db, te.event.id, { label: "C1", capacity: 4 });
    const customer = await createCustomer(db);
    await createReservation(db, {
      eventId: te.event.id,
      tableId: table.id,
      customerId: customer.id,
      status: "checked_in",
      checkedInAt: new Date("2026-11-26T18:00:00Z"),
    });
    await stampTicketCheckIn(te.tickets[0]!.ticketId, new Date("2026-11-26T18:05:00Z"));
    await stampTicketCheckIn(te.tickets[1]!.ticketId, new Date("2026-11-26T17:55:00Z"));
    const list = await recentCheckIns(db, door, te.event.id, 2);
    expect(list.map((r) => r.kind)).toEqual(["ticket", "reservation"]);
  });
});
