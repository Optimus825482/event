import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import type { Actor } from "@/features/auth/session";
import { closeRealtime } from "@/features/realtime/listener";
import {
  cancelReservation,
  changeReservationStatus,
  createReservation,
  markNoShows,
  updateReservation,
} from "@/features/reservations/service";
import { truncateAll } from "../../helpers/db";
import { createCustomer, createEvent, createReservation as seedReservation } from "../../helpers/factories";
import { watchEvents } from "../realtime/emitted";
import { actorOf, bookable, createTable } from "./fixtures";

const PAIR = ["reservation.changed", "stats.updated"];

describe("rezervasyon servisi gerçek zamanlı olaylar", () => {
  let admin: Actor;

  beforeEach(async () => {
    await truncateAll();
    admin = await actorOf("admin");
  });
  afterAll(async () => {
    await closeRealtime();
  });

  it("createReservation: commit sonrası reservation.changed + stats.updated", async () => {
    const { event, table, customer } = await bookable();
    const watch = await watchEvents(event.id);
    try {
      const row = await createReservation(db, admin, {
        eventId: event.id,
        tableId: table.id,
        guestCount: 2,
        customerId: customer.id,
      });
      expect(await watch.settled()).toEqual(PAIR);
      expect(watch.events()[0]?.id).toBe(row.id);
    } finally {
      watch.stop();
    }
  });

  it("createReservation başarısızsa (kapasite aşımı) hiçbir olay yayılmaz", async () => {
    const { event, table, customer } = await bookable();
    const watch = await watchEvents(event.id);
    try {
      await expect(
        createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 9, customerId: customer.id }),
      ).rejects.toThrow();
      expect(await watch.settled()).toEqual([]);
    } finally {
      watch.stop();
    }
  });

  it("updateReservation: olay yayar; kapasiteyi aşan güncelleme yaymaz", async () => {
    const { event, table, customer } = await bookable();
    const seeded = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
    const watch = await watchEvents(event.id);
    try {
      await expect(updateReservation(db, admin, { id: seeded.id, guestCount: 9 })).rejects.toThrow();
      expect(await watch.settled()).toEqual([]);
      await updateReservation(db, admin, { id: seeded.id, guestCount: 3 });
      expect(await watch.settled()).toEqual(PAIR);
    } finally {
      watch.stop();
    }
  });

  it("changeReservationStatus ve cancelReservation: her çağrı bir çift olay yayar, reddedilen yaymaz", async () => {
    const { event, table, customer } = await bookable();
    const seeded = await seedReservation(db, {
      eventId: event.id,
      tableId: table.id,
      customerId: customer.id,
      status: "pending",
    });
    const watch = await watchEvents(event.id);
    try {
      await expect(changeReservationStatus(db, admin, { id: seeded.id, status: "checked_in" })).rejects.toThrow();
      expect(await watch.settled()).toEqual([]);

      await changeReservationStatus(db, admin, { id: seeded.id, status: "confirmed" });
      expect(await watch.settled()).toEqual(PAIR);

      await cancelReservation(db, admin, { id: seeded.id });
      expect(await watch.settled()).toEqual([...PAIR, ...PAIR]);
    } finally {
      watch.stop();
    }
  });

  it("markNoShows: tek çift olay (id'siz); tamamlanmamış etkinlikte yaymaz", async () => {
    const open = await bookable();
    const customer = await createCustomer(db);
    const completed = await createEvent(db, { status: "completed" });
    const table = await createTable(db, completed.id, { capacity: 4 });
    await seedReservation(db, { eventId: completed.id, tableId: table.id, customerId: customer.id });

    const watchOpen = await watchEvents(open.event.id);
    const watchDone = await watchEvents(completed.id);
    try {
      await expect(markNoShows(db, admin, { eventId: open.event.id })).rejects.toThrow();
      expect(await watchOpen.settled()).toEqual([]);

      await markNoShows(db, admin, { eventId: completed.id });
      expect(await watchDone.settled()).toEqual(PAIR);
      expect(watchDone.events().every((e) => e.id === undefined)).toBe(true);
    } finally {
      watchOpen.stop();
      watchDone.stop();
    }
  });
});
