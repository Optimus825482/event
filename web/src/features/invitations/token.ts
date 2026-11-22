import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { env } from "@/env";
import { isUuid } from "@/lib/identifiers";

// Şemada davetiye bağlantısı için ayrı bir belirteç sütunu yok (`reservations.qr_token` giriş QR'ının
// kimlik bilgisidir ve URL'ye konmaz). Bağlantı, sunucu anahtarıyla imzalanan durumsuz bir belirteçtir.
const LABEL = "invitation-link-v1";
const MAC_BYTES = 32;

function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, Buffer.alloc(0), LABEL, 32));
}

function macOf(reservationId: string, eventId: string, secret: string): Buffer {
  return createHmac("sha256", deriveKey(secret)).update(`${reservationId}:${eventId}`).digest();
}

/** `base64url(rezervasyonId) + "." + base64url(HMAC(rezervasyonId:etkinlikId))` */
export function signInvitationToken(reservationId: string, eventId: string, secret: string = env.BETTER_AUTH_SECRET): string {
  const id = Buffer.from(reservationId, "utf8").toString("base64url");
  return `${id}.${macOf(reservationId, eventId, secret).toString("base64url")}`;
}

export type ParsedInvitationToken = { reservationId: string; mac: Buffer };

/** Biçimi çözer (imzayı doğrulamaz); bozuk girdi için `null`. */
export function parseInvitationToken(token: string): ParsedInvitationToken | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [idPart, macPart] = parts;
  if (!idPart || !macPart) return null;
  const reservationId = Buffer.from(idPart, "base64url").toString("utf8");
  const mac = Buffer.from(macPart, "base64url");
  if (!isUuid(reservationId) || mac.length !== MAC_BYTES) return null;
  return { reservationId, mac };
}

/** İmza, rezervasyonun GERÇEK etkinliğine bağlıdır; başka etkinliğe ait belirteç eşleşmez. */
export function verifyInvitationMac(
  parsed: ParsedInvitationToken,
  eventId: string,
  secret: string = env.BETTER_AUTH_SECRET,
): boolean {
  return timingSafeEqual(parsed.mac, macOf(parsed.reservationId, eventId, secret));
}
