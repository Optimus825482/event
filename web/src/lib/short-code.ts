import { randomInt } from "node:crypto";
import { CODE_ALPHABET } from "./code-format";

export { CODE_ALPHABET, normalizeCode } from "./code-format";

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
