import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import type { Actor } from "@/features/auth/session";
import { reservationActionDefs } from "@/features/reservations/action-defs";
import { bulkCancelReservationsInput } from "@/features/reservations/schemas";
import { cancelReservations } from "@/features/reservations/service";
import { createAction } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import { createCustomer, createReservation as seedReservation } from "../../helpers/factories";
import { actorOf, bookable, createTable, customerRow, expectDomain, reservationRow } from "./fixtures";
import { adminActor, memberActor, legacyActor } from "../../helpers/actors";

function bulkFor(actor: Actor | null) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return defineAction(reservationActionDefs.bulkCancel);
}

/** Aynı etkinlikte iki masa ve iki rezervasyon (biri bekleyen, biri onaylı). */
async function twoReservations() {
  const { event, table, customer } = await bookable();
  const t2 = await createTable(db, event.id, { capacity: 4, label: "A2" });
  const other = await createCustomer(db);
  const a = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id, status: "pending" });
  const b = await seedReservation(db, { eventId: event.id, tableId: t2.id, customerId: other.id, status: "confirmed" });
  return { event, a, b, customer, other };
}

describe("toplu iptal", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("kimlikler tekilleştirilir; boş ve aşırı büyük liste reddedilir", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(bulkCancelReservationsInput.parse({ ids: [id, id] }).ids).toEqual([id]);
    expect(bulkCancelReservationsInput.safeParse({ ids: [] }).success).toBe(false);
    expect(bulkCancelReservationsInput.safeParse({ ids: ["x"] }).success).toBe(false);
  });

  it("hepsini tek işlemde iptal eder ve müşteri sayaçlarını geri alır", async () => {
    const admin = await actorOf(adminActor());
    const { a, b, customer } = await twoReservations();
    expect(await cancelReservations(db, admin, { ids: [a.id, b.id] })).toEqual({ cancelled: 2 });
    expect((await reservationRow(a.id)).status).toBe("cancelled");
    expect((await reservationRow(b.id)).status).toBe("cancelled");
    expect((await customerRow(customer.id)).totalReservations).toBe(0);
  });

  it("biri geçersizse hiçbiri iptal edilmez (atomik)", async () => {
    const admin = await actorOf(adminActor());
    const { event, a } = await twoReservations();
    const t3 = await createTable(db, event.id, { capacity: 4, label: "A3" });
    const c3 = await createCustomer(db);
    const done = await seedReservation(db, { eventId: event.id, tableId: t3.id, customerId: c3.id, status: "checked_in" });
    await expectDomain(cancelReservations(db, admin, { ids: [a.id, done.id] }), "conflict", /geçilemez/);
    expect((await reservationRow(a.id)).status).toBe("pending");
    expect((await reservationRow(done.id)).status).toBe("checked_in");
  });

  it("organizatör başkasının rezervasyonunu iptal edemez; hiçbiri değişmez", async () => {
    const organizer = await legacyActor(db, "organizer");
    const own = await bookable(organizer.id);
    const mine = await seedReservation(db, { eventId: own.event.id, tableId: own.table.id, customerId: own.customer.id });
    const { a } = await twoReservations();
    await expectDomain(cancelReservations(db, organizer, { ids: [mine.id, a.id] }), "not_found", "Rezervasyon bulunamadı");
    expect((await reservationRow(mine.id)).status).toBe("confirmed");
    expect((await reservationRow(a.id)).status).toBe("pending");
  });

  it("action: staff iptal eder; controller forbidden, oturumsuz unauthenticated", async () => {
    const { a, b } = await twoReservations();
    const ids = [a.id, b.id];
    expect(await bulkFor(await actorOf(memberActor("casino", { check_in: "vc--" })))({ ids })).toMatchObject({ ok: false, code: "forbidden" });
    expect(await bulkFor(null)({ ids })).toMatchObject({ ok: false, code: "unauthenticated" });
    expect((await reservationRow(a.id)).status).toBe("pending");
    expect(await bulkFor(await actorOf(memberActor("casino", { reservations: "vce-", customers: "v---", check_in: "vc--" })))({ ids })).toMatchObject({ ok: true, data: { cancelled: 2 } });
    expect((await reservationRow(b.id)).status).toBe("cancelled");
  });

  it("action: geçersiz girdi invalid döner", async () => {
    expect(await bulkFor(await actorOf(adminActor()))({ ids: [] })).toMatchObject({ ok: false, code: "invalid" });
  });
});
