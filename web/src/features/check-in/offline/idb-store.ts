import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { QueueStore } from "./flusher";
import { migrateStoredItem, type QueueItem } from "./queue-core";

/** Tek veritabanı, tek nesne deposu, tek kuyruk. Anahtar: `idempotencyKey`. */
export const DB_NAME = "eventflow-offline";
/** 2: öğelere `ownerId` eklendi (eski öğeler sahibi bilinmeyen olarak korunur). */
export const DB_VERSION = 2;
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
      async upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "idempotencyKey" });
          return;
        }
        if (oldVersion >= 2) return;
        let cursor = await transaction.objectStore(STORE_NAME).openCursor();
        while (cursor) {
          const migrated = migrateStoredItem(cursor.value);
          if (migrated !== cursor.value) await cursor.update(migrated);
          cursor = await cursor.continue();
        }
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
