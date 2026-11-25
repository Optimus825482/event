import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { customers, eventTables, events, reservations } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import { signQrToken, verifyQrToken } from "@/features/reservations/qr-token";
import { createReservationInput } from "@/features/reservations/schemas";
import { createReservation } from "@/features/reservations/service";
import { truncateAll } from "../../helpers/db";
import { createCustomer, createEvent, pgErrorCode } from "../../helpers/factories";
import { actorOf, bookable, createTable, customerRow, expectDomain, rejection, reservationRow, TABLE_TAKEN } from "./fixtures";
import { adminActor, managerActor, memberActor } from "../../helpers/actors";

describe("createReservation", () => {
  let admin: Actor;

  beforeEach(async () => {
    await truncateAll();
    admin = await actorOf(adminActor());
  });

  it("onaylı rezervasyon yazar, imzalı QR belirtecini aynı satırda saklar, müşteri sayacını artırır", async () => {
    const { event, table, customer } = await bookable();
    const row = await createReservation(db, admin, {
      eventId: event.id,
      tableId: table.id,
      guestCount: 3,
      customerId: customer.id,
      specialRequests: "Doğum günü",
    });

    expect(row.status).toBe("confirmed");
    expect(row.qrToken).toBe(signQrToken(row.id));
    expect(verifyQrToken(row.qrToken)).toEqual({ reservationId: row.id });
    expect(row.guestName).toBe(customer.fullName);
    expect((await reservationRow(row.id)).specialRequests).toBe("Doğum günü");
    expect((await customerRow(customer.id)).totalReservations).toBe(1);
  });

  it("müşteri kimliği yoksa telefona göre bulur ya da oluşturur ve misafir bilgisini saklar", async () => {
    const { event, table } = await bookable();
    const existing = await createCustomer(db, { fullName: "Ayşe", phone: "05321112233", phoneNormalized: "+905321112233" });
    const row = await createReservation(db, admin, {
      eventId: event.id,
      tableId: table.id,
      guestCount: 2,
      guestName: "Ayşe Yılmaz",
      guestPhone: "0532 111 22 33",
    });
    expect(row.customerId).toBe(existing.id);
    expect(row.guestName).toBe("Ayşe Yılmaz");
    expect(row.guestPhone).toBe("0532 111 22 33");

    const second = await createTable(db, event.id, { capacity: 4 });
    const fresh = await createReservation(db, admin, {
      eventId: event.id,
      tableId: second.id,
      guestCount: 2,
      guestName: "Yeni Kişi",
      guestEmail: "Yeni@Test.com",
    });
    const [created] = await db.select().from(customers).where(eq(customers.id, fresh.customerId));
    expect(created?.emailNormalized).toBe("yeni@test.com");
    expect(created?.totalReservations).toBe(1);
  });

  it("dolu masaya ikinci rezervasyon Türkçe mesajla conflict, satır eklenmez", async () => {
    const { event, table, customer } = await bookable();
    await createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: customer.id });
    const other = await createCustomer(db);
    await expectDomain(
      createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: other.id }),
      "conflict",
      TABLE_TAKEN,
    );
    expect(await db.select().from(reservations)).toHaveLength(1);
    expect((await customerRow(other.id)).totalReservations).toBe(0);
  });

  describe("kapasite (spec §13 madde 4)", () => {
    it("kişi sayısı kapasiteye eşitse kabul, aşarsa conflict", async () => {
      const { event, table, customer } = await bookable();
      await expectDomain(
        createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 5, customerId: customer.id }),
        "conflict",
        "Kişi sayısı (5) masa kapasitesini (4) aşıyor",
      );
      expect(await db.select().from(reservations)).toHaveLength(0);
      const ok = await createReservation(db, admin, {
        eventId: event.id,
        tableId: table.id,
        guestCount: 4,
        customerId: customer.id,
      });
      expect(ok.guestCount).toBe(4);
    });

    it("kapasite masa satırının güncel değerinden okunur", async () => {
      const { event, table, customer } = await bookable();
      await db.update(eventTables).set({ capacity: 2 }).where(eq(eventTables.id, table.id));
      await expectDomain(
        createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 3, customerId: customer.id }),
        "conflict",
        /kapasitesini \(2\)/,
      );
    });

    it("kişi sayısı en az 1: şema reddeder, şema atlanırsa veritabanı kısıtı reddeder", async () => {
      const { event, table, customer } = await bookable();
      const parsed = createReservationInput.safeParse({
        eventId: event.id,
        tableId: table.id,
        guestCount: 0,
        customerId: customer.id,
      });
      expect(parsed.success).toBe(false);
      await expectDomain(
        createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 0, customerId: customer.id }),
        "conflict",
      );
      expect(await db.select().from(reservations)).toHaveLength(0);
    });

    it("kapasitesiz (0) masa oluşturulamaz", async () => {
      const event = await createEvent(db, { status: "published" });
      const error = await rejection(createTable(db, event.id, { capacity: 0 }));
      expect(pgErrorCode(error)).toBe("23514");
    });
  });

  describe("etkinlik kuralları", () => {
    it.each(["draft", "completed", "cancelled"] as const)("%s etkinliğe rezervasyon yapılamaz", async (status) => {
      const { event, table, customer } = await bookable();
      await db.update(events).set({ status }).where(eq(events.id, event.id));
      await expectDomain(
        createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: customer.id }),
        "conflict",
        /rezervasyona açık değil/,
      );
    });

    it.each(["published", "active"] as const)("%s etkinliğe rezervasyon yapılabilir", async (status) => {
      const { event, table, customer } = await bookable();
      await db.update(events).set({ status }).where(eq(events.id, event.id));
      const row = await createReservation(db, admin, {
        eventId: event.id,
        tableId: table.id,
        guestCount: 2,
        customerId: customer.id,
      });
      expect(row.status).toBe("confirmed");
    });

    it("rezervasyonu kapalı etkinlik conflict", async () => {
      const { event, table, customer } = await bookable();
      await db.update(events).set({ reservationEnabled: false }).where(eq(events.id, event.id));
      await expectDomain(
        createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: customer.id }),
        "conflict",
        /rezervasyona kapalı/,
      );
    });

    it("başka etkinliğin masası not_found", async () => {
      const { event, customer } = await bookable();
      const other = await bookable();
      await expectDomain(
        createReservation(db, admin, {
          eventId: event.id,
          tableId: other.table.id,
          guestCount: 2,
          customerId: customer.id,
        }),
        "not_found",
        "Masa bu etkinlikte bulunamadı",
      );
    });

    it("Casino yöneticisi başkasının oluşturduğu etkinlikte rezervasyon yapar", async () => {
      const manager = await actorOf(managerActor("casino"));
      const foreign = await bookable();
      const row = await createReservation(db, manager, {
        eventId: foreign.event.id,
        tableId: foreign.table.id,
        guestCount: 2,
        customerId: foreign.customer.id,
      });
      expect(row.eventId).toBe(foreign.event.id);
    });
  });

  describe("kara liste", () => {
    it("kara listedeki müşteri conflict; yönetici overrideBlacklist ile aşar", async () => {
      const { event, table } = await bookable();
      const banned = await createCustomer(db, { isBlacklisted: true });
      const input = { eventId: event.id, tableId: table.id, guestCount: 2, customerId: banned.id };
      await expectDomain(createReservation(db, admin, input), "conflict", /kara listede/);
      const row = await createReservation(db, admin, { ...input, overrideBlacklist: true });
      expect(row.customerId).toBe(banned.id);
    });

    it.each(["Casino yöneticisi", "Casino kullanıcısı"] as const)("%s overrideBlacklist ile aşamaz", async (who) => {
      const actor = await actorOf(who === "Casino yöneticisi" ? managerActor("casino") : memberActor("casino", { reservations: "vce-", customers: "v---", check_in: "vc--" }));
      const { event, table } = await bookable();
      const banned = await createCustomer(db, { isBlacklisted: true });
      await expectDomain(
        createReservation(db, actor, {
          eventId: event.id,
          tableId: table.id,
          guestCount: 2,
          customerId: banned.id,
          overrideBlacklist: true,
        }),
        "conflict",
        /kara listede/,
      );
      expect(await db.select().from(reservations)).toHaveLength(0);
    });
  });

  it("şema: müşteri ya da misafir adı zorunlu, boş metinler yok sayılır", () => {
    const base = { eventId: crypto.randomUUID(), tableId: crypto.randomUUID(), guestCount: "2" };
    const missing = createReservationInput.safeParse({ ...base, guestName: " ", guestPhone: "" });
    expect(missing.success).toBe(false);
    const ok = createReservationInput.parse({ ...base, guestName: " Ali Veli ", guestPhone: "", overrideBlacklist: "on" });
    expect(ok).toMatchObject({ guestName: "Ali Veli", guestCount: 2, overrideBlacklist: true });
    expect(ok.guestPhone).toBeUndefined();
    expect(createReservationInput.safeParse({ ...base, guestName: "Ali", guestPhone: "123" }).success).toBe(false);
    expect(createReservationInput.safeParse({ ...base, guestName: "Ali", guestCount: 51 }).success).toBe(false);
  });
});
