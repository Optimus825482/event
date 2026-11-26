import { describe, expect, it } from "vitest";
import { archiveRates } from "@/features/archive/metrics";

const base = {
  sellableSeatCount: 14,
  ticketsSold: 4,
  demoTicketsSold: 2,
  ticketsCheckedIn: 2,
  guestsExpected: 10,
  guestsCheckedIn: 6,
  reservationCount: 2,
  reservationsNoShow: 1,
};

describe("arşiv oranları", () => {
  it("senaryonun oranları", () => {
    expect(archiveRates(base)).toEqual({ occupancy: 42.9, attendance: 50, noShow: 50 });
  });
  it("payda sıfırsa oran null", () => {
    expect(
      archiveRates({ ...base, sellableSeatCount: 0, guestsExpected: 0, ticketsSold: 0, demoTicketsSold: 0, reservationCount: 0 }),
    ).toEqual({ occupancy: null, attendance: null, noShow: null });
  });
  it("bir ondalığa yuvarlar", () => {
    expect(archiveRates({ ...base, sellableSeatCount: 3, ticketsSold: 1, demoTicketsSold: 0 }).occupancy).toBe(33.3);
  });
  it("yarımı yukarı yuvarlar", () => {
    expect(archiveRates({ ...base, sellableSeatCount: 16, ticketsSold: 1, demoTicketsSold: 0 }).occupancy).toBe(6.3);
  });
});
