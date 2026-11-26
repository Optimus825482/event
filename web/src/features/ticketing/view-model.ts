/** İç Siparişler ekranının saf gösterim yardımcıları. Para dizge olarak işlenir; `Number` kullanılmaz. */

export const DEMO_BADGE = "DEMO";

type Occupancy = { held: number; issued: number; seats: number };

/** `"5/8"`: dolu pay = tutulan + satılan. */
export function occupancyLabel(row: Occupancy): string {
  return `${row.held + row.issued}/${row.seats}`;
}

export function occupancyTone(row: Occupancy): "empty" | "partial" | "full" {
  const taken = row.held + row.issued;
  if (taken <= 0) return "empty";
  return taken >= row.seats ? "full" : "partial";
}

export function orderStatusLabel(status: "pending" | "paid"): string {
  return status === "paid" ? "Ödendi" : "Tutuluyor";
}

/** `"3000.00"` → `"3.000,00 TRY"`; binlik ayırıcı dizgi işlemiyle konur. */
export function formatMoney(amount: string, currency: string): string {
  const [whole = "0", fraction = "00"] = amount.split(".");
  const sign = whole.startsWith("-") ? "-" : "";
  const digits = whole.replace(/^-/, "");
  let grouped = "";
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) grouped += ".";
    grouped += digits[i];
  }
  return `${sign}${grouped},${fraction.padEnd(2, "0")} ${currency}`;
}
