import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { orders, tickets } from "@/db/schema";
import { signQrToken } from "@/features/reservations/qr-token";
import {
  findTicketByQr,
  listOrderTickets,
} from "@/features/ticketing/tickets-read";
import { createBookingParents, createReservation } from "../../helpers/factories";
import { truncateAll } from "../../helpers/db";
import {
  createPaidOrder,
  createPendingHold,
  expireOrder,
} from "../../helpers/ticketing";
import { saleEvent } from "./fixtures";

describe("bilet okuma", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("QR ile bilet bulunur: masa, alıcı, PNR", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const paid = await createPaidOrder(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 2 }],
    });
    const found = await findTicketByQr(db, paid.tickets[0]!.qrPayload);
    expect(found).toEqual({
      ticketId: paid.tickets[0]!.ticketId,
      orderId: paid.orderId,
      eventId: event.id,
      tableId: a1!.id,
      tableLabel: "A1",
      status: "issued",
      buyerName: "Ayşe Yılmaz",
      pnr: paid.pnr,
      checkedInAt: null,
      seatNo: 1,
    });
  });

  it("alıcı adı kırpılır; boş soyad çift boşluk ya da null üretmez", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const paid = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 1 }] });
    const qr = paid.tickets[0]!.qrPayload;
    await db.update(orders).set({ buyerFirstName: "  Ayşe ", buyerLastName: "   " }).where(eq(orders.id, paid.orderId));
    expect((await findTicketByQr(db, qr))?.buyerName).toBe("Ayşe");
    await db.update(orders).set({ buyerFirstName: " ", buyerLastName: "" }).where(eq(orders.id, paid.orderId));
    expect((await findTicketByQr(db, qr))?.buyerName).toBeNull();
  });

  it("geçerli imzalı ama bilete ait olmayan belirteç bulunmaz", async () => {
    const { event, table, customer } = await createBookingParents(db);
    const reservation = await createReservation(db, { eventId: event.id, tableId: table.id, customerId: customer.id });
    expect(await findTicketByQr(db, signQrToken(randomUUID()))).toBeNull();
    expect(await findTicketByQr(db, "çöp")).toBeNull();
    expect(await findTicketByQr(db, signQrToken(reservation.id))).toBeNull();
  });

  it("QR'ı değiştirilmiş bilet eski belirteçle bulunmaz", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const paid = await createPaidOrder(db, {
      eventId: event.id,
      items: [{ tableId: a1!.id, quantity: 1 }],
    });
    const old = paid.tickets[0]!;
    await db
      .update(tickets)
      .set({ qrToken: "baska-deger" })
      .where(eq(tickets.id, old.ticketId));
    expect(await findTicketByQr(db, old.qrPayload)).toBeNull();
  });

  it("siparişin biletleri masa etiketine göre listelenir; tutulan bilet held, süresi dolan expired okunur", async () => {
    const {
      event,
      tables: [a1, b1],
    } = await saleEvent({ tables: [{ label: "A1" }, { label: "B1" }] });
    const items = [
      { tableId: b1!.id, quantity: 1 },
      { tableId: a1!.id, quantity: 2 },
    ];
    const paid = await createPaidOrder(db, { eventId: event.id, items });
    const list = await listOrderTickets(db, paid.orderId);
    expect(list.map((t) => t.tableLabel)).toEqual(["A1", "A1", "B1"]);
    expect(list.every((t) => t.status === "issued")).toBe(true);

    const pending = await createPendingHold(db, { eventId: event.id, items });
    const held = await listOrderTickets(db, pending.orderId);
    expect(held.map((t) => t.tableLabel)).toEqual(["A1", "A1", "B1"]);
    expect(
      held.every(
        (t) => t.status === "held" && t.buyerName === null && t.pnr === null,
      ),
    ).toBe(true);

    await expireOrder(db, pending.orderId);
    const expired = await listOrderTickets(db, pending.orderId);
    expect(expired.every((t) => t.status === "expired")).toBe(true);
  });

  it("bilet görünümü sandalye numarasını taşır; süresi dolmuş bilette ve bütün satılan masada null", async () => {
    const {
      event,
      tables: [a1, l1],
    } = await saleEvent({
      tables: [
        { label: "A1", capacity: 4, category: "standard" },
        { label: "L1", capacity: 4, category: "vip", isLoca: true },
      ],
      settings: { locaOnline: true },
    });
    const paidSeat = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    const seatTickets = await listOrderTickets(db, paidSeat.orderId);
    expect(seatTickets.map((t) => t.seatNo)).toEqual([1, 2]);

    const paidLoca = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: l1!.id, quantity: 4 }] });
    const locaTickets = await listOrderTickets(db, paidLoca.orderId);
    expect(locaTickets.every((t) => t.seatNo === null)).toBe(true);

    const pending = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    await expireOrder(db, pending.orderId);
    const expired = await listOrderTickets(db, pending.orderId);
    expect(expired.every((t) => t.seatNo === null)).toBe(true);

    const {
      event: tableEvent,
      tables: [t1],
    } = await saleEvent({
      tables: [{ label: "T1", capacity: 4 }],
      settings: { saleMode: "table" } as Record<string, unknown>,
    });
    const paidTable = await createPaidOrder(db, { eventId: tableEvent.id, items: [{ tableId: t1!.id, quantity: 4 }] });
    const tableTickets = await listOrderTickets(db, paidTable.orderId);
    expect(tableTickets.every((t) => t.seatNo === null)).toBe(true);
  });
});
