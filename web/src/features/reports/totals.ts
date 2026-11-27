import { type ArchiveRates, archiveRates, type RateCounts } from "@/features/archive/metrics";
import { addMoney, subMoney } from "@/features/archive/money";
import type { ArchiveSummary } from "@/features/archive/read";

// Para birimi başına toplamlar (saf). Farklı para birimleri asla birbirine eklenmez.

export type CurrencyTotals = RateCounts & {
  currency: string;
  eventCount: number;
  ticketRevenue: string;
  demoTicketRevenue: string;
  artistFee: string;
  estimatedExpense: string;
  actualExpense: string;
  estimatedOtherIncome: string;
  actualOtherIncome: string;
  netActual: string;
  rates: ArchiveRates;
};

function emptyTotals(currency: string): CurrencyTotals {
  return {
    currency,
    eventCount: 0,
    sellableSeatCount: 0,
    ticketsSold: 0,
    demoTicketsSold: 0,
    ticketsCheckedIn: 0,
    guestsExpected: 0,
    guestsCheckedIn: 0,
    reservationCount: 0,
    reservationsNoShow: 0,
    ticketRevenue: "0.00",
    demoTicketRevenue: "0.00",
    artistFee: "0.00",
    estimatedExpense: "0.00",
    actualExpense: "0.00",
    estimatedOtherIncome: "0.00",
    actualOtherIncome: "0.00",
    netActual: "0.00",
    rates: { occupancy: null, attendance: null, noShow: null },
  };
}

export function totalsByCurrency(rows: readonly Omit<ArchiveSummary, "details">[]): CurrencyTotals[] {
  const byCurrency = new Map<string, CurrencyTotals>();
  for (const row of rows) {
    const t = byCurrency.get(row.currency) ?? emptyTotals(row.currency);
    t.eventCount += 1;
    t.sellableSeatCount += row.sellableSeatCount;
    t.ticketsSold += row.ticketsSold;
    t.demoTicketsSold += row.demoTicketsSold;
    t.ticketsCheckedIn += row.ticketsCheckedIn;
    t.guestsExpected += row.guestsExpected;
    t.guestsCheckedIn += row.guestsCheckedIn;
    t.reservationCount += row.reservationCount;
    t.reservationsNoShow += row.reservationsNoShow;
    t.ticketRevenue = addMoney(t.ticketRevenue, row.ticketRevenue);
    t.demoTicketRevenue = addMoney(t.demoTicketRevenue, row.demoTicketRevenue);
    t.artistFee = addMoney(t.artistFee, row.artistFee ?? "0.00");
    t.estimatedExpense = addMoney(t.estimatedExpense, row.estimatedExpense);
    t.actualExpense = addMoney(t.actualExpense, row.actualExpense);
    t.estimatedOtherIncome = addMoney(t.estimatedOtherIncome, row.estimatedOtherIncome);
    t.actualOtherIncome = addMoney(t.actualOtherIncome, row.actualOtherIncome);
    byCurrency.set(row.currency, t);
  }
  return [...byCurrency.values()]
    .sort((a, b) => (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0))
    .map((t) => ({
      ...t,
      netActual: subMoney(addMoney(t.ticketRevenue, t.actualOtherIncome), t.actualExpense),
      rates: archiveRates(t),
    }));
}
