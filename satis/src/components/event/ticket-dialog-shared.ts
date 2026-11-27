/** "Bilet Al" penceresinin sunucu ve istemcide ortak sabitleri (istemci modülü değildir). */

/** Pencerenin kimliği; `#bilet-al` bağlantıları (kartlar, üst menü) bu pencereyi açar. */
export const TICKET_DIALOG_ID = "bilet-al";
export const TICKET_DIALOG_HASH = `#${TICKET_DIALOG_ID}`;

/**
 * JS kapalıyken pencere `:target` ile görünür olur (`#bilet-al` bağlantısı); form GET ile salona gönderilir.
 * Yalnızca `<noscript>` içinde yüklenir; CSP için istek nonce'unu taşır.
 */
export function ticketDialogNoscriptCss(nonce: string | null): string {
  const attr = nonce ? ` nonce="${nonce.replace(/[^A-Za-z0-9+/=]/g, "")}"` : "";
  return `<style${attr}>dialog#${TICKET_DIALOG_ID}:target{display:block;position:fixed;inset:0;z-index:60;height:fit-content}</style>`;
}

/** Kişi sayısı seçildikten sonra gidilen salon (3B/2B masa seçimi) sayfası. */
export function salonPath(eventId: string): string {
  return `/etkinlik/${eventId}/salon`;
}

