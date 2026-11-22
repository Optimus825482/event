/** Okutulan/yapıştırılan QR içeriğinin check-in isteğindeki karşılığı (istemci ve sunucuda çalışır). */
export type ScannedCode = { token: string } | { legacyHash: string };

const SIGNED_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const LEGACY_HASH = /^[a-f0-9]{32}$/i;
const MAX_LENGTH = 2000;
/**
 * base64 JSON içindeki `qrCodeHash`: normal eski rezervasyonlarda 32 hex, Excel ile içe aktarılanlarda
 * `<etkinlik>-<masa>-<zaman>-<rastgele>` (yaklaşık 100 karakter). Sunucu şeması `legacyHash`'i 128 ile
 * sınırlar; karakter kümesi de kısıtlıdır (yalnızca harf, rakam, `-`, `_`, `.`, `:`).
 */
const LEGACY_EMBEDDED_HASH = /^[A-Za-z0-9._:-]{1,128}$/;

function legacyHashFromBase64(raw: string): string | null {
  if (!/^[A-Za-z0-9+/]+=*$/.test(raw)) return null;
  try {
    const parsed: unknown = JSON.parse(atob(raw));
    if (typeof parsed !== "object" || parsed === null || !("qrCodeHash" in parsed)) return null;
    const hash = parsed.qrCodeHash;
    return typeof hash === "string" && LEGACY_EMBEDDED_HASH.test(hash) ? hash : null;
  } catch {
    return null;
  }
}

/**
 * QR içeriğini çözer. Yeni QR: imzalı belirteç (`<id>.<imza>`). Eski QR: base64 JSON
 * (`{ eventId, tableId, qrCodeHash, ... }`; hash 32 hex ya da Excel içe aktarımındaki uzun biçim) ya da
 * doğrudan 32 karakterlik hash. Tanınmayan içerik
 * belirteç olarak gönderilir (sunucu "QR kod geçersiz" der); boş ya da aşırı uzunsa `null`.
 */
export function parseScannedCode(input: string): ScannedCode | null {
  const raw = input.trim();
  if (raw.length === 0 || raw.length > MAX_LENGTH) return null;
  if (SIGNED_TOKEN.test(raw)) return { token: raw };
  if (LEGACY_HASH.test(raw)) return { legacyHash: raw };
  const legacy = legacyHashFromBase64(raw);
  if (legacy) return { legacyHash: legacy };
  return raw.length <= 200 ? { token: raw } : null;
}
