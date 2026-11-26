import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { events, reservations, tableGroupTables, tickets } from "@/db/schema";
import { getPublicTableView } from "@/features/find-table/public";
import { signFindTableToken } from "@/features/find-table/token";
import { formatEventWhen } from "@/features/invitations/public";
import { createCustomer, createReservation, createTable, createTableGroup } from "../../helpers/factories";
import { truncateAll } from "../../helpers/db";
import { ticketedEvent } from "../../helpers/door";
import { bookedGuest, reservationRow, setReservationStatus } from "../check-in/fixtures";

const ID = "11111111-1111-4111-8111-111111111111";

describe("herkese açık masa görünümü", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("sipariş: yalnızca etkinlik adı, tarih, masalar ve plan", async () => {
    const te = await ticketedEvent();
    const view = await getPublicTableView(db, signFindTableToken("order", te.order.orderId));
    expect(Object.keys(view!).sort()).toEqual(["eventDate", "eventName", "plan", "tables"]);
    expect(view!.eventName).toBe(te.event.name);
    expect(view!.eventDate).toBe(formatEventWhen(te.event.startsAt).date);
    expect(view!.tables.map((t) => [t.label, t.seats])).toEqual([
      ["B1", 2],
      ["B2", 1],
    ]);
    expect(Object.keys(view!.tables[0]!).sort()).toEqual(["id", "label", "seats"]);
    for (const t of view!.plan.tables) {
      expect(Object.keys(t).sort()).toEqual(["capacity", "color", "id", "isLoca", "label", "rotation", "shape", "x", "y"]);
    }
  });

  it("yanıtın JSON'unda kişisel veri, PNR, grup, tahsis ve başka masaların rezervasyon bilgisi yok", async () => {
    const te = await ticketedEvent();
    const group = await createTableGroup(db, te.event.id, { name: "Ekip Kırmızı" });
    await db.insert(tableGroupTables).values({ eventId: te.event.id, tableGroupId: group.id, tableId: te.tables[0]!.id });
    const casino = await createTable(db, te.event.id, { label: "C1" });
    const customer = await createCustomer(db, { fullName: "Zeynep Kaya" });
    const other = await createReservation(db, {
      eventId: te.event.id,
      tableId: casino.id,
      customerId: customer.id,
      guestName: "Zeynep Kaya",
      guestPhone: "05551234567",
    });
    const bookingCode = (await reservationRow(other.id)).bookingCode;
    const token = signFindTableToken("order", te.order.orderId);
    const json = JSON.stringify(await getPublicTableView(db, token));
    for (const secret of [
      "Deniz", "Yılmaz", "deniz@example.com", te.order.pnr!, "Zeynep", "Kaya", "5551234567", bookingCode,
      "Ekip Kırmızı", "group", "allocation", "category", "casino", "online", "sellable", "status", "customer",
    ]) {
      expect(json).not.toContain(secret);
    }
    expect(json).toContain("C1");
  });

  it("rezervasyon: tek masa, kişi sayısı kadar yer", async () => {
    const g = await bookedGuest();
    const view = await getPublicTableView(db, signFindTableToken("reservation", g.reservation.id));
    expect(view!.tables.map((t) => [t.label, t.seats])).toEqual([["A1", 2]]);
  });

  it("rezervasyon görünümünde misafir adı ve telefonu yok", async () => {
    const g = await bookedGuest();
    await db
      .update(reservations)
      .set({ guestName: "Ali Öztürk", guestPhone: "05559876543" })
      .where(eq(reservations.id, g.reservation.id));
    const json = JSON.stringify(await getPublicTableView(db, signFindTableToken("reservation", g.reservation.id)));
    for (const secret of ["Ali", "Öztürk", "5559876543", g.customer.fullName]) expect(json).not.toContain(secret);
  });

  it("belirteç üretildikten sonra iptal edilen rezervasyon null", async () => {
    const g = await bookedGuest();
    const token = signFindTableToken("reservation", g.reservation.id);
    expect(await getPublicTableView(db, token)).not.toBeNull();
    await setReservationStatus(g.reservation.id, "cancelled");
    expect(await getPublicTableView(db, token)).toBeNull();
  });

  it("issued bileti kalmamış sipariş null", async () => {
    const te = await ticketedEvent();
    await db.execute(sql`update tickets set status = 'expired', seat_slot_id = null where order_id = ${te.order.orderId}`);
    expect(await getPublicTableView(db, signFindTableToken("order", te.order.orderId))).toBeNull();
    expect(await db.select().from(tickets).where(eq(tickets.orderId, te.order.orderId))).not.toHaveLength(0);
  });

  it("pencere dışındaki etkinlikte eski belirteç null", async () => {
    const te = await ticketedEvent();
    await db
      .update(events)
      .set({ startsAt: sql`now() - interval '30 hours'` as never, endsAt: sql`now() - interval '13 hours'` as never })
      .where(eq(events.id, te.event.id));
    expect(await getPublicTableView(db, signFindTableToken("order", te.order.orderId))).toBeNull();
  });

  it("imzası bozuk belirteçte veritabanına gidilmez", async () => {
    const exploding = new Proxy({}, {
      get() {
        throw new Error("veritabanına dokunuldu");
      },
    }) as never;
    expect(await getPublicTableView(exploding, "a.b")).toBeNull();
    expect(await getPublicTableView(exploding, `${signFindTableToken("order", ID)}x`)).toBeNull();
  });
});
