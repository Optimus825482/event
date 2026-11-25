import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { guestNotes } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { getCustomerDetail } from "@/features/customers/queries";
import { addNote } from "@/features/customers/notes-service";
import { adminActor, managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createCustomer, createEvent, createReservation, createTable } from "../../helpers/factories";

async function bookedEvent(organizerId: string, customerId: string) {
  const event = await createEvent(db, { organizerId });
  const table = await createTable(db, event.id);
  const reservation = await createReservation(db, { eventId: event.id, tableId: table.id, customerId });
  return { event, reservation };
}

describe("müşteri CRM: etkinliği oluşturan kişi kapsamı belirlemez (M5)", () => {
  let casino: Actor;
  let creatorA: Actor;
  let creatorB: Actor;

  beforeEach(async () => {
    await truncateAll();
    casino = await persistActor(db, managerActor("casino"));
    creatorA = await persistActor(db, managerActor("entertainment"));
    creatorB = await persistActor(db, adminActor());
  });

  it("Casino yöneticisi müşteri geçmişinde ve notlarda tüm etkinlikleri görür", async () => {
    const customer = await createCustomer(db);
    const a = await bookedEvent(creatorA.id, customer.id);
    const b = await bookedEvent(creatorB.id, customer.id);
    await db.insert(guestNotes).values([
      { customerId: customer.id, content: "genel", eventId: null },
      { customerId: customer.id, content: "A", eventId: a.event.id },
      { customerId: customer.id, content: "B", eventId: b.event.id },
    ]);

    const detail = await getCustomerDetail(db, casino, customer.id);
    expect(detail?.reservations.map((r) => r.eventId).sort()).toEqual([a.event.id, b.event.id].sort());
    expect(detail?.notes.map((n) => n.content).sort()).toEqual(["A", "B", "genel"]);
  });

  describe("addNote ebeveyn doğrulaması", () => {
    it("olmayan etkinliğe not eklenemez (not_found)", async () => {
      const customer = await createCustomer(db);
      await expect(
        addNote(db, casino, {
          customerId: customer.id,
          content: "x",
          noteType: "general",
          eventId: "00000000-0000-4000-8000-000000000000",
        }),
      ).rejects.toMatchObject({ code: "not_found" });
      expect(await db.select().from(guestNotes)).toHaveLength(0);
    });

    it("başkasının oluşturduğu etkinliğe ve o etkinlikteki rezervasyona not eklenebilir", async () => {
      const customer = await createCustomer(db);
      const booked = await bookedEvent(creatorA.id, customer.id);

      await addNote(db, casino, {
        customerId: customer.id,
        content: "ok",
        noteType: "general",
        eventId: booked.event.id,
        reservationId: booked.reservation.id,
      });
      expect(await db.select().from(guestNotes)).toHaveLength(1);
    });

    it("rezervasyon başka bir müşteriye ya da başka bir etkinliğe aitse reddedilir", async () => {
      const customer = await createCustomer(db);
      const stranger = await createCustomer(db);
      const own = await bookedEvent(creatorA.id, customer.id);
      const strangers = await bookedEvent(creatorA.id, stranger.id);

      await expect(
        addNote(db, casino, {
          customerId: customer.id,
          content: "x",
          noteType: "general",
          reservationId: strangers.reservation.id,
        }),
      ).rejects.toMatchObject({ code: "invalid" });
      await expect(
        addNote(db, casino, {
          customerId: customer.id,
          content: "x",
          noteType: "general",
          eventId: strangers.event.id,
          reservationId: own.reservation.id,
        }),
      ).rejects.toMatchObject({ code: "invalid" });
    });

    it("olmayan rezervasyona not eklenemez (not_found)", async () => {
      const customer = await createCustomer(db);
      await expect(
        addNote(db, casino, {
          customerId: customer.id,
          content: "x",
          noteType: "general",
          reservationId: "00000000-0000-4000-8000-000000000000",
        }),
      ).rejects.toMatchObject({ code: "not_found" });
    });
  });
});
