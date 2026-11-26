const SYMBOLS: Record<string, string> = { TRY: "₺", EUR: "€", USD: "$", GBP: "£" };

/** Tutar metnini kuruş tam sayısına çevirir (kayan nokta kullanılmaz). */
function toMinor(amount: string): number {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match) throw new Error(`Geçersiz tutar: ${amount}`);
  const [, sign, whole = "0", frac = ""] = match;
  const minor = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return sign === "-" ? -minor : minor;
}

function minorToString(minor: number): string {
  const abs = Math.abs(minor);
  const text = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return minor < 0 ? `-${text}` : text;
}

/** `"1250.00"` + `TRY` -> `"1.250,00 ₺"` (tr-TR, iki ondalık). */
export function formatMoney(amount: string, currency: string): string {
  const minor = toMinor(amount);
  const abs = Math.abs(minor);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const frac = String(abs % 100).padStart(2, "0");
  return `${minor < 0 ? "-" : ""}${whole},${frac} ${SYMBOLS[currency] ?? currency}`;
}

/** Tutarı adetle çarpar; kuruş tam sayısıyla hesaplanır (kayan nokta yok). */
export function multiplyMoney(amount: string, quantity: number): string {
  return minorToString(toMinor(amount) * quantity);
}
