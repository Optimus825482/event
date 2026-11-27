import {
  DEFAULT_BATCH_SIZE,
  applyOutcome,
  claim,
  ownedBy,
  recoverInterrupted,
  selectDue,
  staleKeys,
  type BatchOutcome,
  type QueueItem,
  type SettledEvent,
} from "./queue-core";

/** Tek nesne deposu: anahtar `idempotencyKey`. Sekmeler arası güncellemeler öğe bazındadır. */
export type QueueStore = {
  getAll(): Promise<QueueItem[]>;
  putMany(items: readonly QueueItem[]): Promise<void>;
  remove(keys: readonly string[]): Promise<void>;
};

/** Kilit alınabilirse `fn`'i çalıştırıp `true`, başka biri tutuyorsa çalıştırmadan `false` döner. */
export type TryLock = (fn: () => Promise<void>) => Promise<boolean>;

export type FlusherDeps = {
  store: QueueStore;
  send: (items: readonly QueueItem[]) => Promise<BatchOutcome>;
  tryLock: TryLock;
  /**
   * Oturumdaki kullanıcı (sunucudan gelen kimlik). `null`: bilinmiyor, hiçbir şey gönderilmez.
   * Yalnızca bu kullanıcıya ait öğeler gönderilir; diğerleri dokunulmadan bekletilir.
   */
  currentUserId: () => string | null;
  now: () => number;
  random?: () => number;
  maxBatch?: number;
  onEvents?: (events: SettledEvent[]) => void;
};

export type FlushOptions = { ignoreBackoff?: boolean };

export type Flusher = {
  /** Aynı anda tek boşaltma: çalışırken yapılan çağrılar mevcut boşaltmayı bekler. */
  /**
   * `ignoreBackoff`: bağlantı geri geldi / operatör "Şimdi gönder" dedi; geri çekilme süresi beklenmez.
   * Zamanlayıcı ve görünürlük tetikleyicileri olağan (geri çekilmeli) çağrıyı kullanır.
   */
  flush(options?: FlushOptions): Promise<void>;
  isPaused(): boolean;
  /** Oturum yenilendikten sonra kuyruğu yeniden başlatır. */
  resume(): void;
};

/** Bellek içi depo: testler ve IndexedDB'nin olmadığı ortamlar için. */
export function createMemoryStore(): QueueStore {
  const map = new Map<string, QueueItem>();
  return {
    async getAll() {
      return [...map.values()].map((i) => ({ ...i }));
    },
    async putMany(items) {
      for (const i of items) map.set(i.idempotencyKey, { ...i });
    },
    async remove(keys) {
      for (const k of keys) map.delete(k);
    },
  };
}

/** Süresi geçmiş öğeleri (ham QR belirteci taşırlar) depodan siler; silinen anahtarları döndürür. */
export async function purgeStaleItems(store: QueueStore, now: number): Promise<string[]> {
  const keys = staleKeys(await store.getAll(), now);
  if (keys.length > 0) await store.remove(keys);
  return keys;
}

const MAX_ROUNDS = 200;

export function createFlusher(deps: FlusherDeps): Flusher {
  const { store, send, tryLock, now } = deps;
  const random = deps.random ?? Math.random;
  const maxBatch = deps.maxBatch ?? DEFAULT_BATCH_SIZE;
  let paused = false;
  let running: Promise<void> | null = null;

  async function drain(ignoreBackoff: boolean): Promise<void> {
    const userId = deps.currentUserId();
    if (userId === null) return;
    const recovered = recoverInterrupted(ownedBy(await store.getAll(), userId));
    await store.putMany(recovered.filter((i) => i.status === "pending"));

    for (let round = 0; round < MAX_ROUNDS && !paused; round += 1) {
      // Oturum bu arada değiştiyse (başka sekmede çıkış/giriş) eski kullanıcının öğeleri gönderilmez.
      if (deps.currentUserId() !== userId) return;
      const due = selectDue(
        ownedBy(await store.getAll(), userId),
        ignoreBackoff ? Number.POSITIVE_INFINITY : now(),
        maxBatch,
      );
      if (due.length === 0) return;
      const sent = claim(due, now());
      await store.putMany(sent);

      let outcome: BatchOutcome;
      try {
        outcome = await send(sent);
      } catch {
        outcome = { kind: "network" };
      }
      const applied = applyOutcome(sent, outcome, { now: now(), random: random() });
      const finished = applied.items.filter((i) => i.status === "done").map((i) => i.idempotencyKey);
      await store.putMany(applied.items.filter((i) => i.status !== "done"));
      deps.onEvents?.(applied.events);
      // Başarı olay olarak bildirildi; sunucuda onaylı olduğu için kuyruktan çıkar.
      if (finished.length > 0) await store.remove(finished);
      if (applied.pauseForAuth) paused = true;
      if (outcome.kind !== "results") return; // ağ/sunucu sorunu: döngüde zorlama yok
    }
  }

  return {
    flush(options = {}) {
      if (running) return running;
      if (paused) return Promise.resolve();
      const current = tryLock(() => drain(options.ignoreBackoff === true)).then(
        () => undefined,
        () => undefined,
      );
      running = current.finally(() => {
        running = null;
      });
      return running;
    },
    isPaused: () => paused,
    resume() {
      paused = false;
    },
  };
}
