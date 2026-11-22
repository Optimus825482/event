import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { guestNotes } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { deleteNote, updateNote } from "@/features/customers/notes-service";
import { truncateAll } from "../../helpers/db";
import { createCustomer, createEvent, createReservation, createTable, createUser } from "../../helpers/factories";

async function actorOf(role: "admin" | "organizer"): Promise<Actor> {
  const u = await createUser(db, { role });
  return { id: u.id, username: u.username, role, staffId: null };
}

describe("not güncelleme/silme: not başına erişim (M5)", () => {
  let mine: Actor;
  let other: Actor;
  let admin: Actor;
  let customerId: string;

  beforeEach(async () => {
    await truncateAll();
    mine = await actorOf("organizer");
    other = await actorOf("organizer");
    admin = await actorOf("admin");
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

  it("organizatör başkasının etkinliğindeki notu değiştiremez ya da silemez (not_found)", async () => {
    const event = await createEvent(db, { organizerId: other.id });
    const id = await note({ eventId: event.id, createdById: mine.id });

    await expect(updateNote(db, mine, { id, content: "x" })).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteNote(db, mine, { id })).rejects.toMatchObject({ code: "not_found" });
    expect(await content(id)).toBe("ilk");
  });

  it("rezervasyona bağlı notta erişim rezervasyonun etkinliğinden çözülür", async () => {
    const event = await createEvent(db, { organizerId: other.id });
    const table = await createTable(db, event.id);
    const reservation = await createReservation(db, { eventId: event.id, tableId: table.id, customerId });
    const id = await note({ reservationId: reservation.id, createdById: mine.id });

    await expect(updateNote(db, mine, { id, content: "x" })).rejects.toMatchObject({ code: "not_found" });
  });

  it("organizatör kendi etkinliğindeki kendi notunu değiştirebilir ve silebilir", async () => {
    const event = await createEvent(db, { organizerId: mine.id });
    const id = await note({ eventId: event.id });

    await updateNote(db, mine, { id, content: "yeni" });
    expect(await content(id)).toBe("yeni");
    await deleteNote(db, mine, { id });
    expect(await content(id)).toBeUndefined();
  });

  it("başka bir kullanıcının yazdığı notu (kendi etkinliğinde bile) yalnızca yönetici değiştirir", async () => {
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
