/**
 * İçerik Güvenlik Politikası (CSP) oluşturucu. `src/proxy.ts` her istek için yeni bir nonce ile çağırır.
 *
 * Gevşetmeler (her biri gözlenen bir gereksinime bağlıdır):
 * - `'unsafe-eval'` yalnızca geliştirmede (React/Next dev hata yığınlarını yeniden kurmak için eval kullanır).
 * - Geliştirmede `style-src 'self' 'unsafe-inline'` (nonce'suz): Turbopack/HMR CSS'i betikle satır içi `<style>`
 *   olarak enjekte eder ve bunlara nonce koyamaz. Üretimde `<style>` yalnızca `'self'` + nonce ile sınırlıdır.
 * - `style-src-attr 'unsafe-inline'`: React'in `style={{…}}` öznitelikleri sunucu çıktısında satır içi
 *   `style="…"` olarak gelir (davetiye tasarımı, ilerleme çubukları, renk noktaları). Öznitelikler betik
 *   çalıştıramaz; `<style>` öğeleri ve harici CSS yine nonce/`'self'` ile sınırlıdır.
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
    ["img-src", ["'self'", "data:", "blob:"]],
    ["media-src", ["'self'", "blob:"]],
    ["worker-src", ["'self'", "blob:"]],
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
