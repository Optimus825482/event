import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { reservations } from "@/db/schema";
import { withPermissions } from "@/features/auth/permissions";
import { ForbiddenError } from "@/features/auth/errors";
import type { Actor } from "@/features/auth/session";
import { reservationActionDefs } from "@/features/reservations/action-defs";
import { getReservationDetail, listReservations } from "@/features/reservations/queries";
import { createAction } from "@/lib/action";
import { truncateAll } from "../../helpers/db";
import { createCustomer, createReservation as seedReservation } from "../../helpers/factories";
import { actorOf, bookable, createTable, rejection, TABLE_TAKEN } from "./fixtures";
import { adminActor, memberActor, legacyActor } from "../../helpers/actors";

function actionsFor(actor: Actor | null) {
  const { defineAction } = createAction({ getActor: async () => actor });
  return {
    create: defineAction(reservationActionDefs.create),
    update: defineAction(reservationActionDefs.update),
    cancel: defineAction(reservationActionDefs.cancel),
    markNoShows: defineAction(reservationActionDefs.markNoShows),
  };
}

describe("rezervasyon action'ları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("staff form verisiyle oluşturur; dolu masada Türkçe conflict döner", async () => {
    const staff = await actorOf(memberActor("casino", { reservations: "vce-", customers: "v---", check_in: "vc--" }));
    const { event, table } = await bookable();
    const form = { eventId: event.id, tableId: table.id, guestCount: "2", guestName: "Ali Veli", guestPhone: "05321234567" };
    const first = await actionsFor(staff).create(form);
    expect(first).toMatchObject({ ok: true, data: { eventId: event.id } });
    const second = await actionsFor(staff).create({ ...form, guestPhone: "05327654321" });
    expect(second).toEqual({ ok: false, code: "conflict", message: TABLE_TAKEN });
  });

  it("geçersiz girdi alan hatalarıyla invalid döner", async () => {
    const admin = await actorOf(adminActor());
    const { event, table } = await bookable();
    const res = await actionsFor(admin).create({ eventId: event.id, tableId: table.id, guestCount: "0" });
    expect(res).toMatchObject({ ok: false, code: "invalid" });
    if (res.ok) return;
    expect(res.fieldErrors?.guestCount).toBeDefined();
    expect(res.fieldErrors?.guestName).toBeDefined();
  });

  it("controller oluşturamaz (forbidden), oturumsuz unauthenticated; satır yazılmaz", async () => {
    const controller = await actorOf(memberActor("casino", { check_in: "vc--" }));
    const { event, table, customer } = await bookable();
    const input = { eventId: event.id, tableId: table.id, guestCount: 2, customerId: customer.id };
    expect(await actionsFor(controller).create(input)).toMatchObject({ ok: false, code: "forbidden" });
    expect(await actionsFor(null).create(input)).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(await db.select().from(reservations)).toHaveLength(0);
  });

  it("iptal ve masa değişikliği action üzerinden çalışır", async () => {
    const staff = await actorOf(memberActor("casino", { reservations: "vce-", customers: "v---", check_in: "vc--" }));
    const { event, table, customer } = await bookable();
    const row = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
    const t2 = await createTable(db, event.id, { capacity: 4 });
    expect(await actionsFor(staff).update({ id: row.id, tableId: t2.id, guestCount: "3" })).toMatchObject({
      ok: true,
      data: { tableId: t2.id, guestCount: 3 },
    });
    expect(await actionsFor(staff).cancel({ id: row.id })).toMatchObject({ ok: true, data: { status: "cancelled" } });
  });
});

describe("rezervasyon sorguları", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("controller listeleyemez; izin satırı canView=false olan staff listeleyemez", async () => {
    const { event } = await bookable();
    const controller = await withPermissions(await actorOf(memberActor("casino", { check_in: "vc--" })));
    const error = await rejection(listReservations(db, controller, { eventId: event.id }));
    expect(error).toBeInstanceOf(ForbiddenError);

    const staff = await actorOf(memberActor("casino", { reservations: "----", customers: "v---", check_in: "vc--" }));
    expect(await rejection(listReservations(db, staff, { eventId: event.id }))).toBeInstanceOf(ForbiddenError);
  });

  it("arama (ad, telefon, masa), durum süzgeci, masa etiketi event_tables'tan, durum sayıları", async () => {
    const admin = await withPermissions(await actorOf(adminActor()));
    const { event, table, customer } = await bookable();
    const t2 = await createTable(db, event.id, { label: "VIP-1" });
    const other = await createCustomer(db, { fullName: "Zeynep Kaya", phoneNormalized: "+905551112233" });
    await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id, guestName: "Ali Veli" });
    await seedReservation(db, {
      eventId: event.id,
      tableId: t2.id,
      customerId: other.id,
      status: "cancelled",
      guestPhone: "0555 111 22 33",
    });

    const all = await listReservations(db, admin, { eventId: event.id });
    expect(all.total).toBe(2);
    expect(all.statusCounts).toMatchObject({ confirmed: 1, cancelled: 1, pending: 0 });
    expect(all.items.map((i) => i.tableLabel).sort()).toEqual(["A1", "VIP-1"]);

    expect((await listReservations(db, admin, { eventId: event.id, q: "ali" })).items.map((i) => i.guestName)).toEqual([
      "Ali Veli",
    ]);
    expect((await listReservations(db, admin, { eventId: event.id, q: "zeynep" })).total).toBe(1);
    expect((await listReservations(db, admin, { eventId: event.id, q: "0555 111" })).total).toBe(1);
    expect((await listReservations(db, admin, { eventId: event.id, q: "vip" })).total).toBe(1);
    expect((await listReservations(db, admin, { eventId: event.id, q: "%" })).total).toBe(0);
    expect((await listReservations(db, admin, { eventId: event.id, status: "cancelled" })).total).toBe(1);
  });

  it("organizatör başkasının etkinliğini not_found görür; detay null", async () => {
    const organizer = await withPermissions(await legacyActor(db, "organizer"));
    const { event, table, customer } = await bookable();
    const row = await seedReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
    const error = await rejection(listReservations(db, organizer, { eventId: event.id }));
    expect(error).toMatchObject({ code: "not_found" });
    expect(await getReservationDetail(db, organizer, row.id)).toBeNull();

    const admin = await withPermissions(await actorOf(adminActor()));
    const detail = await getReservationDetail(db, admin, row.id);
    expect(detail).toMatchObject({ tableLabel: "A1", customer: { id: customer.id } });
    expect(await getReservationDetail(db, admin, "not-a-uuid")).toBeNull();
    await db.delete(reservations).where(eq(reservations.id, row.id));
    expect(await getReservationDetail(db, admin, row.id)).toBeNull();
  });
});
