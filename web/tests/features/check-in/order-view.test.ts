import { describe, expect, it } from "vitest";
import { checkInSuccessSchema, type CheckInSuccess } from "@/features/check-in/result-schema";
import type { DoorOrder } from "@/features/check-in/order-lookup";
import { orderSummary, resultLine, selectableTicketIds, ticketName } from "@/features/check-in/components/order-view";

const order: DoorOrder = {
  orderId: "o1",
  pnr: "ABCD2345",
  buyerName: "Deniz Yılmaz",
  tickets: [
    { ticketId: "t1", tableId: "b1", tableLabel: "B1", seatNo: 5, checkedInAt: "2026-11-26T18:00:00.000Z" },
    { ticketId: "t2", tableId: "b1", tableLabel: "B1", seatNo: 6, checkedInAt: null },
    { ticketId: "t3", tableId: "b2", tableLabel: "B2", seatNo: null, checkedInAt: null },
  ],
};

const base: CheckInSuccess = {
  outcome: "checked_in",
  kind: "ticket",
  reservationId: null,
  ticketId: null,
  pnr: null,
  gate: null,
  seatNo: null,
  eventId: "e1",
  guestName: null,
  guestCount: 1,
  tableId: "b1",
  tableLabel: "B1",
  checkedInAt: "2026-11-26T18:00:00.000Z",
  checkedInBy: null,
};

describe("kapı sipariş görünümü", () => {
  it("yalnızca giriş yapmamış biletler seçilebilir", () => {
    expect(selectableTicketIds(order)).toEqual(["t2", "t3"]);
  });
  it("reddedilmiş biletler seçilemez", () => {
    expect(selectableTicketIds(order, ["t2"])).toEqual(["t3"]);
  });
  it("özet satırı", () => expect(orderSummary(order)).toBe("3 bilet · 1 giriş yaptı"));
  it("bilet sonucu satırı PNR ve kapıyı gösterir", () =>
    expect(
      resultLine({ ...base, kind: "ticket", ticketId: "t1", reservationId: null, pnr: "ABCD2345", gate: 2, guestName: "Deniz Yılmaz", guestCount: 1 }),
    ).toBe("Deniz Yılmaz · Bilet · PNR ABCD-2345 · Kapı 2"));
  it("PNR yoksa o parça yer almaz", () =>
    expect(resultLine({ ...base, kind: "ticket", ticketId: "t1", guestName: null })).toBe("Misafir · Bilet"));
  it("rezervasyon sonucu satırı eskisi gibidir; kapı yoksa eklenmez", () =>
    expect(
      resultLine({ ...base, kind: "reservation", ticketId: null, reservationId: "r1", pnr: null, gate: null, guestName: null, guestCount: 4 }),
    ).toBe("Misafir · 4 kişi"));
  it("rezervasyon kapı doluysa kapıyı ekler", () =>
    expect(resultLine({ ...base, kind: "reservation", reservationId: "r1", gate: 1, guestCount: 4 })).toBe("Misafir · 4 kişi · Kapı 1"));
  it("bilet adı sandalye numarasını taşır; null ise taşımaz", () => {
    expect(ticketName(0, { tableLabel: "B1", seatNo: 5 })).toBe("Bilet 1 · Masa B1 · Sandalye 5");
    expect(ticketName(2, { tableLabel: "B2", seatNo: null })).toBe("Bilet 3 · Masa B2");
  });
  it("seatNo'suz eski saklı yanıt null okunur", () => {
    const { seatNo: _omit, ...legacy } = base;
    expect(checkInSuccessSchema.parse(legacy).seatNo).toBeNull();
  });
});
