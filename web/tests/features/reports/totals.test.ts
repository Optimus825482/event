import { describe, expect, it } from "vitest";
import { type ArchiveRow, toArchiveSummary } from "@/features/archive/read";
import { totalsByCurrency } from "@/features/reports/totals";

function summary(o: Partial<ArchiveRow> = {}) {
  const row: ArchiveRow = {
    eventId: "00000000-0000-4000-8000-000000000000",
    revision: 1,
    archivedAt: new Date("2027-01-01T00:00:00Z"),
    archivedBy: null,
    eventName: "Etkinlik",
    startsAt: new Date("2027-01-10T18:00:00Z"),
    eventType: null,
    artistId: null,
    artistName: null,
    artistFee: null,
    currency: "TRY",
    tableCount: 0,
    totalCapacity: 0,
    casinoTableCount: 0,
    casinoSeatCount: 0,
    onlineTableCount: 0,
    sellableSeatCount: 0,
    ticketsSold: 0,
    demoTicketsSold: 0,
    ticketsCheckedIn: 0,
    reservationCount: 0,
    reservationsCheckedIn: 0,
    reservationsNoShow: 0,
    guestsExpected: 0,
    guestsCheckedIn: 0,
    fnbStaffCount: 0,
    ticketRevenue: "0.00",
    demoTicketRevenue: "0.00",
    estimatedExpense: "0.00",
    actualExpense: "0.00",
    estimatedOtherIncome: "0.00",
    actualOtherIncome: "0.00",
    details: { categories: [], financeItems: [], gates: [] },
    ...o,
  };
  return toArchiveSummary(row);
}

describe("para birimi toplamları", () => {
  it("para birimleri ayrı toplanır, asla birleştirilmez", () => {
    const totals = totalsByCurrency([
      summary({ currency: "TRY", ticketRevenue: "0.10", demoTicketRevenue: "5.00", actualExpense: "1.00", artistFee: "100.00" }),
      summary({ currency: "TRY", ticketRevenue: "0.20", demoTicketRevenue: "7.00", actualExpense: "0.05", artistFee: null }),
      summary({ currency: "EUR", ticketRevenue: "9.99" }),
    ]);
    expect(totals.map((t) => t.currency)).toEqual(["EUR", "TRY"]);
    expect(totals[1]).toMatchObject({
      eventCount: 2,
      ticketRevenue: "0.30",
      demoTicketRevenue: "12.00",
      actualExpense: "1.05",
      artistFee: "100.00",
      netActual: "-0.75",
    });
    expect(totals[0]).toMatchObject({ eventCount: 1, ticketRevenue: "9.99", demoTicketRevenue: "0.00", netActual: "9.99" });
  });

  it("toplam oranı toplanmış sayılardan hesaplanır (oranların ortalaması değil)", () => {
    const [t] = totalsByCurrency([
      summary({ sellableSeatCount: 10, ticketsSold: 10 }),
      summary({ sellableSeatCount: 90, ticketsSold: 0 }),
    ]);
    expect(t!.rates.occupancy).toBe(10);
    expect(t).toMatchObject({ sellableSeatCount: 100, ticketsSold: 10, demoTicketsSold: 0 });
  });

  it("boş liste → []", () => expect(totalsByCurrency([])).toEqual([]));
});
