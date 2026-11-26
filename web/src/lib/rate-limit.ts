/**
 * Hız sınırlayıcılar.
 *
 * - `createPgRateLimiter`: ÜRETİMDE kullanılan, PostgreSQL destekli sabit pencereli sayaç. Sayaç tek bir
 *   upsert ile atomik artırılır; web kopyaları ve yeniden başlatmalar arasında paylaşılır.
 * - `createRateLimiter`: süreç içi, kayan pencereli uygulama. Üretimde kullanılmaz; testlerde sahte (fake)
 *   olarak ve veritabanı gerektirmeyen birim testlerde kalır. Durum yalnızca bu süreçtedir.
 */
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { logError } from "@/lib/log";

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

export type AsyncRateLimiter = {
  check(key: string): Promise<RateLimitDecision>;
  /**
   * İsteğe bağlı: geçerli penceredeki son `check` sayımını geri alır (yalnızca başarısız denemeleri
   * saymak isteyen uçlar için). Sayaç sıfırın altına inmez; hata yutulur ve günlüğe yazılır.
   */
  refund?(key: string): Promise<void>;
};

export type PgRateLimiterOptions = {
  db: Pick<Db, "execute">;
  /** Sayaç alanı; aynı tabloyu paylaşan farklı uçların anahtarları karışmasın. */
  scope: string;
  /** Pencere içinde izin verilen istek sayısı (reddedilenler de sayılır). */
  limit: number;
  /** Pencere uzunluğu; tam saniyeye yuvarlanır (en az 1 sn). Pencereler epoch'a hizalı sabit dilimlerdir. */
  windowMs: number;
  /** Her çağrıda eski satırları silme olasılığı (varsayılan 0.01). */
  pruneProbability?: number;
  /** Bu süreden eski pencereler silinir (varsayılan: en az 10 dk ve pencerenin 5 katı). */
  retainMs?: number;
  random?: () => number;
  /** Hata günlüğü; varsayılan `logError`. */
  onError?: (error: unknown) => void;
  /**
   * Veritabanı hatasında davranış. `"open"` (varsayılan): istek geçer. `"closed"`: istek reddedilir
   * (`retryAfterSeconds` en çok 60); kaba kuvvete açık uçlar (ör. PNR arama) için.
   */
  onFailure?: "open" | "closed";
};

export type PgRateLimiter = AsyncRateLimiter & {
  /** Eski pencereleri siler; silinen satır sayısını döndürür. İstekler sırasında fırsat buldukça kendiliğinden çağrılır. */
  prune(): Promise<number>;
  refund(key: string): Promise<void>;
};

type HitRow = { hits: number; retry_after: number };

/**
 * Karar: veritabanı hatasında **fail-open** (istek geçer, hata günlüğe yazılır). Bu sınır herkese açık,
 * salt-okunur davetiye sayfalarını korur; veritabanı zaten çalışmıyorsa sayfa da açılamaz, kısmi bir
 * kesintide ise davetiye linkini açan misafirleri 429/500 ile kapıda bırakmak sınırın kendisinden kötüdür.
 * Kimlik doğrulama gibi kapalı kalması gereken uçlar için bu sınırlayıcı kullanılmamalıdır.
 */
export function createPgRateLimiter(options: PgRateLimiterOptions): PgRateLimiter {
  const { db, scope, limit } = options;
  const windowSeconds = Math.max(1, Math.round(options.windowMs / 1000));
  const retainSeconds = Math.ceil((options.retainMs ?? Math.max(options.windowMs * 5, 600_000)) / 1000);
  const pruneProbability = options.pruneProbability ?? 0.01;
  const random = options.random ?? Math.random;
  const onError = options.onError ?? ((error: unknown) => logError("rate-limit", error));
  const onFailure = options.onFailure ?? "open";

  async function prune(): Promise<number> {
    const result = await db.execute(
      sql`delete from public_rate_limits where window_start < clock_timestamp() - make_interval(secs => ${retainSeconds}::int)`,
    );
    return result.rowCount ?? 0;
  }

  return {
    prune,
    async refund(key) {
      try {
        await db.execute(sql`
          update public_rate_limits set hits = hits - 1
          where scope = ${scope}::text and key = ${key}::text and hits > 0
            and window_start = to_timestamp(floor(extract(epoch from clock_timestamp()) / ${windowSeconds}::int) * ${windowSeconds}::int)
        `);
      } catch (error) {
        onError(error);
      }
    },
    async check(key) {
      try {
        const result = await db.execute<HitRow>(sql`
          insert into public_rate_limits (scope, key, window_start, hits)
          values (
            ${scope}::text, ${key}::text,
            to_timestamp(floor(extract(epoch from clock_timestamp()) / ${windowSeconds}::int) * ${windowSeconds}::int),
            1
          )
          on conflict (scope, key, window_start) do update set hits = public_rate_limits.hits + 1
          returning hits,
            ceil(extract(epoch from window_start) + ${windowSeconds}::int - extract(epoch from clock_timestamp()))::int as retry_after
        `);
        const row = result.rows[0];
        if (!row) throw new Error("rate-limit upsert satır döndürmedi");
        if (random() < pruneProbability) void prune().catch(onError);
        if (row.hits <= limit) return { allowed: true };
        return { allowed: false, retryAfterSeconds: Math.min(windowSeconds, Math.max(1, row.retry_after)) };
      } catch (error) {
        onError(error);
        if (onFailure === "closed") return { allowed: false, retryAfterSeconds: Math.min(windowSeconds, 60) };
        return { allowed: true };
      }
    },
  };
}
