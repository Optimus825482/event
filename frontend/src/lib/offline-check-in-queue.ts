/**
 * Offline Check-in Queue Manager
 * Çevrimdışı check-in işlemlerini yönetir ve senkronize eder
 * Requirements: 8.1, 8.2, 8.5
 */

import {
  addToOfflineQueue,
  getOfflineQueue,
  getOfflineQueueByStatus,
  updateOfflineQueueItem,
  removeFromOfflineQueue,
  clearSyncedItems,
  getOfflineQueueCount,
} from "./check-in-db";
import { checkInApi } from "./api";
import type { OfflineCheckIn } from "@/store/check-in-store";

// ==================== CONSTANTS ====================

const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_BASE = 1000; // 1 saniye
const SYNC_BATCH_SIZE = 5;

// ==================== TYPES ====================

export interface QueueStatus {
  total: number;
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  isOnline: boolean;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: Array<{ id: string; error: string }>;
}

// ==================== EVENT EMITTER ====================

type QueueEventType =
  | "sync-start"
  | "sync-complete"
  | "sync-error"
  | "item-synced"
  | "item-failed";
type QueueEventCallback = (data: any) => void;

const eventListeners: Map<QueueEventType, Set<QueueEventCallback>> = new Map();

export function onQueueEvent(
  event: QueueEventType,
  callback: QueueEventCallback
): () => void {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(callback);

  // Unsubscribe function
  return () => {
    eventListeners.get(event)?.delete(callback);
  };
}

function emitQueueEvent(event: QueueEventType, data: any): void {
  eventListeners.get(event)?.forEach((callback) => callback(data));
}

// ==================== QUEUE OPERATIONS ====================

/**
 * Kuyruğa yeni check-in ekle
 */
export async function addCheckInToQueue(
  qrCodeHash: string,
  reservationId: string,
  guestCountOverride?: number
): Promise<OfflineCheckIn> {
  const checkIn: OfflineCheckIn = {
    id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    qrCodeHash,
    reservationId,
    timestamp: new Date().toISOString(),
    guestCountOverride,
    status: "pending",
    retryCount: 0,
  };

  await addToOfflineQueue(checkIn);
  return checkIn;
}

/**
 * Kuyruk durumunu getir
 */
export async function getQueueStatus(): Promise<QueueStatus> {
  const queue = await getOfflineQueue();
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  return {
    total: queue.length,
    pending: queue.filter((item) => item.status === "pending").length,
    syncing: queue.filter((item) => item.status === "syncing").length,
    synced: queue.filter((item) => item.status === "synced").length,
    failed: queue.filter((item) => item.status === "failed").length,
    isOnline,
  };
}

/**
 * Bekleyen check-in sayısını getir
 */
export async function getPendingCount(): Promise<number> {
  const counts = await getOfflineQueueCount();
  return counts.pending;
}

/**
 * Başarısız check-in'leri getir
 */
export async function getFailedItems(): Promise<OfflineCheckIn[]> {
  return getOfflineQueueByStatus("failed");
}

/**
 * Tek bir öğeyi senkronize et
 */
async function syncItem(item: OfflineCheckIn): Promise<boolean> {
  try {
    // Durumu syncing olarak güncelle
    await updateOfflineQueueItem(item.id, { status: "syncing" });

    // API çağrısı
    await checkInApi.checkIn(item.qrCodeHash);

    // Kişi sayısı override varsa güncelle
    if (item.guestCountOverride) {
      await checkInApi.updateGuestCount(
        item.reservationId,
        item.guestCountOverride
      );
    }

    // Başarılı - durumu synced olarak güncelle
    await updateOfflineQueueItem(item.id, { status: "synced" });
    emitQueueEvent("item-synced", {
      id: item.id,
      reservationId: item.reservationId,
    });

    return true;
  } catch (error: any) {
    const errorMessage =
      error.response?.data?.message || error.message || "Sync failed";

    // 409 Conflict (zaten check-in yapılmış) - başarılı say
    if (error.response?.status === 409) {
      await updateOfflineQueueItem(item.id, { status: "synced" });
      emitQueueEvent("item-synced", {
        id: item.id,
        reservationId: item.reservationId,
      });
      return true;
    }

    // Retry count kontrolü
    const newRetryCount = item.retryCount + 1;
    if (newRetryCount >= MAX_RETRY_COUNT) {
      await updateOfflineQueueItem(item.id, {
        status: "failed",
        retryCount: newRetryCount,
        error: errorMessage,
      });
      emitQueueEvent("item-failed", { id: item.id, error: errorMessage });
    } else {
      await updateOfflineQueueItem(item.id, {
        status: "pending",
        retryCount: newRetryCount,
        error: errorMessage,
      });
    }

    return false;
  }
}

