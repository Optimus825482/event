const FALLBACK = "/";
// Tarayıcılar URL ayrıştırırken sekme/satır sonlarını siler; "/\t/evil" böylece "//evil" olur.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Giriş sonrası yönlendirme hedefini doğrular. Yalnızca tek `/` ile başlayan,
 * aynı kaynağa ait göreli yollar kabul edilir; aksi halde `/` döner.
 */
export function safeNextPath(raw: string | null): string {
  if (raw === null || raw === "") return FALLBACK;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return FALLBACK;
  if (CONTROL_CHARS.test(raw)) return FALLBACK;
  try {
    const base = "http://same-origin.invalid";
    if (new URL(raw, base).origin !== base) return FALLBACK;
  } catch {
    return FALLBACK;
  }
  return raw;
}
