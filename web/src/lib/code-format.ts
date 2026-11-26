/**
 * Kod alfabesi ve girdi normalleştirme. Saf: Node modülü içe aktarmaz, istemcide de çalışır.
 * Rastgele kod üretimi `short-code.ts`'tedir.
 */

/** Karışan karakterler (0/O, 1/I/L) olmadan 32 karakterlik alfabe. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Kullanıcı girdisini kod biçimine getirir; boşluk ve tire atılır. Alfabe dışı karakter kalırsa `""`. */
export function normalizeCode(input: string): string {
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return "";
  return code;
}
