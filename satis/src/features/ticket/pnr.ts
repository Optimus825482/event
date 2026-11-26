/** 8 karakterlik PNR'yi `XXXX-XXXX` biçiminde gösterir; başka uzunlukta girdiyi olduğu gibi bırakır. */
export function formatPnr(pnr: string): string {
  return pnr.length === 8 ? `${pnr.slice(0, 4)}-${pnr.slice(4)}` : pnr;
}
