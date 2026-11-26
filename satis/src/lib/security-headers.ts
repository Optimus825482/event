/**
 * Tüm yanıtlara eklenen güvenlik başlıkları (`next.config.ts` kullanır).
 * CSP istek başına nonce gerektirdiği için `src/proxy.ts` içinde (`src/lib/csp.ts`) üretilir.
 */
export type HeaderEntry = { key: string; value: string };

/** Sipariş belirteçli ve kişisel veri taşıyan yollar. */
export const PRIVATE_PATH_PREFIXES = ["/odeme", "/bilet", "/biletimi-bul"] as const;

export function securityHeaders(production: boolean): HeaderEntry[] {
  const headers: HeaderEntry[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ];
  if (production) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
  }
  return headers;
}

/** `/biletler` gibi benzer önekler özel sayılmaz; yalnızca tam yol ya da alt yol eşleşir. */
export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function privateHeaders(): HeaderEntry[] {
  return [
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
    { key: "Cache-Control", value: "no-store" },
  ];
}
