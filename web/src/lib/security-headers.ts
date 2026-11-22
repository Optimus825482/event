/**
 * Tüm yanıtlara eklenen güvenlik başlıkları (`next.config.ts` kullanır).
 *
 * - `X-Frame-Options: DENY`: sayfa çerçeveye alınamaz (CSP `frame-ancestors 'none'` ise proxy'de).
 * - `Permissions-Policy`: kamera yalnızca kendi kaynağına açıktır (check-in QR okuyucusu); diğer
 *   duyarlı özellikler kapalıdır.
 * - HSTS yalnızca üretimde (geliştirmede http://localhost'a kalıcı https zorlamasın).
 *
 * İçerik Güvenlik Politikası (CSP) istek başına nonce gerektirdiği için burada değil `src/proxy.ts` içinde
 * (`src/lib/csp.ts`) üretilir.
 */
export type HeaderEntry = { key: string; value: string };

export function securityHeaders(production: boolean): HeaderEntry[] {
  const headers: HeaderEntry[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  ];
  if (production) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
  }
  return headers;
}
