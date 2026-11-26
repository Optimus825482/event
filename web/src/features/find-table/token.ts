import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { env } from "@/env";
import { isUuid } from "@/lib/identifiers";

// "Masamı bul" bağlantısı: sunucu anahtarıyla imzalanan durumsuz belirteç. Giriş QR'ından ve davetiye
// bağlantısından ayrı bir HKDF etiketi kullanır; bu yüzden birinin belirteci ötekinde geçmez.
const LABEL = "find-table-v1";
const MAC_BYTES = 32;
const MAX_TOKEN_LENGTH = 200;

export type FindTableTarget = { kind: "order" | "reservation"; id: string };

function deriveKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", env.BETTER_AUTH_SECRET, Buffer.alloc(0), LABEL, 32));
}

function macOf(payload: string): Buffer {
  return createHmac("sha256", deriveKey()).update(payload).digest();
}

/** `base64url("<o|r>:<uuid>") + "." + base64url(HMAC)`; tür imzaya dahildir. */
export function signFindTableToken(kind: "order" | "reservation", id: string): string {
  const payload = `${kind === "order" ? "o" : "r"}:${id}`;
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${macOf(payload).toString("base64url")}`;
}

export function verifyFindTableToken(token: string): FindTableTarget | null {
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadPart, macPart] = parts;
  if (!payloadPart || !macPart) return null;
  const payload = Buffer.from(payloadPart, "base64url").toString("utf8");
  const mac = Buffer.from(macPart, "base64url");
  const match = /^([or]):(.+)$/.exec(payload);
  if (!match || mac.length !== MAC_BYTES) return null;
  const id = match[2]!;
  if (!isUuid(id)) return null;
  if (!timingSafeEqual(mac, macOf(payload))) return null;
  return { kind: match[1] === "o" ? "order" : "reservation", id };
}
