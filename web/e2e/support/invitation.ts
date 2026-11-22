import { createHmac, hkdfSync } from "node:crypto";

/** `src/features/invitations/token.ts` ile aynı imza şeması (sunucu `BETTER_AUTH_SECRET` = e2e gizli anahtarı). */
export function invitationLink(reservationId: string, eventId: string): string {
  const secret = process.env.E2E_AUTH_SECRET;
  if (!secret) throw new Error("E2E_AUTH_SECRET tanımlı değil");
  const key = Buffer.from(hkdfSync("sha256", secret, Buffer.alloc(0), "invitation-link-v1", 32));
  const mac = createHmac("sha256", key).update(`${reservationId}:${eventId}`).digest();
  return `/i/${Buffer.from(reservationId, "utf8").toString("base64url")}.${mac.toString("base64url")}`;
}
