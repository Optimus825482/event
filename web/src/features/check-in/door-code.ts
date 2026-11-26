/**
 * Kapı arama kutusundaki kod biçimi tanıma. Saf işlevler: Node modülü içe aktarmaz, istemcide çalışır.
 * `features/ticketing/pnr.ts` ile eşitliği sunucu testi sabitler.
 */
import { normalizeCode } from "@/lib/code-format";

const PNR_LENGTH = 8;

/**
 * `parsePnr` ile aynı kural: boşluk ve `-` atıldıktan sonra yalnızca kod alfabesinden tam 8 karakter.
 * "Ayşe Kaya" gibi 8 harfli adlar alfabe dışı karakter içerdiğinden ad araması kalır.
 */
export function looksLikePnr(q: string): boolean {
  return normalizeCode(q).length === PNR_LENGTH;
}

/** 8 karakterlik PNR'ı `XXXX-XXXX` gösterir; başka girdiyi aynen döner. */
export function displayPnr(pnr: string): string {
  return pnr.length === PNR_LENGTH ? `${pnr.slice(0, 4)}-${pnr.slice(4)}` : pnr;
}
