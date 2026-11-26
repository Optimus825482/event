import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { env } from "@/env";
import { isUuid } from "@/lib/identifiers";

/**
 * Sipariş belirteci: `base64url(orderId) + "." + base64url(HMAC-SHA256(HKDF(secret, "order-token-v1"), orderId))`.
 * Anahtar etiketle türetildiği için QR ve davetiye belirteçleriyle birbirinin yerine geçmez.
 */
const LABEL = "order-token-v1";
const B64URL_RE = /^[A-Za-z0-9_-]+$/;
const MAX_TOKEN_LENGTH = 200;

function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, Buffer.alloc(0), LABEL, 32));
}

function mac(orderId: string, secret: string): Buffer {
  return createHmac("sha256", deriveKey(secret)).update(orderId, "utf8").digest();
}

export function signOrderToken(orderId: string, secret: string = env.BETTER_AUTH_SECRET): string {
  if (!isUuid(orderId)) throw new Error("Sipariş belirteci yalnızca sipariş kimliği (uuid) için üretilir");
  const id = orderId.toLowerCase();
  return `${Buffer.from(id, "utf8").toString("base64url")}.${mac(id, secret).toString("base64url")}`;
}

export function verifyOrderToken(token: string, secret: string = env.BETTER_AUTH_SECRET): { orderId: string } | null {
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [head, signature] = parts as [string, string];
  if (!B64URL_RE.test(head) || !B64URL_RE.test(signature)) return null;

  const orderId = Buffer.from(head, "base64url").toString("utf8");
  // Kanonik olmayan kodlamalar reddedilir.
  if (!isUuid(orderId) || Buffer.from(orderId, "utf8").toString("base64url") !== head) return null;

  const given = Buffer.from(signature, "base64url");
  const expected = mac(orderId, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return { orderId };
}
