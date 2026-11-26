import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { findOrderByPnr } from "@/features/ticketing/orders-service";
import { formatPnr } from "@/features/ticketing/pnr";
import { truncateAll } from "../../helpers/db";
import { createPaidOrder, createPendingHold } from "../../helpers/ticketing";
import { saleEvent } from "./fixtures";

describe("PNR ile sipariş arama", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("PNR + soyad eşleşirse siparişi bulur (biçim ve harf duyarsız)", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const paid = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    const pnr = paid.pnr!;
    const expected = { orderId: paid.orderId, eventId: event.id };
    expect(await findOrderByPnr(db, { pnr: formatPnr(pnr).toLowerCase(), lastName: " yilmaz " })).toEqual(expected);
    expect(await findOrderByPnr(db, { pnr, lastName: "YILMAZ" })).toEqual(expected);
    expect(await findOrderByPnr(db, { pnr, lastName: "Yılmaz" })).toEqual(expected);
  });

  it("yanlış soyad, olmayan PNR ve biçimi bozuk PNR null döner", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const paid = await createPaidOrder(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    expect(await findOrderByPnr(db, { pnr: paid.pnr!, lastName: "Kaya" })).toBeNull();
    expect(await findOrderByPnr(db, { pnr: paid.pnr!, lastName: "" })).toBeNull();
    const absent = paid.pnr === "ABCD2345" ? "ABCD2346" : "ABCD2345";
    expect(await findOrderByPnr(db, { pnr: absent, lastName: "Yılmaz" })).toBeNull();
    expect(await findOrderByPnr(db, { pnr: "123", lastName: "Yılmaz" })).toBeNull();
  });

  it("ödenmemiş siparişin PNR'ı yoktur; soyadı tek başına sipariş bulmaz", async () => {
    const {
      event,
      tables: [a1],
    } = await saleEvent();
    const hold = await createPendingHold(db, { eventId: event.id, items: [{ tableId: a1!.id, quantity: 2 }] });
    expect(hold.pnr).toBeNull();
    expect(await findOrderByPnr(db, { pnr: "", lastName: "Yılmaz" })).toBeNull();
    expect(await findOrderByPnr(db, { pnr: "ABCD2345", lastName: "Yılmaz" })).toBeNull();
    expect(await findOrderByPnr(db, { pnr: "ABCD2345", lastName: "" })).toBeNull();
  });
});
