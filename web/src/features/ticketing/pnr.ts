import { PNR_LENGTH, parseBookingCode, parsePnr } from "@/lib/code-format";
import { randomCode } from "@/lib/short-code";

// Ayrıştırıcılar saf `code-format.ts`'te yaşar (istemci de kullanır); burada yeniden dışa aktarılır.
export { PNR_LENGTH, parseBookingCode, parsePnr };

/** Sipariş kodu (PNR): kod alfabesinden 8 karakter. */
export function generatePnr(): string {
  return randomCode(PNR_LENGTH);
}

/** Gösterim biçimi `XXXX-XXXX`. */
export function formatPnr(pnr: string): string {
  return `${pnr.slice(0, 4)}-${pnr.slice(4)}`;
}
