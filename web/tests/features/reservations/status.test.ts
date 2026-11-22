import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { customers, events } from "@/db/schema";
import type { Actor } from "@/features/auth/session";
import {
  cancelReservation,
  changeReservationStatus,
  createReservation,
  markNoShows,
} from "@/features/reservations/service";
import { truncateAll } from "../../helpers/db";
import { createCustomer, createReservation as seedReservation } from "../../helpers/factories";
import { actorOf, bookable, createTable, customerRow, expectDomain, reservationRow, TABLE_TAKEN } from "./fixtures";

describe("rezervasyon durumları", () => {
  let admin: Actor;

  beforeEach(async () => {
    await truncateAll();
    admin = await actorOf("admin");
  });

  it("iptal: durum cancelled, müşteri sayacı geri alınır, masa boşalır", async () => {
    const { event, table, customer } = await bookable();
    const row = await createReservation(db, admin, {
      eventId: event.id,
      tableId: table.id,
      guestCount: 2,
      customerId: customer.id,
    });
    const cancelled = await cancelReservation(db, admin, { id: row.id });
    expect(cancelled.status).toBe("cancelled");
    expect((await customerRow(customer.id)).totalReservations).toBe(0);

    const other = await createCustomer(db);
    const next = await createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: other.id });
    expect(next.status).toBe("confirmed");
  });

  it("iptal edilmiş rezervasyon yeniden iptal edilemez, sayaç negatife inmez", async () => {
    const { event, table, customer } = await bookable();
    const row = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id, status: "cancelled" });
    await expectDomain(cancelReservation(db, admin, { id: row.id }), "conflict", /geçilemez/);
    expect((await customerRow(customer.id)).totalReservations).toBe(0);
  });

  it("bekleyen → onaylı geçişi yapılır", async () => {
    const { event, table, customer } = await bookable();
    const row = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id, status: "pending" });
    expect((await changeReservationStatus(db, admin, { id: row.id, status: "confirmed" })).status).toBe("confirmed");
  });

  it("geçersiz geçişler conflict (ör. check-in yapılmış → iptal), durum değişmez", async () => {
    const { event, table, customer } = await bookable();
    const row = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id, status: "checked_in" });
    await expectDomain(changeReservationStatus(db, admin, { id: row.id, status: "cancelled" }), "conflict", /geçilemez/);
    expect((await reservationRow(row.id)).status).toBe("checked_in");
  });

  it("check-in ve gelmedi bu yoldan verilemez", async () => {
    const { event, table, customer } = await bookable();
    const row = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
    await expectDomain(changeReservationStatus(db, admin, { id: row.id, status: "checked_in" }), "conflict", /giriş/);
    await expectDomain(changeReservationStatus(db, admin, { id: row.id, status: "no_show" }), "conflict", /toplu/);
    expect((await reservationRow(row.id)).status).toBe("confirmed");
  });

  it("olmayan ve başkasının etkinliğindeki rezervasyon not_found", async () => {
    await expectDomain(
      cancelReservation(db, admin, { id: "00000000-0000-4000-8000-000000000000" }),
      "not_found",
      "Rezervasyon bulunamadı",
    );
    const organizer = await actorOf("organizer");
    const { event, table, customer } = await bookable();
    const row = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
    await expectDomain(cancelReservation(db, organizer, { id: row.id }), "not_found", "Rezervasyon bulunamadı");
    expect((await reservationRow(row.id)).status).toBe("confirmed");
  });

  it("tamamlanmış etkinlikte iptal yapılamaz", async () => {
    const { event, table, customer } = await bookable();
    const row = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
    await db.update(events).set({ status: "completed" }).where(eq(events.id, event.id));
    await expectDomain(cancelReservation(db, admin, { id: row.id }), "conflict", /tamamlanmış/);
  });

  describe("iptal → onaylı (spec §13 madde 6)", () => {
    it("masa boşsa yeniden onaylanır ve sayaç geri gelir", async () => {
      const { event, table, customer } = await bookable();
      const row = await createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: customer.id });
      await cancelReservation(db, admin, { id: row.id });
      const again = await changeReservationStatus(db, admin, { id: row.id, status: "confirmed" });
      expect(again.status).toBe("confirmed");
      expect((await customerRow(customer.id)).totalReservations).toBe(1);
    });

    it("masa başkasınca alındıysa aynı mesajla conflict; iptal olarak kalır", async () => {
      const { event, table, customer } = await bookable();
      const row = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id, status: "cancelled" });
      const other = await createCustomer(db);
      await createReservation(db, admin, { eventId: event.id, tableId: table.id, guestCount: 2, customerId: other.id });

      await expectDomain(changeReservationStatus(db, admin, { id: row.id, status: "confirmed" }), "conflict", TABLE_TAKEN);
      expect((await reservationRow(row.id)).status).toBe("cancelled");
      expect((await customerRow(customer.id)).totalReservations).toBe(0);
    });

    it("masa kapasitesi sonradan küçüldüyse conflict", async () => {
      const { event, customer } = await bookable();
      const small = await createTable(db, event.id, { capacity: 2 });
      const row = await seedReservation(db, {
        eventId: event.id,
        tableId: small.id,
        customerId: customer.id,
        status: "cancelled",
        guestCount: 3,
      });
      await expectDomain(changeReservationStatus(db, admin, { id: row.id, status: "confirmed" }), "conflict", /kapasitesini/);
    });

    it("etkinlik rezervasyona kapalıysa ya da müşteri kara listedeyse conflict", async () => {
      const { event, table, customer } = await bookable();
      const row = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id, status: "cancelled" });
      await db.update(customers).set({ isBlacklisted: true }).where(eq(customers.id, customer.id));
      await expectDomain(changeReservationStatus(db, admin, { id: row.id, status: "confirmed" }), "conflict", /kara listede/);
      const ok = await changeReservationStatus(db, admin, { id: row.id, status: "confirmed", overrideBlacklist: true });
      expect(ok.status).toBe("confirmed");

      await cancelReservation(db, admin, { id: row.id });
      await db.update(events).set({ reservationEnabled: false }).where(eq(events.id, event.id));
      await expectDomain(
        changeReservationStatus(db, admin, { id: row.id, status: "confirmed", overrideBlacklist: true }),
        "conflict",
        /rezervasyona kapalı/,
      );
    });
  });
});