/**
 * Tüm bekleyen öğeleri senkronize et
 */
export async function syncQueue(): Promise<SyncResult> {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!isOnline) {
    return {
      success: false,
      syncedCount: 0,
      failedCount: 0,
      errors: [{ id: "network", error: "Çevrimdışı" }],
    };
  }

  emitQueueEvent("sync-start", {});

  const pendingItems = await getOfflineQueueByStatus("pending");
  let syncedCount = 0;
  let failedCount = 0;
  const errors: Array<{ id: string; error: string }> = [];

  // Batch halinde senkronize et
  for (let i = 0; i < pendingItems.length; i += SYNC_BATCH_SIZE) {
    const batch = pendingItems.slice(i, i + SYNC_BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (item) => {
        // Exponential backoff delay
        if (item.retryCount > 0) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, item.retryCount - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        const success = await syncItem(item);
        return { item, success };
      })
    );

    results.forEach(({ item, success }) => {
      if (success) {
        syncedCount++;
      } else {
        failedCount++;
        errors.push({ id: item.id, error: item.error || "Unknown error" });
      }
    });
  }

  // Senkronize edilenleri temizle
  await clearSyncedItems();

  const result: SyncResult = {
    success: failedCount === 0,
    syncedCount,
    failedCount,
    errors,
  };

  emitQueueEvent("sync-complete", result);

  return result;
}

/**
 * Başarısız öğeleri yeniden dene
 */
export async function retryFailedItems(): Promise<SyncResult> {
  const failedItems = await getOfflineQueueByStatus("failed");

  // Retry count'u sıfırla ve pending yap
  await Promise.all(
    failedItems.map((item) =>
      updateOfflineQueueItem(item.id, {
        status: "pending",
        retryCount: 0,
        error: undefined,
      })
    )
  );

  // Senkronize et
  return syncQueue();
}

/**
 * Tek bir öğeyi yeniden dene
 */
export async function retryItem(id: string): Promise<boolean> {
  await updateOfflineQueueItem(id, {
    status: "pending",
    retryCount: 0,
    error: undefined,
  });

  const items = await getOfflineQueue();
  const item = items.find((i) => i.id === id);

  if (!item) return false;

  return syncItem(item);
}

/**
 * Öğeyi kuyruktan kaldır
 */
export async function removeItem(id: string): Promise<void> {
  await removeFromOfflineQueue(id);
}

/**
 * Tüm kuyruğu temizle
 */
export async function clearQueue(): Promise<void> {
  const items = await getOfflineQueue();
  await Promise.all(items.map((item) => removeFromOfflineQueue(item.id)));
}

// ==================== AUTO SYNC ====================

let autoSyncInterval: NodeJS.Timeout | null = null;

/**
 * Otomatik senkronizasyonu başlat
 */
export function startAutoSync(intervalMs = 30000): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
  }

  autoSyncInterval = setInterval(async () => {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (isOnline) {
      const status = await getQueueStatus();
      if (status.pending > 0) {
        await syncQueue();
      }
    }
  }, intervalMs);

  // Online olduğunda hemen senkronize et
  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
  }
}

/**
 * Otomatik senkronizasyonu durdur
 */
export function stopAutoSync(): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }

  if (typeof window !== "undefined") {
    window.removeEventListener("online", handleOnline);
  }
}

async function handleOnline(): Promise<void> {
  const status = await getQueueStatus();
  if (status.pending > 0) {
    await syncQueue();
  }
}

// ==================== INITIALIZATION ====================

/**
 * Offline queue manager'ı başlat
 */
export function initOfflineQueueManager(): void {
  // Online/offline event listeners
  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
  }
}

/**
 * Offline queue manager'ı temizle
 */
export function cleanupOfflineQueueManager(): void {
  stopAutoSync();
  if (typeof window !== "undefined") {
    window.removeEventListener("online", handleOnline);
  }
}
