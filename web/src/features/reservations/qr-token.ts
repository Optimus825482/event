import { createHmac, timingSafeEqual } from "node:crypto";
import { env, qrSigningKey } from "@/env";
import { isUuid } from "@/lib/identifiers";

/**
 * Giriş QR belirteci: `base64url(reservationId) + "." + base64url(HMAC-SHA256(key, reservationId))`.
 * Masa, etkinlik ya da misafir bilgisi taşımaz; doğrulayan taraf rezervasyonu veritabanından
 * okur ve GÜNCEL masayı kullanır (masa değişse de QR geçerli kalır).
 */

const B64URL_RE = /^[A-Za-z0-9_-]+$/;
const MAX_TOKEN_LENGTH = 200;

let cachedKey: Buffer | undefined;

function defaultKey(): Buffer {
  cachedKey ??= qrSigningKey(env);
  return cachedKey;
}

function mac(reservationId: string, key: Buffer): Buffer {
  return createHmac("sha256", key).update(reservationId, "utf8").digest();
}

export function signQrToken(reservationId: string, key: Buffer = defaultKey()): string {
  if (!isUuid(reservationId)) throw new Error("QR belirteci yalnızca rezervasyon kimliği (uuid) için üretilir");
  const id = reservationId.toLowerCase();
  return `${Buffer.from(id, "utf8").toString("base64url")}.${mac(id, key).toString("base64url")}`;
}

export function verifyQrToken(token: string, key: Buffer = defaultKey()): { reservationId: string } | null {
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [head, signature] = parts as [string, string];
  if (!B64URL_RE.test(head) || !B64URL_RE.test(signature)) return null;

  const reservationId = Buffer.from(head, "base64url").toString("utf8");
  // Kanonik olmayan kodlamalar (fazladan bit, farklı yazım) reddedilir.
  if (!isUuid(reservationId) || Buffer.from(reservationId, "utf8").toString("base64url") !== head) return null;

  const given = Buffer.from(signature, "base64url");
  const expected = mac(reservationId, key);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return { reservationId };
}
