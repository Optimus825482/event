import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { checkInActionDefs } from "@/features/check-in/action-defs";
import { displayPnr } from "@/features/check-in/door-code";
import { findOrderAtDoor } from "@/features/check-in/order-lookup";
import { searchGuests } from "@/features/check-in/read-service";
import { createAction } from "@/lib/action";
import { memberActor, noAccessActor } from "../../helpers/actors";
import { setupTestDb, truncateAll } from "../../helpers/db";
import { doorActor, stampTicketCheckIn, ticketIdsOf, ticketedEvent } from "../../helpers/door";
import { createPaidOrder } from "../../helpers/ticketing";
import { saleEvent } from "../ticketing/fixtures";
import { bookedGuest, expectDomain, reservationRow } from "./fixtures";

describe("kapıda rezervasyon kodu ve PNR araması", () => {
  beforeAll(async () => {
    await setupTestDb();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  it("rezervasyon kodu ile arama rezervasyonu bulur (küçük harf, boşluk, tire yok sayılır)", async () => {
    const door = await doorActor();
    const { event, reservation } = await bookedGuest();
    const code = (await reservationRow(reservation.id)).bookingCode;
    const typed = ` ${code.slice(0, 4).toLowerCase()}-${code.slice(4).toLowerCase()} `;
    const rows = await searchGuests(db, door, { eventId: event.id, q: typed });
    expect(rows.map((r) => r.reservationId)).toEqual([reservation.id]);
  });

  it("başka etkinliğin rezervasyon kodu bu etkinlikte bulunmaz", async () => {
    const door = await doorActor();
    const a = await bookedGuest();
    const b = await bookedGuest();
    const code = (await reservationRow(a.reservation.id)).bookingCode;
    expect(await searchGuests(db, door, { eventId: b.event.id, q: code })).toEqual([]);
  });

  it("kod biçiminde olmayan arama eskisi gibi ad ve masa etiketi arar", async () => {
    const door = await doorActor();
    const { event } = await bookedGuest();
    expect(await searchGuests(db, door, { eventId: event.id, q: "A1" })).toHaveLength(1);
    expect(await searchGuests(db, door, { eventId: event.id, q: "olmayan" })).toEqual([]);
  });

  it("findOrderAtDoor: PNR siparişin tüm biletlerini masa etiketleriyle listeler", async () => {
    const door = await doorActor();
    const te = await ticketedEvent();
    const found = await findOrderAtDoor(db, door, { eventId: te.event.id, pnr: te.order.pnr! });
    expect(found).toMatchObject({ orderId: te.order.orderId, pnr: te.order.pnr, buyerName: "Deniz Yılmaz" });
    expect(found?.tickets.map((t) => [t.tableLabel, t.checkedInAt])).toEqual([
      ["B1", null],
      ["B1", null],
      ["B2", null],
    ]);
    expect(Object.keys(found ?? {}).sort()).toEqual(["buyerName", "orderId", "pnr", "tickets"]);
  });

  it("giriş yapmış bilet zamanıyla listelenir", async () => {
    const door = await doorActor();
    const te = await ticketedEvent();
    const ids = await ticketIdsOf(te.order.orderId);
    await stampTicketCheckIn(ids[0]!, new Date("2026-11-26T18:00:00Z"));
    const found = await findOrderAtDoor(db, door, { eventId: te.event.id, pnr: te.order.pnr! });
    const stamped = found?.tickets.filter((t) => t.checkedInAt !== null) ?? [];
    expect(stamped.map((t) => [t.ticketId, t.checkedInAt])).toEqual([[ids[0], "2026-11-26T18:00:00.000Z"]]);
    expect(found?.tickets.filter((t) => t.checkedInAt === null)).toHaveLength(2);
  });

  it("PNR tireli ve küçük harfle yazılabilir", async () => {
    const door = await doorActor();
    const te = await ticketedEvent();
    const found = await findOrderAtDoor(db, door, {
      eventId: te.event.id,
      pnr: displayPnr(te.order.pnr!).toLowerCase(),
    });
    expect(found?.orderId).toBe(te.order.orderId);
  });

  it.each(["ZZZZ-ZZZZ", "12", "!!!!!!!!"])("bilinmeyen ya da biçimsiz PNR %s null döner", async (pnr) => {
    const door = await doorActor();
    const te = await ticketedEvent();
    expect(await findOrderAtDoor(db, door, { eventId: te.event.id, pnr })).toBeNull();
  });

  it("başka etkinliğin PNR'ı null döner", async () => {
    const door = await doorActor();
    const a = await ticketedEvent();
    const b = await ticketedEvent();
    expect(await findOrderAtDoor(db, door, { eventId: b.event.id, pnr: a.order.pnr! })).toBeNull();
  });

  it.each(["expired", "pending"])("ödenmemiş (%s) sipariş PNR ile bulunmaz", async (status) => {
    const door = await doorActor();
    const te = await ticketedEvent();
    const input = { eventId: te.event.id, pnr: te.order.pnr! };
    expect(await findOrderAtDoor(db, door, input)).not.toBeNull();
    await db.execute(sql`update orders set status = ${status} where id = ${te.order.orderId}`);
    expect(await findOrderAtDoor(db, door, input)).toBeNull();
  });

  it("issued olmayan bilet listede çıkmaz", async () => {
    const door = await doorActor();
    const te = await ticketedEvent();
    const [gone] = await ticketIdsOf(te.order.orderId);
    await db.execute(sql`update tickets set status = 'expired', seat_slot_id = null where id = ${gone}`);
    const found = await findOrderAtDoor(db, door, { eventId: te.event.id, pnr: te.order.pnr! });
    expect(found?.tickets).toHaveLength(2);
    expect(found?.tickets.map((t) => t.ticketId)).not.toContain(gone);
  });

  it("olmayan etkinlik not_found", async () => {
    const door = await doorActor();
    await expectDomain(findOrderAtDoor(db, door, { eventId: randomUUID(), pnr: "ABCD2345" }), "not_found", "Etkinlik bulunamadı");
  });

  it("check_in:view yetkisi olmayan aktör PNR arayamaz", async () => {
    const te = await ticketedEvent();
    const run = createAction({ getActor: async () => noAccessActor() }).defineAction(checkInActionDefs.findOrder);
    expect(await run({ eventId: te.event.id, pnr: te.order.pnr! })).toMatchObject({ ok: false, code: "forbidden" });
    const view = createAction({
      getActor: async () => memberActor("casino", { check_in: "v---" }),
    }).defineAction(checkInActionDefs.findOrder);
    expect(await view({ eventId: te.event.id, pnr: "ABCD2345" })).toMatchObject({ ok: true, data: null });
  });

  it("kapı siparişi biletleri sandalye numarasıyla, masa → sandalye sırasında döner", async () => {
    const door = await doorActor();
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const paid = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2, seatNos: [6, 5] }] });
    const found = await findOrderAtDoor(db, door, { eventId: event.id, pnr: paid.pnr! });
    expect(found?.tickets.map((t) => t.seatNo)).toEqual([5, 6]);

    const tableMode = await saleEvent({ settings: { saleMode: "table" } });
    const tableOrder = await createPaidOrder(db, {
      eventId: tableMode.event.id,
      items: [{ tableId: tableMode.tables[0]!.id, quantity: 8 }],
    });
    const tableFound = await findOrderAtDoor(db, door, { eventId: tableMode.event.id, pnr: tableOrder.pnr! });
    expect(tableFound?.tickets.every((t) => t.seatNo === null)).toBe(true);
  });
});
