/**
 * Küçük, tek uçuşlu TTL önbelleği. Aynı anahtarın eşzamanlı çağrıları tek `load` paylaşır;
 * reddedilen yükleme önbelleğe alınmaz; girdi sayısı aşılınca en eski girdi atılır.
 */
export type TtlCache<T> = {
  get(key: string, load: () => Promise<T>): Promise<T>;
  clear(): void;
};

type Entry<T> = { expiresAt: number; promise: Promise<T> };

export function createTtlCache<T>(options: { ttlMs: number; maxEntries: number; now?: () => number }): TtlCache<T> {
  const now = options.now ?? Date.now;
  const entries = new Map<string, Entry<T>>();

  return {
    get(key, load) {
      const current = now();
      const existing = entries.get(key);
      if (existing && current < existing.expiresAt) return existing.promise;

      // Yeniden eklemek girdiyi "en yeni" sıraya taşır (Map ekleme sırasını korur).
      entries.delete(key);
      const promise = load();
      const entry: Entry<T> = { expiresAt: current + options.ttlMs, promise };
      entries.set(key, entry);
      promise.catch(() => {
        if (entries.get(key) === entry) entries.delete(key);
      });
      while (entries.size > options.maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
      return promise;
    },
    clear() {
      entries.clear();
    },
  };
}
