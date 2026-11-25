import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { guestNotes } from "@/db/schema";
import type { PolicyActor } from "@/features/auth/policy";
import type { Actor } from "@/features/auth/session";
import { getCustomerDetail } from "@/features/customers/queries";
import { addNote } from "@/features/customers/notes-service";
import { truncateAll } from "../../helpers/db";
import { createCustomer, createEvent, createReservation, createTable, createUser } from "../../helpers/factories";

async function organizer(): Promise<Actor> {
  const u = await createUser(db, { role: "organizer" });
  return { id: u.id, username: u.username, role: "organizer", staffId: null, memberships: [], permissions: [] };
}

async function bookedEvent(organizerId: string, customerId: string) {
  const event = await createEvent(db, { organizerId });
  const table = await createTable(db, event.id);
  const reservation = await createReservation(db, { eventId: event.id, tableId: table.id, customerId });
  return { event, reservation };
}

describe("müşteri CRM: organizatör kapsamı (M5)", () => {
  let mine: Actor;
  let other: Actor;

  beforeEach(async () => {
    await truncateAll();
    mine = await organizer();
    other = await organizer();
  });

  it("organizatör müşteri geçmişinde ve notlarda yalnızca kendi etkinliklerini görür", async () => {
    const customer = await createCustomer(db);
    const own = await bookedEvent(mine.id, customer.id);
    const foreign = await bookedEvent(other.id, customer.id);
    await db.insert(guestNotes).values([
      { customerId: customer.id, content: "genel", eventId: null },
      { customerId: customer.id, content: "benim", eventId: own.event.id },
      { customerId: customer.id, content: "başkasının", eventId: foreign.event.id },
    ]);

    const asOrganizer: PolicyActor = { id: mine.id, role: "organizer", staffId: null };
    const detail = await getCustomerDetail(db, asOrganizer, customer.id);

    expect(detail?.reservations.map((r) => r.eventId)).toEqual([own.event.id]);
    expect(detail?.notes.map((n) => n.content).sort()).toEqual(["benim", "genel"]);
  });

  it("yönetici tüm etkinlikleri görür", async () => {
    const customer = await createCustomer(db);
    await bookedEvent(mine.id, customer.id);
    await bookedEvent(other.id, customer.id);

    const admin: PolicyActor = { id: mine.id, role: "admin", staffId: null };
    expect((await getCustomerDetail(db, admin, customer.id))?.reservations).toHaveLength(2);
  });

  describe("addNote ebeveyn doğrulaması", () => {
    it("organizatör başkasının etkinliğine not ekleyemez; olmayan etkinlik de not_found", async () => {
      const customer = await createCustomer(db);
      const foreign = await bookedEvent(other.id, customer.id);

      await expect(
        addNote(db, mine, { customerId: customer.id, content: "x", noteType: "general", eventId: foreign.event.id }),
      ).rejects.toMatchObject({ code: "not_found" });
      await expect(
        addNote(db, mine, {
          customerId: customer.id,
          content: "x",
          noteType: "general",
          eventId: "00000000-0000-4000-8000-000000000000",
        }),
      ).rejects.toMatchObject({ code: "not_found" });
      expect(await db.select().from(guestNotes)).toHaveLength(0);
    });

    it("organizatör kendi etkinliğine ve o etkinlikteki rezervasyona not ekleyebilir", async () => {
      const customer = await createCustomer(db);
      const own = await bookedEvent(mine.id, customer.id);

      await addNote(db, mine, {
        customerId: customer.id,
        content: "ok",
        noteType: "general",
        eventId: own.event.id,
        reservationId: own.reservation.id,
      });
      expect(await db.select().from(guestNotes)).toHaveLength(1);
    });

    it("rezervasyon başka bir müşteriye ya da başka bir etkinliğe aitse reddedilir", async () => {
      const customer = await createCustomer(db);
      const stranger = await createCustomer(db);
      const own = await bookedEvent(mine.id, customer.id);
      const strangers = await bookedEvent(mine.id, stranger.id);

      await expect(
        addNote(db, mine, {
          customerId: customer.id,
          content: "x",
          noteType: "general",
          reservationId: strangers.reservation.id,
        }),
      ).rejects.toMatchObject({ code: "invalid" });
      await expect(
        addNote(db, mine, {
          customerId: customer.id,
          content: "x",
          noteType: "general",
          eventId: strangers.event.id,
          reservationId: own.reservation.id,
        }),
      ).rejects.toMatchObject({ code: "invalid" });
    });

    it("organizatör başkasının etkinliğindeki rezervasyona not ekleyemez", async () => {
      const customer = await createCustomer(db);
      const foreign = await bookedEvent(other.id, customer.id);

      await expect(
        addNote(db, mine, {
          customerId: customer.id,
          content: "x",
          noteType: "general",
          reservationId: foreign.reservation.id,
        }),
      ).rejects.toMatchObject({ code: "not_found" });
    });

    it("yönetici herhangi bir etkinliğe not ekleyebilir", async () => {
      const customer = await createCustomer(db);
      const foreign = await bookedEvent(other.id, customer.id);
      const adminUser = await createUser(db, { role: "admin" });
      const admin: Actor = { id: adminUser.id, username: adminUser.username, role: "admin", staffId: null, memberships: [], permissions: [] };

      await addNote(db, admin, { customerId: customer.id, content: "ok", noteType: "general", eventId: foreign.event.id });
      expect(await db.select().from(guestNotes)).toHaveLength(1);
    });
  });
});
