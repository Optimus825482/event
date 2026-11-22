import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { QueueStore } from "./flusher";
import type { QueueItem } from "./queue-core";

/** Tek veritabanı, tek nesne deposu, tek kuyruk. Anahtar: `idempotencyKey`. */
export const DB_NAME = "eventflow-offline";
export const DB_VERSION = 1;
export const STORE_NAME = "check-in-queue";

interface OfflineDb extends DBSchema {
  "check-in-queue": { key: string; value: QueueItem };
}

export function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

/** İnce IndexedDB bağdaştırıcısı: iş mantığı yok, yalnızca öğe bazlı okuma/yazma/silme. */
export function createIdbStore(): QueueStore {
  let opened: Promise<IDBPDatabase<OfflineDb>> | null = null;
  const open = () => {
    opened ??= openDB<OfflineDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "idempotencyKey" });
      },
    });
    return opened;
  };
  return {
    async getAll() {
      return (await open()).getAll(STORE_NAME);
    },
    async putMany(items) {
      if (items.length === 0) return;
      const tx = (await open()).transaction(STORE_NAME, "readwrite");
      await Promise.all([...items.map((item) => tx.store.put(item)), tx.done]);
    },
    async remove(keys) {
      if (keys.length === 0) return;
      const tx = (await open()).transaction(STORE_NAME, "readwrite");
      await Promise.all([...keys.map((key) => tx.store.delete(key)), tx.done]);
    },
  };
}
