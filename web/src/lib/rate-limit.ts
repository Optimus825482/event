/**
 * Süreç içi, kayan pencereli hız sınırlayıcı. Bellek sınırlıdır: en fazla `maxKeys` anahtar,
 * anahtar başına en fazla `limit` zaman damgası tutulur. Sınır aşılınca önce süresi dolmuş
 * anahtarlar silinir, hâlâ doluysa en eski anahtar atılır.
 *
 * Durum yalnızca bu süreçtedir (tek kopya varsayımı); çok kopyalı kurulumda her kopya kendi
 * sayacını tutar ve etkin sınır kopya sayısıyla çarpılır.
 */
export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type RateLimiterOptions = {
  /** Pencere içinde izin verilen istek sayısı. */
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
};

export type RateLimiter = {
  /** İsteği sayar; sınır aşıldıysa reddeder (reddedilen istek pencereyi uzatmaz). */
  check(key: string): RateLimitDecision;
  /** Test ve izleme için: tutulan anahtar sayısı. */
  size(): number;
};

const DEFAULT_MAX_KEYS = 10_000;

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMs } = options;
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  const now = options.now ?? Date.now;
  const hits = new Map<string, number[]>();

  function fresh(stamps: number[], at: number): number[] {
    const cutoff = at - windowMs;
    let first = 0;
    while (first < stamps.length && (stamps[first] ?? 0) <= cutoff) first += 1;
    return first === 0 ? stamps : stamps.slice(first);
  }

  function makeRoom(at: number): void {
    for (const [key, stamps] of hits) {
      const last = stamps[stamps.length - 1] ?? 0;
      if (last <= at - windowMs) hits.delete(key);
    }
    while (hits.size >= maxKeys) {
      const oldest = hits.keys().next();
      if (oldest.done) break;
      hits.delete(oldest.value);
    }
  }

  return {
    check(key) {
      const at = now();
      const existing = hits.get(key);
      if (!existing && hits.size >= maxKeys) makeRoom(at);

      const stamps = existing ? fresh(existing, at) : [];
      if (stamps.length >= limit) {
        hits.set(key, stamps);
        const oldest = stamps[0] ?? at;
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - at) / 1000)) };
      }
      stamps.push(at);
      // Yeniden ekleme, anahtarı Map sırasında sona taşır (en az yakın zamanda kullanılan atılır).
      hits.delete(key);
      hits.set(key, stamps);
      return { allowed: true };
    },
    size: () => hits.size,
  };
}
