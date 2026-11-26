// Arşiv oranları (saf). Yüzde bir ondalıklı, tamsayı aritmetiğiyle; payda 0 ise `null` ("—").

export type RateCounts = {
  sellableSeatCount: number;
  ticketsSold: number;
  demoTicketsSold: number;
  ticketsCheckedIn: number;
  guestsExpected: number;
  guestsCheckedIn: number;
  reservationCount: number;
  reservationsNoShow: number;
};

export type ArchiveRates = {
  occupancy: number | null;
  attendance: number | null;
  noShow: number | null;
};

/** `pay / payda` yüzdesi, en yakın onda bire (yarım yukarı) yuvarlanır; payda ≤ 0 → null. */
function percent(pay: number, payda: number): number | null {
  if (payda <= 0) return null;
  // Math.round(pay * 1000 / payda) / 10 ile aynı sonuç; kayan nokta bölmesi yerine tamsayı bölmesi.
  return Math.floor((pay * 2000 + payda) / (2 * payda)) / 10;
}

/** Karar 11: demo biletler oranlara dahildir (salonun fiziksel durumu). */
export function archiveRates(c: RateCounts): ArchiveRates {
  const sold = c.ticketsSold + c.demoTicketsSold;
  return {
    occupancy: percent(sold, c.sellableSeatCount),
    attendance: percent(c.guestsCheckedIn + c.ticketsCheckedIn, c.guestsExpected + sold),
    noShow: percent(c.reservationsNoShow, c.reservationCount),
  };
}
