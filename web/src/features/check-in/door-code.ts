/**
 * Kapı arama kutusundaki kod biçimi tanıma. Saf işlevler: Node modülü içe aktarmaz, istemcide çalışır.
 * `features/ticketing/pnr.ts` ile eşitliği sunucu testi sabitler.
 */
const PNR_LENGTH = 8;

/** Boşluk ve `-` atıldıktan sonra uzunluk tam 8 ise PNR biçimindedir. */
export function looksLikePnr(q: string): boolean {
  return q.replace(/[\s-]/g, "").length === PNR_LENGTH;
}

/** 8 karakterlik PNR'ı `XXXX-XXXX` gösterir; başka girdiyi aynen döner. */
export function displayPnr(pnr: string): string {
  return pnr.length === PNR_LENGTH ? `${pnr.slice(0, 4)}-${pnr.slice(4)}` : pnr;
}
