/** Para hesabı kuruş cinsinden `bigint` ile yapılır; kayan nokta kullanılmaz. Girdi/çıktı ondalıklı dizgidir. */

const SYMBOLS: Record<string, string> = { TRY: "₺", EUR: "€", USD: "$", GBP: "£" };
const HUNDRED = BigInt(100);
const ZERO = BigInt(0);

/** Tutar metnini kuruşa çevirir; en çok iki ondalık, işaret `-` olabilir. */
function toMinor(amount: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) throw new Error(`Geçersiz tutar: ${amount}`);
  const minor = BigInt(match[2] as string) * HUNDRED + BigInt((match[3] ?? "").padEnd(2, "0") || "0");
  return match[1] === "-" ? -minor : minor;
}

function parts(minor: bigint): { negative: boolean; whole: string; frac: string } {
  const negative = minor < ZERO;
  const digits = (negative ? -minor : minor).toString().padStart(3, "0");
  return { negative, whole: digits.slice(0, -2), frac: digits.slice(-2) };
}

/** `"1250.00"` + `TRY` -> `"1.250,00 ₺"` (tr-TR, iki ondalık). */
export function formatMoney(amount: string, currency: string): string {
  const { negative, whole, frac } = parts(toMinor(amount));
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped},${frac} ${SYMBOLS[currency] ?? currency}`;
}

/** Tutarı adetle çarpar; kuruş tam sayısıyla hesaplanır (kayan nokta yok). */
export function multiplyMoney(amount: string, quantity: number): string {
  if (!Number.isSafeInteger(quantity)) throw new Error(`Geçersiz adet: ${quantity}`);
  const { negative, whole, frac } = parts(toMinor(amount) * BigInt(quantity));
  return `${negative ? "-" : ""}${whole}.${frac}`;
}
