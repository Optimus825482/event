/**
 * Offline Queue Database - IndexedDB ile offline storage
 * Requirements: 5.4 - Offline check-in queue ve sync mekanizması
 */

import { openDB, IDBPDatabase } from "idb";

// Offline check-in kaydı
export interface OfflineCheckIn {
  id: string;
  qrCodeHash: string;
  timestamp: Date;
  synced: boolean;
  syncAttempts: number;
  lastSyncAttempt?: Date;
  error?: string;
  eventId?: string;
}

// Sync sonucu
export interface SyncResult {
  id: string;
  success: boolean;
  error?: string;
  serverResponse?: unknown;
}

// Sync log kaydı
interface SyncLogEntry {
  id: string;
  timestamp: Date;
  action: "sync_started" | "sync_completed" | "sync_failed";
  details?: string;
  itemCount?: number;
}

const DB_NAME = "eventflow-offline";
const DB_VERSION = 1;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbInstance: IDBPDatabase<any> | null = null;

/**
 * IndexedDB bağlantısını aç veya mevcut bağlantıyı döndür
 */
export async function getOfflineDB(): Promise<IDBPDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Offline check-in store
      if (!db.objectStoreNames.contains("offline-checkins")) {
        const checkInStore = db.createObjectStore("offline-checkins", {
          keyPath: "id",
        });
        checkInStore.createIndex("by-synced", "synced");
        checkInStore.createIndex("by-timestamp", "timestamp");
        checkInStore.createIndex("by-event", "eventId");
      }

      // Sync log store
      if (!db.objectStoreNames.contains("sync-log")) {
        db.createObjectStore("sync-log", { keyPath: "id" });
      }
    },
  });

  return dbInstance;
}

/**
 * Benzersiz ID üret
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Offline check-in ekle
 */
export async function addOfflineCheckIn(
  qrCodeHash: string,
  eventId?: string
): Promise<OfflineCheckIn> {
  const db = await getOfflineDB();

  const checkIn: OfflineCheckIn = {
    id: generateId(),
    qrCodeHash,
    timestamp: new Date(),
    synced: false,
    syncAttempts: 0,
    eventId,
  };

  await db.put("offline-checkins", checkIn);
  return checkIn;
}

/**
 * Tüm senkronize edilmemiş check-in'leri getir
 */
export async function getUnsyncedCheckIns(): Promise<OfflineCheckIn[]> {
  const db = await getOfflineDB();
  const all: OfflineCheckIn[] = await db.getAll("offline-checkins");
  return all.filter((c) => !c.synced);
}

/**
 * Tüm offline check-in'leri getir
 */
export async function getAllOfflineCheckIns(): Promise<OfflineCheckIn[]> {
  const db = await getOfflineDB();
  const all = await db.getAll("offline-checkins");
  // Timestamp'e göre sırala (en yeni en üstte)
  return all.sort(
    (a: OfflineCheckIn, b: OfflineCheckIn) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Check-in'i senkronize edildi olarak işaretle
 */
export async function markCheckInSynced(id: string): Promise<void> {
  const db = await getOfflineDB();
  const checkIn = await db.get("offline-checkins", id);

  if (checkIn) {
    checkIn.synced = true;
    checkIn.lastSyncAttempt = new Date();
    await db.put("offline-checkins", checkIn);
  }
}

/**
 * Check-in sync hatasını kaydet
 */
export async function markCheckInFailed(
  id: string,
  error: string
): Promise<void> {
  const db = await getOfflineDB();
  const checkIn = await db.get("offline-checkins", id);

  if (checkIn) {
    checkIn.syncAttempts += 1;
    checkIn.lastSyncAttempt = new Date();
    checkIn.error = error;
    await db.put("offline-checkins", checkIn);
  }
}

/**
 * Senkronize edilmiş check-in'leri temizle
 */
export async function clearSyncedCheckIns(): Promise<number> {
  const db = await getOfflineDB();
  const all: OfflineCheckIn[] = await db.getAll("offline-checkins");
  const synced = all.filter((c) => c.synced);

  for (const checkIn of synced) {
    await db.delete("offline-checkins", checkIn.id);
  }

  return synced.length;
}

/**
 * Belirli bir check-in'i sil
 */
export async function deleteOfflineCheckIn(id: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete("offline-checkins", id);
}

/**
 * Queue'daki toplam öğe sayısını getir
 */
export async function getQueueCount(): Promise<{
  total: number;
  unsynced: number;
}> {
  const db = await getOfflineDB();
  const all: OfflineCheckIn[] = await db.getAll("offline-checkins");
  const unsynced = all.filter((c) => !c.synced);

  return {
    total: all.length,
    unsynced: unsynced.length,
  };
}

/**
 * Sync log'a kayıt ekle
 */
export async function addSyncLog(
  action: "sync_started" | "sync_completed" | "sync_failed",
  details?: string,
  itemCount?: number
): Promise<void> {
  const db = await getOfflineDB();

  const entry: SyncLogEntry = {
    id: generateId(),
    timestamp: new Date(),
    action,
    details,
    itemCount,
  };

  await db.put("sync-log", entry);
}

/**
 * Event'e göre check-in'leri getir
 */
export async function getCheckInsByEvent(
  eventId: string
): Promise<OfflineCheckIn[]> {
  const db = await getOfflineDB();
  return db.getAllFromIndex("offline-checkins", "by-event", eventId);
}

/**
 * Veritabanını tamamen temizle (test/debug için)
 */
export async function clearAllOfflineData(): Promise<void> {
  const db = await getOfflineDB();
  await db.clear("offline-checkins");
  await db.clear("sync-log");
}
