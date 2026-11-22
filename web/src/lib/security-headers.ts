/**
 * Tüm yanıtlara eklenen güvenlik başlıkları (`next.config.ts` kullanır).
 *
 * - `frame-ancestors 'none'` (+ eski tarayıcılar için `X-Frame-Options: DENY`): sayfa çerçeveye alınamaz.
 * - `Permissions-Policy`: kamera yalnızca kendi kaynağına açıktır (check-in QR okuyucusu); diğer
 *   duyarlı özellikler kapalıdır.
 * - HSTS yalnızca üretimde (geliştirmede http://localhost'a kalıcı https zorlamasın).
 *
 * Tam bir içerik CSP'si (script-src vb.) bilerek eklenmedi: Next'in satır içi betikleri için
 * istek başına nonce gerekir ve bu, tüm sayfaları dinamik yapar. Ayrı bir iş olarak ele alınmalıdır.
 */
export type HeaderEntry = { key: string; value: string };

export function securityHeaders(production: boolean): HeaderEntry[] {
  const headers: HeaderEntry[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  ];
  if (production) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
  }
  return headers;
}