describe("markNoShows (spec §13 madde 9)", () => {
  let admin: Actor;

  beforeEach(async () => {
    await truncateAll();
    admin = await actorOf("admin");
  });

  async function scenario() {
    const { event, table, customer } = await bookable();
    const other = await createCustomer(db, { noShowCount: 3 });
    const tables = await Promise.all(Array.from({ length: 4 }, () => createTable(db, event.id)));
    const t = (i: number) => {
      const found = tables[i];
      if (!found) throw new Error("masa yok");
      return found.id;
    };
    const rows = {
      pending: await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id, status: "pending" }),
      confirmed: await seedReservation(db, { eventId: event.id, tableId: t(0), customerId: customer.id, status: "confirmed" }),
      otherConfirmed: await seedReservation(db, { eventId: event.id, tableId: t(1), customerId: other.id, status: "confirmed" }),
      checkedIn: await seedReservation(db, { eventId: event.id, tableId: t(2), customerId: other.id, status: "checked_in" }),
      cancelled: await seedReservation(db, { eventId: event.id, tableId: t(3), customerId: other.id, status: "cancelled" }),
    };
    return { event, customer, other, rows };
  }

  it.each(["draft", "published", "active", "cancelled"] as const)("%s etkinlikte çalışmaz, hiçbir şey değişmez", async (status) => {
    const { event, customer, rows } = await scenario();
    await db.update(events).set({ status }).where(eq(events.id, event.id));
    await expectDomain(markNoShows(db, admin, { eventId: event.id }), "conflict", /tamamlanmış/);
    expect((await reservationRow(rows.pending.id)).status).toBe("pending");
    expect((await customerRow(customer.id)).noShowCount).toBe(0);
  });

  it("tamamlanmış etkinlikte bekleyen/onaylıları gelmedi yapar ve müşteri sayaçlarını artırır", async () => {
    const { event, customer, other, rows } = await scenario();
    await db.update(events).set({ status: "completed" }).where(eq(events.id, event.id));

    expect(await markNoShows(db, admin, { eventId: event.id })).toEqual({ updated: 3 });
    expect((await reservationRow(rows.pending.id)).status).toBe("no_show");
    expect((await reservationRow(rows.confirmed.id)).status).toBe("no_show");
    expect((await reservationRow(rows.otherConfirmed.id)).status).toBe("no_show");
    expect((await reservationRow(rows.checkedIn.id)).status).toBe("checked_in");
    expect((await reservationRow(rows.cancelled.id)).status).toBe("cancelled");
    expect((await customerRow(customer.id)).noShowCount).toBe(2);
    expect((await customerRow(other.id)).noShowCount).toBe(4);
  });

  it("iki kez (ve eşzamanlı) çalıştırmak sonucu değiştirmez", async () => {
    const { event, customer, other } = await scenario();
    await db.update(events).set({ status: "completed" }).where(eq(events.id, event.id));

    const results = await Promise.all([
      markNoShows(db, admin, { eventId: event.id }),
      markNoShows(db, admin, { eventId: event.id }),
    ]);
    expect(results.map((r) => r.updated).sort()).toEqual([0, 3]);
    expect(await markNoShows(db, admin, { eventId: event.id })).toEqual({ updated: 0 });
    expect((await customerRow(customer.id)).noShowCount).toBe(2);
    expect((await customerRow(other.id)).noShowCount).toBe(4);
  });

  it("organizatör başkasının etkinliğinde not_found", async () => {
    const organizer = await actorOf("organizer");
    const { event } = await scenario();
    await db.update(events).set({ status: "completed" }).where(eq(events.id, event.id));
    await expectDomain(markNoShows(db, organizer, { eventId: event.id }), "not_found");
  });
});
