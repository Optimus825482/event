/**
 * Kapı arama kutusundaki kod biçimi tanıma. Saf işlevler: Node modülü içe aktarmaz, istemcide çalışır.
 * Kural `lib/code-format.ts`'teki `parsePnr` ile tektir (`features/ticketing/pnr.ts` aynısını yeniden dışa aktarır).
 */
import { PNR_LENGTH, parsePnr } from "@/lib/code-format";

/**
 * `parsePnr` ile aynı kural: boşluk ve `-` atıldıktan sonra yalnızca kod alfabesinden tam 8 karakter.
 * "Ayşe Kaya" gibi 8 harfli adlar alfabe dışı karakter içerdiğinden ad araması kalır.
 */
export function looksLikePnr(q: string): boolean {
  return parsePnr(q) !== null;
}

/** 8 karakterlik PNR'ı `XXXX-XXXX` gösterir; başka girdiyi aynen döner. */
export function displayPnr(pnr: string): string {
  return pnr.length === PNR_LENGTH ? `${pnr.slice(0, 4)}-${pnr.slice(4)}` : pnr;
}
