/**
 * İçerik Güvenlik Politikası (CSP) oluşturucu. `src/proxy.ts` her istek için yeni bir nonce ile çağırır.
 * Tarayıcı yalnızca kendi kökenine bağlanabilir (`connect-src 'self'`); çekirdeğe doğrudan istek atılmaz.
 *
 * - `'unsafe-eval'` yalnızca geliştirmede (React/Next dev hata yığınları için).
 * - Geliştirmede `style-src 'unsafe-inline'`: Turbopack/HMR CSS'i satır içi `<style>` olarak enjekte eder.
 * - `style-src-attr 'unsafe-inline'`: React `style={{…}}` öznitelikleri için; öznitelikler betik çalıştıramaz.
 */
export type CspOptions = { nonce: string; production: boolean };

export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function buildCsp({ nonce, production }: CspOptions): string {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(production ? [] : ["'unsafe-eval'"])];
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", scriptSrc],
    ["style-src", production ? ["'self'", `'nonce-${nonce}'`] : ["'self'", "'unsafe-inline'"]],
    ["style-src-attr", ["'unsafe-inline'"]],
    ["img-src", ["'self'", "data:"]],
    ["connect-src", ["'self'"]],
    ["font-src", ["'self'", "data:"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];
  const parts = directives.map(([name, values]) => `${name} ${values.join(" ")}`);
  if (production) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
