import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { guestNotes } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { deleteNote, updateNote } from "@/features/customers/notes-service";
import { adminActor, managerActor, persistActor } from "../../helpers/actors";
import { truncateAll } from "../../helpers/db";
import { createCustomer, createEvent, createReservation, createTable } from "../../helpers/factories";

describe("not güncelleme/silme: not başına erişim (M5)", () => {
  let mine: Actor;
  let other: Actor;
  let admin: Actor;
  let customerId: string;

  beforeEach(async () => {
    await truncateAll();
    mine = await persistActor(db, managerActor("casino"));
    other = await persistActor(db, managerActor("casino"));
    admin = await persistActor(db, adminActor());
    customerId = (await createCustomer(db)).id;
  });

  async function note(values: Partial<typeof guestNotes.$inferInsert>): Promise<string> {
    const [row] = await db
      .insert(guestNotes)
      .values({ customerId, content: "ilk", createdById: mine.id, ...values })
      .returning({ id: guestNotes.id });
    if (!row) throw new Error("not eklenemedi");
    return row.id;
  }

  async function content(id: string): Promise<string | undefined> {
    return (await db.select().from(guestNotes).where(eq(guestNotes.id, id)))[0]?.content;
  }

  it("yazar, başkasının oluşturduğu etkinlikteki kendi notunu değiştirebilir ve silebilir", async () => {
    const event = await createEvent(db, { organizerId: other.id });
    const id = await note({ eventId: event.id });

    await updateNote(db, mine, { id, content: "yeni" });
    expect(await content(id)).toBe("yeni");
    await deleteNote(db, mine, { id });
    expect(await content(id)).toBeUndefined();
  });

  it("rezervasyona bağlı notu da yalnızca yazarı ya da yönetici değiştirir", async () => {
    const event = await createEvent(db, { organizerId: mine.id });
    const table = await createTable(db, event.id);
    const reservation = await createReservation(db, { eventId: event.id, tableId: table.id, customerId });
    const id = await note({ reservationId: reservation.id, createdById: other.id });

    await expect(updateNote(db, mine, { id, content: "x" })).rejects.toMatchObject({ code: "not_found" });
    await updateNote(db, other, { id, content: "yazar" });
    expect(await content(id)).toBe("yazar");
  });

  it("başka bir kullanıcının yazdığı notu (kendi oluşturduğu etkinlikte bile) yalnızca yönetici değiştirir", async () => {
    const event = await createEvent(db, { organizerId: mine.id });
    const id = await note({ eventId: event.id, createdById: admin.id });

    await expect(updateNote(db, mine, { id, content: "x" })).rejects.toMatchObject({ code: "not_found" });
    await updateNote(db, admin, { id, content: "yönetici" });
    expect(await content(id)).toBe("yönetici");
  });

  it("etkinliksiz genel notu yalnızca yazarı ya da yönetici değiştirir", async () => {
    const id = await note({ createdById: mine.id });

    await expect(deleteNote(db, other, { id })).rejects.toMatchObject({ code: "not_found" });
    await updateNote(db, mine, { id, content: "yazar" });
    await deleteNote(db, admin, { id });
    expect(await content(id)).toBeUndefined();
  });

  it("olmayan not not_found verir", async () => {
    await expect(
      updateNote(db, mine, { id: "00000000-0000-4000-8000-000000000000", content: "x" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
