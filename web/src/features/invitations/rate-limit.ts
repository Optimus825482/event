import { getIP } from "better-auth/api";
import { env } from "@/env";
import { db } from "@/db/client";
import { type AsyncRateLimiter, createPgRateLimiter, type RateLimitDecision } from "@/lib/rate-limit";

/**
 * Herkese açık davetiye uçları (`/i/[token]`, `/i/[token]/image`) için IP başına hız sınırı (spec §12).
 * Davetiye sayfası görselleriyle birlikte birkaç istek yaptığından ve mekân Wi-Fi'ında birçok misafir
 * aynı IP'yi paylaşabildiğinden sınır cömerttir; amaç anonim istemcinin sınırsız veritabanı yükü
 * üretmesini engellemektir. Sayaç PostgreSQL'dedir (`public_rate_limits`): yeniden başlatmada sıfırlanmaz ve
 * web kopyaları arasında paylaşılır. Veritabanı hatasında fail-open (bkz. `createPgRateLimiter`).
 */
export const INVITATION_RATE_LIMIT = { limit: 120, windowMs: 60_000 } as const;
export const MAX_RETRY_AFTER_SECONDS = 3600;

/** IP çözülemediğinde (güvenilir başlık yok) kullanılan tek ortak kova. */
const UNKNOWN_KEY = "unknown";

/** Auth kilidiyle aynı kaynak: yalnızca yapılandırılmış güvenilir başlık okunur. */
export function invitationClientKey(headers: Headers, trustedHeader: string | undefined): string {
  const ip = getIP(headers, {
    advanced: { ipAddress: { ipAddressHeaders: trustedHeader ? [trustedHeader] : [] } },
  });
  return ip ?? UNKNOWN_KEY;
}

const limiter = createPgRateLimiter({ db, scope: "invitation", ...INVITATION_RATE_LIMIT });

export function checkInvitationRate(
  headers: Headers,
  deps: { limiter?: AsyncRateLimiter; trustedHeader?: string | undefined } = {},
): Promise<RateLimitDecision> {
  const trustedHeader = "trustedHeader" in deps ? deps.trustedHeader : env.TRUSTED_IP_HEADER;
  return (deps.limiter ?? limiter).check(invitationClientKey(headers, trustedHeader));
}

/** `Retry-After` değerini güvenli bir tamsayıya indirger (sorgu parametresinden gelir). */
export function parseRetryAfter(raw: string | null): number {
  const value = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(value) || value < 1) return 60;
  return Math.min(value, MAX_RETRY_AFTER_SECONDS);
}

export function tooManyRequestsResponse(retryAfterSeconds: number): Response {
  return new Response("Çok fazla istek gönderildi. Lütfen biraz bekleyip tekrar deneyin.", {
    status: 429,
    headers: {
      "Retry-After": String(retryAfterSeconds),
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
