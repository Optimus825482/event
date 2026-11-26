import { normalizeCode, randomCode } from "@/lib/short-code";

export const PNR_LENGTH = 8;

/** Sipariş kodu (PNR): kod alfabesinden 8 karakter. */
export function generatePnr(): string {
  return randomCode(PNR_LENGTH);
}

/** Gösterim biçimi `XXXX-XXXX`. */
export function formatPnr(pnr: string): string {
  return `${pnr.slice(0, 4)}-${pnr.slice(4)}`;
}

/** Kullanıcı girdisini PNR'a çevirir; uzunluk ya da alfabe uymazsa `null`. */
export function parsePnr(input: string): string | null {
  const code = normalizeCode(input);
  return code.length === PNR_LENGTH ? code : null;
}
