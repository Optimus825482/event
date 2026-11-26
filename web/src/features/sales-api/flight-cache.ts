type Entry<T> = { promise: Promise<T>; expiresAt: number };

/** Aynı anahtara eşzamanlı çağrıları tek yüklemede birleştirir; sonucu `ttlMs` boyunca saklar. */
export function createFlightCache<T>(options: { ttlMs: number; now?: () => number; maxKeys?: number }) {
  const { ttlMs, now = Date.now, maxKeys = 500 } = options;
  const entries = new Map<string, Entry<T>>();

  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const current = now();
      const hit = entries.get(key);
      if (hit && current < hit.expiresAt) return hit.promise;
      entries.delete(key);

      const promise = load();
      const entry: Entry<T> = { promise, expiresAt: current + ttlMs };
      entries.set(key, entry);
      while (entries.size > maxKeys) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
      promise.catch(() => {
        if (entries.get(key) === entry) entries.delete(key);
      });
      return promise;
    },
  };
}
