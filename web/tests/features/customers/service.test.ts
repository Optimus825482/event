import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { customers, customerTags, guestNotes } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { addNote, addTag, deleteNote, removeTag, updateNote } from "@/features/customers/notes-service";
import { createCustomerInput, updateCustomerInput } from "@/features/customers/schemas";
import { createCustomer, deleteCustomer, setBlacklist, updateCustomer } from "@/features/customers/service";
import { truncateAll } from "../../helpers/db";
import {
  createBookingParents,
  createCustomer as seedCustomer,
  createReservation,
  createUser,
} from "../../helpers/factories";

const MISSING_ID = "00000000-0000-4000-8000-000000000000";

async function adminActor(): Promise<Actor> {
  const u = await createUser(db, { role: "admin" });
  return { id: u.id, username: u.username, role: "admin", staffId: null };
}

describe("customers service", () => {
  let actor: Actor;

  beforeEach(async () => {
    await truncateAll();
    actor = await adminActor();
  });

  describe("createCustomer", () => {
    it("normalize alanlarını ve etiketleri yazar", async () => {
      const input = createCustomerInput.parse({
        fullName: "  Ayşe Kaya ",
        phone: "0532 111 22 33",
        email: "Ayse@Test.com",
        tags: ["VIP", " VIP ", "Düzenli"],
        notes: "Pencere kenarı",
      });

      const { id } = await createCustomer(db, actor, input);

      const [row] = await db.select().from(customers).where(eq(customers.id, id));
      expect(row).toMatchObject({
        fullName: "Ayşe Kaya",
        phoneNormalized: "+905321112233",
        emailNormalized: "ayse@test.com",
        notes: "Pencere kenarı",
        isBlacklisted: false,
      });
      const tags = await db.select().from(customerTags).where(eq(customerTags.customerId, id));
      expect(tags.map((t) => t.tag).sort()).toEqual(["Düzenli", "VIP"]);
    });

    it("aynı telefon (farklı yazım) conflict DomainError verir", async () => {
      await createCustomer(db, actor, createCustomerInput.parse({ fullName: "Birinci", phone: "05321112233" }));

      await expect(
        createCustomer(db, actor, createCustomerInput.parse({ fullName: "İkinci", phone: "+90 532 111 22 33" })),
      ).rejects.toMatchObject({
        name: "DomainError",
        code: "conflict",
        message: "Bu telefon numarası başka bir müşteriye ait",
      });
    });

    it("aynı e-posta conflict verir", async () => {
      await createCustomer(db, actor, createCustomerInput.parse({ fullName: "Birinci", email: "a@test.com" }));

      await expect(
        createCustomer(db, actor, createCustomerInput.parse({ fullName: "İkinci", email: "A@TEST.com" })),
      ).rejects.toMatchObject({ code: "conflict", message: "Bu e-posta adresi başka bir müşteriye ait" });
    });

    it("şema geçersiz telefon, kısa isim ve geçersiz e-postayı reddeder; boş string yok sayılır", () => {
      const bad = createCustomerInput.safeParse({ fullName: "A", phone: "123", email: "x" });
      expect(bad.success).toBe(false);
      const ok = createCustomerInput.safeParse({ fullName: "Ali Veli", phone: "", email: " ", notes: "" });
      expect(ok.success).toBe(true);
    });
  });

  describe("updateCustomer", () => {
    it("alanları günceller, telefon null ile temizlenir", async () => {
      const { id } = await createCustomer(
        db,
        actor,
        createCustomerInput.parse({ fullName: "Eski Ad", phone: "05321112233" }),
      );

      await updateCustomer(
        db,
        actor,
        updateCustomerInput.parse({ id, fullName: "Yeni Ad", vipScore: 80, phone: null }),
      );

      const [row] = await db.select().from(customers).where(eq(customers.id, id));
      expect(row).toMatchObject({ fullName: "Yeni Ad", vipScore: 80, phone: null, phoneNormalized: null });
    });

    it("başka müşterinin telefonunu almak conflict verir", async () => {
      await createCustomer(db, actor, createCustomerInput.parse({ fullName: "Aa", phone: "05321112233" }));
      const b = await createCustomer(db, actor, createCustomerInput.parse({ fullName: "Bb", phone: "05449998877" }));

      await expect(
        updateCustomer(db, actor, updateCustomerInput.parse({ id: b.id, phone: "0532 111 22 33" })),
      ).rejects.toMatchObject({ code: "conflict" });
    });

    it("olmayan müşteri not_found verir; vipScore aralığı şemada denetlenir", async () => {
      await expect(
        updateCustomer(db, actor, updateCustomerInput.parse({ id: MISSING_ID, fullName: "Xx" })),
      ).rejects.toMatchObject({ code: "not_found" });
      expect(updateCustomerInput.safeParse({ id: MISSING_ID, vipScore: 101 }).success).toBe(false);
    });
  });

  it("setBlacklist açık değeri yazar (toggle değil)", async () => {
    const c = await seedCustomer(db);

    await setBlacklist(db, actor, { id: c.id, isBlacklisted: true });
    await setBlacklist(db, actor, { id: c.id, isBlacklisted: true });
    expect((await db.select().from(customers).where(eq(customers.id, c.id)))[0]?.isBlacklisted).toBe(true);

    await setBlacklist(db, actor, { id: c.id, isBlacklisted: false });
    expect((await db.select().from(customers).where(eq(customers.id, c.id)))[0]?.isBlacklisted).toBe(false);
    await expect(setBlacklist(db, actor, { id: MISSING_ID, isBlacklisted: true })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  describe("etiketler", () => {
    it("addTag tekrarda sessizce geçer, removeTag siler", async () => {
      const c = await seedCustomer(db);

      await addTag(db, actor, { customerId: c.id, tag: " VIP " });
      await addTag(db, actor, { customerId: c.id, tag: "VIP" });
      expect(await db.select().from(customerTags).where(eq(customerTags.customerId, c.id))).toHaveLength(1);

      await removeTag(db, actor, { customerId: c.id, tag: "VIP" });
      expect(await db.select().from(customerTags).where(eq(customerTags.customerId, c.id))).toHaveLength(0);
    });

    it("olmayan müşteriye etiket not_found verir", async () => {
      await expect(addTag(db, actor, { customerId: MISSING_ID, tag: "VIP" })).rejects.toMatchObject({
        code: "not_found",
      });
    });
  });

  describe("notlar", () => {
    it("ekler, günceller, siler; oluşturanı kaydeder", async () => {
      const c = await seedCustomer(db);

      const { id } = await addNote(db, actor, { customerId: c.id, content: "İlk not", noteType: "pre_event" });
      const [row] = await db.select().from(guestNotes).where(eq(guestNotes.id, id));
      expect(row).toMatchObject({ content: "İlk not", noteType: "pre_event", createdById: actor.id, customerId: c.id });

      await updateNote(db, actor, { id, content: "Düzenlendi" });
      expect((await db.select().from(guestNotes).where(eq(guestNotes.id, id)))[0]?.content).toBe("Düzenlendi");

      await deleteNote(db, actor, { id });
      expect(await db.select().from(guestNotes)).toHaveLength(0);
      await expect(deleteNote(db, actor, { id })).rejects.toMatchObject({ code: "not_found" });
    });

    it("olmayan müşteriye not not_found verir", async () => {
      await expect(
        addNote(db, actor, { customerId: MISSING_ID, content: "x", noteType: "general" }),
      ).rejects.toMatchObject({ code: "not_found" });
    });
  });

  describe("deleteCustomer", () => {
    it("rezervasyonu olmayan müşteriyi siler; notları ve etiketleri birlikte gider", async () => {
      const c = await seedCustomer(db);
      await addTag(db, actor, { customerId: c.id, tag: "VIP" });
      await addNote(db, actor, { customerId: c.id, content: "n", noteType: "general" });

      await deleteCustomer(db, actor, { id: c.id });

      expect(await db.select().from(customers)).toHaveLength(0);
      expect(await db.select().from(guestNotes)).toHaveLength(0);
    });

    it("rezervasyonu olan müşteri silinemez (conflict) ve olduğu gibi kalır", async () => {
      const { event, table, customer } = await createBookingParents(db);
      await createReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });

      await expect(deleteCustomer(db, actor, { id: customer.id })).rejects.toMatchObject({ code: "conflict" });
      expect(await db.select().from(customers)).toHaveLength(1);
    });
  });
});
