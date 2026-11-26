import { isIP } from "node:net";

/**
 * İstemci IP'si yalnızca güvenilen proxy'nin yazdığı başlıktan okunur (TRUSTED_IP_HEADER);
 * başka hiçbir başlığa bakılmaz. Geçerli IP yoksa `null`.
 */
export function clientIp(headers: Headers, trustedHeader: string | undefined): string | null {
  if (!trustedHeader) return null;
  let raw: string | null;
  try {
    raw = headers.get(trustedHeader);
  } catch {
    return null;
  }
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim() ?? "";
  return isIP(first) !== 0 ? first : null;
}
