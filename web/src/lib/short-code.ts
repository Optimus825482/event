import { randomInt } from "node:crypto";

/** Karışan karakterler (0/O, 1/I/L) olmadan 32 karakterlik alfabe. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Kriptografik rastgele, `CODE_ALPHABET` karakterlerinden oluşan kod. */
export function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/** Rezervasyon kodu: `R` + 6 karakter. */
export function randomBookingCode(): string {
  return `R${randomCode(6)}`;
}

/** Kullanıcı girdisini kod biçimine getirir; boşluk ve tire atılır. Alfabe dışı karakter kalırsa `""`. */
export function normalizeCode(input: string): string {
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return "";
  return code;
}
