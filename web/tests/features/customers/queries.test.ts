import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { customerTags, guestNotes } from "@/db/schema";
import { ForbiddenError } from "@/features/auth/errors";
import type { PolicyActor } from "@/features/auth/policy";
import { getCustomerDetail, searchCustomers } from "@/features/customers/queries";
import { truncateAll } from "../../helpers/db";
import { createBookingParents, createCustomer, createReservation, createUser } from "../../helpers/factories";

const ADMIN: PolicyActor = { id: "00000000-0000-4000-8000-000000000001", role: "admin", staffId: null };

describe("customers queries", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  describe("yetki", () => {
    it("controller rolü hiçbir sorguyu çalıştıramaz", async () => {
      const controller: PolicyActor = { id: ADMIN.id, role: "controller", staffId: null };

      await expect(searchCustomers(db, controller, {})).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getCustomerDetail(db, controller, ADMIN.id)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("staff görüntüleyebilir; izin satırı customers.view kapatırsa göremez", async () => {
      await createCustomer(db, { fullName: "Gösterilen" });
      const staff: PolicyActor = { id: ADMIN.id, role: "staff", staffId: null };
      expect((await searchCustomers(db, staff, {})).items).toHaveLength(1);

      const restricted: PolicyActor = {
        ...staff,
        permissions: [{ module: "customers", canView: false, canCreate: false, canEdit: false, canDelete: false }],
      };
      await expect(searchCustomers(db, restricted, {})).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe("searchCustomers", () => {
    it("ada göre (büyük/küçük harf ve parça) arar; LIKE özel karakterleri düz metin sayılır", async () => {
      await createCustomer(db, { fullName: "Ahmet Yılmaz" });
      await createCustomer(db, { fullName: "Mehmet Demir" });
      await createCustomer(db, { fullName: "%100 Müşteri" });

      expect((await searchCustomers(db, ADMIN, { q: "yılm" })).items.map((i) => i.fullName)).toEqual([
        "Ahmet Yılmaz",
      ]);
      expect((await searchCustomers(db, ADMIN, { q: "%" })).items.map((i) => i.fullName)).toEqual(["%100 Müşteri"]);
    });

    it("telefonu farklı yazımlarla arar (0532, +90 544, 111 22)", async () => {
      await createCustomer(db, { fullName: "Tel Bir", phone: "0532 111 22 33", phoneNormalized: "+905321112233" });
      await createCustomer(db, { fullName: "Tel İki", phone: "0544 999 88 77", phoneNormalized: "+905449998877" });

      expect((await searchCustomers(db, ADMIN, { q: "0532 111" })).items.map((i) => i.fullName)).toEqual(["Tel Bir"]);
      expect((await searchCustomers(db, ADMIN, { q: "+90 544" })).items.map((i) => i.fullName)).toEqual(["Tel İki"]);
      expect((await searchCustomers(db, ADMIN, { q: "111 22" })).items.map((i) => i.fullName)).toEqual(["Tel Bir"]);
    });

    it("sayfalar: toplam, sayfa sayısı ve sınır doğru; sıra yeniden eskiye", async () => {
      for (let i = 1; i <= 5; i += 1) {
        await createCustomer(db, { fullName: `Müşteri ${i}`, createdAt: new Date(`2026-01-0${i}T10:00:00Z`) });
      }

      const first = await searchCustomers(db, ADMIN, { page: 1, pageSize: 2 });
      const last = await searchCustomers(db, ADMIN, { page: 3, pageSize: 2 });

      expect(first).toMatchObject({ total: 5, page: 1, pageSize: 2, totalPages: 3 });
      expect(first.items.map((i) => i.fullName)).toEqual(["Müşteri 5", "Müşteri 4"]);
      expect(last.items.map((i) => i.fullName)).toEqual(["Müşteri 1"]);
    });

    it("etiketleri, not ve rezervasyon sayısını döndürür", async () => {
      const { event, table, customer } = await createBookingParents(db);
      await createReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
      await db.insert(customerTags).values([
        { customerId: customer.id, tag: "VIP" },
        { customerId: customer.id, tag: "Düzenli" },
      ]);
      await db.insert(guestNotes).values([
        { customerId: customer.id, content: "a" },
        { customerId: customer.id, content: "b" },
      ]);

      const [item] = (await searchCustomers(db, ADMIN, {})).items;

      expect(item?.tags).toEqual(["Düzenli", "VIP"]);
      expect(item?.noteCount).toBe(2);
      expect(item?.reservationCount).toBe(1);
    });
  });

  describe("getCustomerDetail", () => {
    it("müşteri, etiket, not ve rezervasyon geçmişini getirir", async () => {
      const { event, table, customer } = await createBookingParents(db);
      await createReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
      const author = await createUser(db);
      await db.insert(guestNotes).values({ customerId: customer.id, content: "Not", createdById: author.id });
      await db.insert(customerTags).values({ customerId: customer.id, tag: "VIP" });

      const detail = await getCustomerDetail(db, ADMIN, customer.id);

      expect(detail?.customer.id).toBe(customer.id);
      expect(detail?.tags).toEqual(["VIP"]);
      expect(detail?.notes.map((n) => n.content)).toEqual(["Not"]);
      expect(detail?.reservations.map((r) => r.eventName)).toEqual([event.name]);
    });

    it("olmayan id null döner", async () => {
      expect(await getCustomerDetail(db, ADMIN, "00000000-0000-4000-8000-000000000000")).toBeNull();
    });
  });
});
