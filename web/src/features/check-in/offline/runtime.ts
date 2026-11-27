import { createFlusher, createMemoryStore, purgeStaleItems, type FlushOptions, type Flusher, type QueueStore } from "./flusher";
import { createIdbStore, idbAvailable } from "./idb-store";
import { createItem, retryFailed, type QueueItem, type QueueTarget, type SettledEvent } from "./queue-core";
import { sendBatch } from "./transport";
import { tryWebLock } from "./web-lock";

const CHANNEL = "eventflow-check-in-queue";

type Listener = (events: SettledEvent[]) => void;

export type EnqueueMeta = { gate?: number | null };

export type QueueRuntime = {
  /** `false`: IndexedDB yok, kuyruk yalnızca bu sekmenin belleğinde. */
  durable: boolean;
  /** Oturumdaki kullanıcı (sunucudan gelen kimlik); boşaltma ve yeni öğeler bununla damgalanır. */
  setUser(userId: string): void;
  list(): Promise<QueueItem[]>;
  enqueue(eventId: string, target: QueueTarget, meta?: EnqueueMeta): Promise<QueueItem>;
  /** Her hedef için ayrı anahtarla, tek yazımda kuyruğa ekler. */
  enqueueMany(eventId: string, targets: readonly QueueTarget[], meta?: EnqueueMeta): Promise<QueueItem[]>;
  flush(options?: FlushOptions): Promise<void>;
  isPaused(): boolean;
  resume(): void;
  retry(item: QueueItem): Promise<void>;
  dismiss(key: string): Promise<void>;
  /** Kuyrukta (bu ya da başka sekmede) bir değişiklik olduğunda çağrılır. */
  onChange(listener: () => void): () => void;
  onEvents(listener: Listener): () => void;
};

let instance: QueueRuntime | null = null;

function openChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);
}

/** Sekme başına tek kuyruk çalışma zamanı (depo + boşaltıcı + yayın kanalı). */
export function getQueueRuntime(): QueueRuntime {
  if (instance) return instance;
  const durable = idbAvailable();
  const store: QueueStore = durable ? createIdbStore() : createMemoryStore();
  // Açılışta süresi geçmiş öğeleri (ham QR belirteci) sil; başarısızlık kuyruğu açmayı engellemez.
  void purgeStaleItems(store, Date.now()).catch(() => undefined);
  const channel = openChannel();
  const changeListeners = new Set<() => void>();
  const eventListeners = new Set<Listener>();
  let userId: string | null = null;

  const notifyLocal = () => changeListeners.forEach((l) => l());
  const notifyAll = () => {
    notifyLocal();
    channel?.postMessage("changed");
  };
  if (channel) channel.onmessage = notifyLocal;

  const flusher: Flusher = createFlusher({
    store,
    send: (items) => sendBatch(items),
    tryLock: tryWebLock,
    currentUserId: () => userId,
    now: () => Date.now(),
    onEvents: (events) => {
      eventListeners.forEach((l) => l(events));
      notifyAll();
    },
  });

  async function enqueueMany(eventId: string, targets: readonly QueueTarget[], meta?: EnqueueMeta): Promise<QueueItem[]> {
    if (userId === null) throw new Error("Oturum kimliği bilinmiyor; giriş kuyruğa yazılamaz");
    const now = Date.now();
    const clientTimestamp = new Date(now).toISOString();
    const items = targets.map((target) =>
      createItem({
        idempotencyKey: crypto.randomUUID(),
        ownerId: userId as string,
        eventId,
        target,
        clientTimestamp,
        now,
        gate: meta?.gate ?? null,
      }),
    );
    if (items.length === 0) return [];
    await store.putMany(items);
    notifyAll();
    return items;
  }

  instance = {
    durable,
    setUser(next) {
      if (userId === next) return;
      userId = next;
      // Başka kullanıcının oturumundan kalan duraklatma, yeni kullanıcıyı durdurmamalı.
      flusher.resume();
    },
    list: () => store.getAll(),
    async enqueue(eventId, target, meta) {
      const [item] = await enqueueMany(eventId, [target], meta);
      if (!item) throw new Error("Giriş kuyruğa yazılamadı");
      return item;
    },
    enqueueMany,
    async flush(options) {
      await flusher.flush(options);
      notifyAll();
    },
    isPaused: () => flusher.isPaused(),
    resume: () => flusher.resume(),
    async retry(item) {
      const next = retryFailed(item, Date.now());
      if (next === item) return;
      await store.putMany([next]);
      notifyAll();
    },
    async dismiss(key) {
      await store.remove([key]);
      notifyAll();
    },
    onChange(listener) {
      changeListeners.add(listener);
      return () => changeListeners.delete(listener);
    },
    onEvents(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
  };
  return instance;
}
