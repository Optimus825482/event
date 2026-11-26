/** Para hesabı kuruş cinsinden `bigint` ile yapılır; kayan nokta kullanılmaz. Girdi/çıktı iki ondalıklı dizgidir. */

const MONEY_RE = /^(\d{1,10})(?:\.(\d{1,2}))?$/;
const HUNDRED = BigInt(100);
const ZERO = BigInt(0);

function toCents(value: string): bigint {
  const m = MONEY_RE.exec(value);
  if (!m) throw new Error(`Geçersiz tutar: ${value}`);
  const frac = (m[2] ?? "").padEnd(2, "0");
  return BigInt(m[1] as string) * HUNDRED + BigInt(frac);
}

function fromCents(cents: bigint): string {
  const s = cents.toString().padStart(3, "0");
  return `${s.slice(0, -2)}.${s.slice(-2)}`;
}

/** Birim fiyat × adet. */
export function lineTotal(unitPrice: string, quantity: number): string {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error(`Geçersiz adet: ${quantity}`);
  return fromCents(toCents(unitPrice) * BigInt(quantity));
}

export function sumMoney(values: readonly string[]): string {
  let total = ZERO;
  for (const v of values) total += toCents(v);
  return fromCents(total);
}

/** Sayısal olarak en küçük tutar; boş listede `null`. */
export function minMoney(values: readonly string[]): string | null {
  let min: bigint | null = null;
  for (const v of values) {
    const c = toCents(v);
    if (min === null || c < min) min = c;
  }
  return min === null ? null : fromCents(min);
}
