// Arşiv para yardımcıları (saf). Para dizge ("12.50"), içeride kuruş `bigint`; `Number`/`parseFloat` yok.
// `features/finance/money.ts` negatif tutarı reddeder (net sonuç negatif olabilir), bu yüzden ayrı ve işaretli.
// tsconfig hedefi ES2017: `100n` sabit sözdizimi derlenmez, sabitler `BigInt()` ile kurulur.

const ZERO = BigInt(0);
const HUNDRED = BigInt(100);
const AMOUNT_PATTERN = /^-?\d+(\.\d{1,2})?$/;

/** Tutarı (işaretli) kuruşa çevirir. */
export function toCents(amount: string): bigint {
  if (!AMOUNT_PATTERN.test(amount)) {
    throw new Error(`Geçersiz tutar: ${amount}`);
  }
  const negative = amount.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? amount.slice(1) : amount).split(".");
  const cents = BigInt(whole) * HUNDRED + BigInt(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}

/** Kuruşu her zaman iki ondalıklı tutara çevirir; negatifte baştaki `-`. */
export function fromCents(cents: bigint): string {
  const negative = cents < ZERO;
  const abs = negative ? -cents : cents;
  const whole = abs / HUNDRED;
  const fraction = (abs % HUNDRED).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

export function addMoney(...amounts: string[]): string {
  let total = ZERO;
  for (const amount of amounts) total += toCents(amount);
  return fromCents(total);
}

export function subMoney(a: string, b: string): string {
  return fromCents(toCents(a) - toCents(b));
}
