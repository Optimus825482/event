import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export type SalesAuth = { ok: true } | { ok: false; code: "unauthorized" | "sales_api_disabled" };

const PREFIX = "Bearer ";
const MIN_SECRET_LENGTH = 32;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Sabit zamanlı sır denetimi: iki değerin SHA-256 özeti karşılaştırılır (uzunluk sızmaz). */
export function checkSalesAuth(headers: Headers, secret: string | undefined): SalesAuth {
  if (secret === undefined || secret.length < MIN_SECRET_LENGTH) return { ok: false, code: "sales_api_disabled" };
  const header = headers.get("authorization");
  const presented = header !== null && header.startsWith(PREFIX) ? header.slice(PREFIX.length) : "";
  const matches = timingSafeEqual(digest(presented), digest(secret));
  if (header === null || !header.startsWith(PREFIX) || !matches) return { ok: false, code: "unauthorized" };
  return { ok: true };
}

/** Güvenilen satış sitesinin ilettiği istemci IP'si; geçersizse `unknown`. Yalnızca kimlik doğrulandıktan sonra çağrılır. */
export function salesClientIp(headers: Headers): string {
  const value = headers.get("x-sales-client-ip")?.trim();
  return value && isIP(value) !== 0 ? value : "unknown";
}
