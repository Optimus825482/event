// Kesin para aritmetiği. Saf modül: içeride yalnızca `bigint` kullanılır (kuruş = ×100, katsayı = ×1000).
// Para dizge olarak taşınır ("12500.50"); kayan nokta işlevleri ve sayı çarpımı kullanılmaz.

/** Kanonik kullanıcı girdisi sınırı: en fazla 9 tam basamak, 2 ondalık, işaretsiz. */
export const MONEY_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;
/** Katsayı girdisi sınırı: en fazla 3 tam basamak, 3 ondalık. */
export const COEFFICIENT_PATTERN = /^\d{1,3}(\.\d{1,3})?$/;

// tsconfig hedefi ES2017: `bigint` sabit sözdizimi (`100n`) derlenmez, sabitler `BigInt()` ile kurulur.
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);
const THOUSAND = BigInt(1000);

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const MILLI_PATTERN = /^\d+(\.\d{1,3})?$/;
const INPUT_PATTERN = /^\d{1,9}([.,]\d{1,2})?$/;

/** Tutarı kuruşa çevirir. Veritabanından gelen 10+ basamaklı toplamlar da kabul edilir. */
export function toMinor(amount: string): bigint {
  if (!AMOUNT_PATTERN.test(amount)) {
    throw new RangeError(`Geçersiz tutar: ${JSON.stringify(amount)}`);
  }
  const [whole, fraction = ""] = amount.split(".") as [string, string?];
  return BigInt(whole) * HUNDRED + BigInt(fraction.padEnd(2, "0"));
}

/** Kuruşu her zaman 2 ondalıklı tutara çevirir. */
export function fromMinor(minor: bigint): string {
  if (minor < ZERO) {
    throw new RangeError("Negatif tutar yazılamaz.");
  }
  const whole = minor / HUNDRED;
  const fraction = (minor % HUNDRED).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function addMoney(...amounts: string[]): string {
  let total = ZERO;
  for (const amount of amounts) {
    total += toMinor(amount);
  }
  return fromMinor(total);
}

export function multiplyMoney(amount: string, quantity: number): string {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError(`Geçersiz adet: ${String(quantity)}`);
  }
  return fromMinor(toMinor(amount) * BigInt(quantity));
}

/** Katsayıyı binde bire çevirir ("1.5" → 1500n). */
export function toMilli(coefficient: string): bigint {
  if (!MILLI_PATTERN.test(coefficient)) {
    throw new RangeError(`Geçersiz katsayı: ${JSON.stringify(coefficient)}`);
  }
  const [whole, fraction = ""] = coefficient.split(".") as [string, string?];
  return BigInt(whole) * THOUSAND + BigInt(fraction.padEnd(3, "0"));
}

/** Kullanıcı metnini kanonik tutara çevirir; tek `,` ya da `.` ondalık ayırıcıdır. Geçersizse `null`. */
export function parseMoneyInput(text: string): string | null {
  const trimmed = text.trim();
  if (!INPUT_PATTERN.test(trimmed)) {
    return null;
  }
  return fromMinor(toMinor(trimmed.replace(",", ".")));
}

/** Türkçe gösterim: "12500.50" → "12.500,50". */
export function formatMoney(amount: string): string {
  const [whole, fraction] = fromMinor(toMinor(amount)).split(".") as [
    string,
    string,
  ];
  let grouped = "";
  for (let end = whole.length; end > 0; end -= 3) {
    const start = end - 3 > 0 ? end - 3 : 0;
    const part = whole.slice(start, end);
    grouped = grouped === "" ? part : `${part}.${grouped}`;
  }
  return `${grouped},${fraction}`;
}
