import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { eventStats } from "@/features/check-in/service";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { createCustomer, createEvent, createReservation, createTable, createUser } from "../../helpers/factories";
import { actorOf, expectDomain } from "./fixtures";

describe("eventStats", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("beklenen = bekleyen + onaylı + giriş yaptı; kalan = bekleyen + onaylı; kişi toplamları", async () => {
    const organizer = await createUser(db, { role: "organizer" });
    const event = await createEvent(db, {
      status: "active",
      organizerId: organizer.id,
    });
    const customer = await createCustomer(db);
    const plan = [
      ["pending", 2],
      ["confirmed", 3],
      ["confirmed", 4],
      ["checked_in", 5],
      ["cancelled", 6],
      ["no_show", 7],
      ["no_show", 1],
    ] as const;
    for (const [status, guestCount] of plan) {
      const table = await createTable(db, event.id, { capacity: 8 });
      await createReservation(db, {
        eventId: event.id,
        tableId: table.id,
        customerId: customer.id,
        status,
        guestCount,
      });
    }
    // Başka etkinliğin rezervasyonu sayılmaz.
    const other = await createEvent(db);
    const otherTable = await createTable(db, other.id);
    await createReservation(db, {
      eventId: other.id,
      tableId: otherTable.id,
      customerId: customer.id,
      status: "checked_in",
    });

    const door = await actorOf("controller");
    expect(await eventStats(db, door, event.id)).toEqual({
      pending: 1,
      confirmed: 2,
      checkedIn: 1,
      cancelled: 1,
      noShow: 2,
      totalExpected: 4,
      remaining: 3,
      checkInPercentage: 25,
      expectedGuests: 14,
      checkedInGuests: 5,
    });
  });

  it("boş etkinlik sıfır döner; olmayan veya başka organizatörün etkinliği not_found", async () => {
    const event = await createEvent(db, { status: "active" });
    const door = await actorOf("controller");
    expect(await eventStats(db, door, event.id)).toMatchObject({
      totalExpected: 0,
      remaining: 0,
      checkInPercentage: 0,
    });
    const stranger = await actorOf("organizer");
    await expectDomain(eventStats(db, stranger, event.id), "not_found", "Etkinlik bulunamadı");
    await expectDomain(eventStats(db, door, crypto.randomUUID()), "not_found", "Etkinlik bulunamadı");
  });
});
