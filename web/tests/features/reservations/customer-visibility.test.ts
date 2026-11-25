import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import type { Actor } from "@/features/auth/session";
import { getReservationDetail, listReservations } from "@/features/reservations/queries";
import { createReservation } from "@/features/reservations/service";
import { truncateAll } from "../../helpers/db";
import { createCustomer, createReservation as seedReservation } from "../../helpers/factories";
import { actorOf, bookable, expectDomain } from "./fixtures";
import { adminActor, memberActor } from "../../helpers/actors";

async function staffWithoutCustomerView(): Promise<Actor> {
  // customers satırı var ama görüntüleme bayrağı kapalı.
  return actorOf(memberActor("casino", { reservations: "vce-", customers: "----", check_in: "vc--" }));
}

describe("rezervasyon: müşteri verisi customers:view ister", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("customers:view olmayan kullanıcı customerId bağlayamaz; bilinmeyen müşteriyle aynı hata", async () => {
    const staff = await staffWithoutCustomerView();
    const { event, table, customer } = await bookable();
    const base = { eventId: event.id, tableId: table.id, guestCount: 2 };
    await expectDomain(createReservation(db, staff, { ...base, customerId: customer.id }), "not_found", "Müşteri bulunamadı");
    await expectDomain(
      createReservation(db, staff, { ...base, customerId: crypto.randomUUID() }),
      "not_found",
      "Müşteri bulunamadı",
    );
  });

  it("customers:view olan kullanıcı customerId bağlar ve iletişim bilgisi ön dolar", async () => {
    const staff = await actorOf(memberActor("casino", { reservations: "vce-", customers: "v---", check_in: "vc--" }));
    const { event, table, customer } = await bookable();
    const row = await createReservation(db, staff, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: customer.id });
    expect(row.customerId).toBe(customer.id);
    expect(row.guestName).toBe(customer.fullName);
  });

  it("customers:view olmayan kullanıcının yazdığı bilgi korunur; eşleşen müşterinin bilgisi ön dolmaz", async () => {
    const staff = await staffWithoutCustomerView();
    const { event, table } = await bookable();
    await createCustomer(db, {
      fullName: "Gizli Kişi",
      phone: "05321112233",
      phoneNormalized: "+905321112233",
      email: "gizli@example.com",
    });
    const row = await createReservation(db, staff, {
      eventId: event.id,
      tableId: table.id,
      guestCount: 2,
      guestName: "Yazılan Ad",
      guestPhone: "0532 111 22 33",
    });
    expect(row.guestName).toBe("Yazılan Ad");
    expect(row.guestPhone).toBe("0532 111 22 33");
    expect(row.guestEmail).toBeNull();
  });

  it("detay ve liste: customers:view yoksa müşteri bloğu ve müşteri adı dönmez, misafir bilgisi kalır", async () => {
    const staffActor = await staffWithoutCustomerView();
    const staff = staffActor;
    const { event, table, customer } = await bookable();
    const row = await seedReservation(db, {
      eventId: event.id,
      tableId: table.id,
      customerId: customer.id,
      guestName: "Ali Veli",
      guestPhone: "05550000000",
    });

    const detail = await getReservationDetail(db, staff, row.id);
    expect(detail?.customer).toBeNull();
    expect(detail?.reservation.guestName).toBe("Ali Veli");

    const list = await listReservations(db, staff, { eventId: event.id });
    expect(list.items[0]).toMatchObject({ guestName: "Ali Veli", customerName: null });
    // Müşteri adına göre arama, varlığı sızdırmamak için yok sayılır.
    expect((await listReservations(db, staff, { eventId: event.id, q: customer.fullName })).total).toBe(0);

    const admin = await actorOf(adminActor());
    expect((await getReservationDetail(db, admin, row.id))?.customer?.id).toBe(customer.id);
  });
});
