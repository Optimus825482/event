import { createFlusher, createMemoryStore, type Flusher, type QueueStore } from "./flusher";
import { createIdbStore, idbAvailable } from "./idb-store";
import { createItem, retryFailed, type QueueItem, type QueueTarget, type SettledEvent } from "./queue-core";
import { sendBatch } from "./transport";
import { tryWebLock } from "./web-lock";

const CHANNEL = "eventflow-check-in-queue";

type Listener = (events: SettledEvent[]) => void;

export type QueueRuntime = {
  /** `false`: IndexedDB yok, kuyruk yalnızca bu sekmenin belleğinde. */
  durable: boolean;
  list(): Promise<QueueItem[]>;
  enqueue(eventId: string, target: QueueTarget): Promise<QueueItem>;
  flush(): Promise<void>;
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
  const channel = openChannel();
  const changeListeners = new Set<() => void>();
  const eventListeners = new Set<Listener>();

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
    now: () => Date.now(),
    onEvents: (events) => {
      eventListeners.forEach((l) => l(events));
      notifyAll();
    },
  });

  instance = {
    durable,
    list: () => store.getAll(),
    async enqueue(eventId, target) {
      const item = createItem({
        idempotencyKey: crypto.randomUUID(),
        eventId,
        target,
        clientTimestamp: new Date().toISOString(),
        now: Date.now(),
      });
      await store.putMany([item]);
      notifyAll();
      return item;
    },
    async flush() {
      await flusher.flush();
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
