/**
 * Check-in Module IndexedDB Wrapper
 * Offline desteği için yerel veritabanı yönetimi
 * Requirements: 8.1, 8.6
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";
import type {
  ActiveEvent,
  Reservation,
  OfflineCheckIn,
} from "@/store/check-in-store";

// ==================== DATABASE SCHEMA ====================

interface CheckInDBSchema extends DBSchema {
  events: {
    key: string; // eventId
    value: {
      event: ActiveEvent;
      reservations: Reservation[];
      cachedAt: string;
    };
  };
  offlineQueue: {
    key: string; // id
    value: OfflineCheckIn;
    indexes: {
      byStatus: string;
      byTimestamp: string;
    };
  };
  settings: {
    key: string;
    value: any;
  };
}

// ==================== DATABASE CONSTANTS ====================

const DB_NAME = "eventflow-checkin";
const DB_VERSION = 1;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 saat

// ==================== DATABASE INSTANCE ====================

let dbInstance: IDBPDatabase<CheckInDBSchema> | null = null;

/**
 * IndexedDB bağlantısını aç veya mevcut bağlantıyı döndür
 */
export async function getDB(): Promise<IDBPDatabase<CheckInDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<CheckInDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Events store
      if (!db.objectStoreNames.contains("events")) {
        db.createObjectStore("events");
      }

      // Offline queue store
      if (!db.objectStoreNames.contains("offlineQueue")) {
        const offlineStore = db.createObjectStore("offlineQueue");
        offlineStore.createIndex("byStatus", "status");
        offlineStore.createIndex("byTimestamp", "timestamp");
      }

      // Settings store
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings");
      }
    },
  });

  return dbInstance;
}

// ==================== EVENT CACHE OPERATIONS ====================

/**
 * Etkinlik ve rezervasyonlarını cache'e kaydet
 */
export async function cacheEventData(
  eventId: string,
  event: ActiveEvent,
  reservations: Reservation[]
): Promise<void> {
  const db = await getDB();
  await db.put(
    "events",
    {
      event,
      reservations,
      cachedAt: new Date().toISOString(),
    },
    eventId
  );
}

/**
 * Cache'den etkinlik verisi getir
 */
export async function getCachedEventData(eventId: string): Promise<{
  event: ActiveEvent;
  reservations: Reservation[];
  cachedAt: string;
} | null> {
  const db = await getDB();
  const data = await db.get("events", eventId);

  if (!data) return null;

  // TTL kontrolü
  const cachedTime = new Date(data.cachedAt).getTime();
  if (Date.now() - cachedTime > CACHE_TTL) {
    await db.delete("events", eventId);
    return null;
  }

  return data;
}

/**
 * Cache'deki etkinlik verisini güncelle
 */
export async function updateCachedReservation(
  eventId: string,
  reservation: Reservation
): Promise<void> {
  const db = await getDB();
  const data = await db.get("events", eventId);

  if (!data) return;

  const updatedReservations = data.reservations.map((r) =>
    r.id === reservation.id ? reservation : r
  );

  await db.put(
    "events",
    {
      ...data,
      reservations: updatedReservations,
    },
    eventId
  );
}

/**
 * Tüm cache'lenmiş etkinlikleri getir
 */
export async function getAllCachedEvents(): Promise<string[]> {
  const db = await getDB();
  return db.getAllKeys("events");
}

/**
 * Etkinlik cache'ini temizle
 */
export async function clearEventCache(eventId?: string): Promise<void> {
  const db = await getDB();

  if (eventId) {
    await db.delete("events", eventId);
  } else {
    await db.clear("events");
  }
}

// ==================== OFFLINE QUEUE OPERATIONS ====================

/**
 * Offline kuyruğa check-in ekle
 */
export async function addToOfflineQueue(
  checkIn: OfflineCheckIn
): Promise<void> {
  const db = await getDB();
  await db.put("offlineQueue", checkIn, checkIn.id);
}

/**
 * Offline kuyruktaki tüm öğeleri getir
 */
export async function getOfflineQueue(): Promise<OfflineCheckIn[]> {
  const db = await getDB();
  return db.getAll("offlineQueue");
}

/**
 * Belirli duruma göre offline kuyruk öğelerini getir
 */
export async function getOfflineQueueByStatus(
  status: OfflineCheckIn["status"]
): Promise<OfflineCheckIn[]> {
  const db = await getDB();
  return db.getAllFromIndex("offlineQueue", "byStatus", status);
}

/**
 * Offline kuyruk öğesini güncelle
 */
export async function updateOfflineQueueItem(
  id: string,
  updates: Partial<OfflineCheckIn>
): Promise<void> {
  const db = await getDB();
  const item = await db.get("offlineQueue", id);

  if (item) {
    await db.put("offlineQueue", { ...item, ...updates }, id);
  }
}

/**
 * Offline kuyruk öğesini sil
 */
export async function removeFromOfflineQueue(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("offlineQueue", id);
}

/**
 * Senkronize edilmiş öğeleri temizle
 */
export async function clearSyncedItems(): Promise<void> {
  const db = await getDB();
  const syncedItems = await db.getAllFromIndex(
    "offlineQueue",
    "byStatus",
    "synced"
  );

  const tx = db.transaction("offlineQueue", "readwrite");
  await Promise.all([
    ...syncedItems.map((item) => tx.store.delete(item.id)),
    tx.done,
  ]);
}

/**
 * Tüm offline kuyruğu temizle
 */
export async function clearOfflineQueue(): Promise<void> {
  const db = await getDB();
  await db.clear("offlineQueue");
}

/**
 * Offline kuyruk sayısını getir
 */
export async function getOfflineQueueCount(): Promise<{
  total: number;
  pending: number;
  failed: number;
}> {
  const db = await getDB();
  const all = await db.getAll("offlineQueue");

  return {
    total: all.length,
    pending: all.filter((item) => item.status === "pending").length,
    failed: all.filter((item) => item.status === "failed").length,
  };
}

// ==================== SETTINGS OPERATIONS ====================

/**
 * Ayar kaydet
 */
export async function saveSetting(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put("settings", value, key);
}

/**
 * Ayar getir
 */
export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get("settings", key);
}

/**
 * Ayar sil
 */
export async function deleteSetting(key: string): Promise<void> {
  const db = await getDB();
  await db.delete("settings", key);
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Veritabanını tamamen temizle
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear("events"),
    db.clear("offlineQueue"),
    db.clear("settings"),
  ]);
}

/**
 * Veritabanı boyutunu tahmin et (bytes)
 */
export async function estimateStorageUsage(): Promise<{
  usage: number;
  quota: number;
}> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return { usage: 0, quota: 0 };
}

/**
 * IndexedDB desteği kontrolü
 */
export function isIndexedDBSupported(): boolean {
  return typeof indexedDB !== "undefined";
}
