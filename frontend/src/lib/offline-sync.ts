/**
 * Offline Sync Service - Online olunca queue'yu işle
 * Requirements: 5.4 - Offline check-in sync mekanizması
 */

import { reservationsApi } from "./api";
import {
  getUnsyncedCheckIns,
  markCheckInSynced,
  markCheckInFailed,
  addSyncLog,
  getQueueCount,
  OfflineCheckIn,
  SyncResult,
} from "./offline-db";

// Sync durumu
export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime?: Date;
  pendingCount: number;
  failedCount: number;
  lastError?: string;
}

// Sync event callback'leri
type SyncEventCallback = (status: SyncStatus) => void;
type CheckInSyncedCallback = (
  checkIn: OfflineCheckIn,
  result: SyncResult
) => void;

// Event listener'lar
const syncStatusListeners: Set<SyncEventCallback> = new Set();
const checkInSyncedListeners: Set<CheckInSyncedCallback> = new Set();

// Mevcut sync durumu
let currentSyncStatus: SyncStatus = {
  isSyncing: false,
  pendingCount: 0,
  failedCount: 0,
};

// Sync lock - aynı anda birden fazla sync'i önle
let syncLock = false;

// Retry ayarları
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Sync durumu değişikliğini bildir
 */
function notifySyncStatus(status: SyncStatus): void {
  currentSyncStatus = status;
  syncStatusListeners.forEach((callback) => callback(status));
}

/**
 * Check-in sync edildiğinde bildir
 */
function notifyCheckInSynced(
  checkIn: OfflineCheckIn,
  result: SyncResult
): void {
  checkInSyncedListeners.forEach((callback) => callback(checkIn, result));
}

/**
 * Sync durumu listener'ı ekle
 */
export function onSyncStatusChange(callback: SyncEventCallback): () => void {
  syncStatusListeners.add(callback);
  // Mevcut durumu hemen bildir
  callback(currentSyncStatus);
  // Unsubscribe fonksiyonu döndür
  return () => syncStatusListeners.delete(callback);
}

/**
 * Check-in sync listener'ı ekle
 */
export function onCheckInSynced(callback: CheckInSyncedCallback): () => void {
  checkInSyncedListeners.add(callback);
  return () => checkInSyncedListeners.delete(callback);
}

/**
 * Mevcut sync durumunu getir
 */
export function getSyncStatus(): SyncStatus {
  return { ...currentSyncStatus };
}

/**
 * Tek bir check-in'i senkronize et
 */
export async function syncSingleCheckIn(
  checkIn: OfflineCheckIn
): Promise<SyncResult> {
  try {
    // API'ye check-in isteği gönder (QR hash ile direkt check-in)
    const response = await reservationsApi.checkIn(checkIn.qrCodeHash);

    // Başarılı olarak işaretle
    await markCheckInSynced(checkIn.id);

    const result: SyncResult = {
      id: checkIn.id,
      success: true,
      serverResponse: response.data,
    };

    notifyCheckInSynced(checkIn, result);
    return result;
  } catch (error: any) {
    const errorMessage =
      error.response?.data?.message || error.message || "Bilinmeyen hata";

    // Hata durumunu kaydet
    await markCheckInFailed(checkIn.id, errorMessage);

    const result: SyncResult = {
      id: checkIn.id,
      success: false,
      error: errorMessage,
    };

    notifyCheckInSynced(checkIn, result);
    return result;
  }
}

/**
 * Tüm bekleyen check-in'leri senkronize et
 */
export async function syncOfflineQueue(): Promise<SyncResult[]> {
  // Zaten sync yapılıyorsa bekle
  if (syncLock) {
    console.log("[OfflineSync] Sync zaten devam ediyor, atlanıyor...");
    return [];
  }

  // Online değilse sync yapma
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    console.log("[OfflineSync] Çevrimdışı, sync atlanıyor...");
    return [];
  }

  syncLock = true;
  const results: SyncResult[] = [];

  try {
    await addSyncLog("sync_started");

    const unsyncedCheckIns = await getUnsyncedCheckIns();

    if (unsyncedCheckIns.length === 0) {
      console.log("[OfflineSync] Senkronize edilecek öğe yok");
      syncLock = false;
      return [];
    }

    console.log(
      `[OfflineSync] ${unsyncedCheckIns.length} öğe senkronize ediliyor...`
    );

    notifySyncStatus({
      isSyncing: true,
      pendingCount: unsyncedCheckIns.length,
      failedCount: 0,
    });

    let failedCount = 0;

    // Her check-in'i sırayla işle
    for (const checkIn of unsyncedCheckIns) {
      // Max retry'a ulaşmış olanları atla
      if (checkIn.syncAttempts >= MAX_RETRY_ATTEMPTS) {
        failedCount++;
        continue;
      }

      const result = await syncSingleCheckIn(checkIn);
      results.push(result);

      if (!result.success) {
        failedCount++;
      }

      // Rate limiting - her istek arasında kısa bekleme
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const successCount = results.filter((r) => r.success).length;

    await addSyncLog(
      "sync_completed",
      `${successCount}/${results.length} başarılı`,
      results.length
    );

    // Queue sayısını güncelle
    const queueCount = await getQueueCount();

    notifySyncStatus({
      isSyncing: false,
      lastSyncTime: new Date(),
      pendingCount: queueCount.unsynced,
      failedCount,
    });

    console.log(
      `[OfflineSync] Sync tamamlandı: ${successCount}/${results.length} başarılı`
    );
  } catch (error: any) {
    console.error("[OfflineSync] Sync hatası:", error);

    await addSyncLog("sync_failed", error.message);

    notifySyncStatus({
      isSyncing: false,
      pendingCount: currentSyncStatus.pendingCount,
      failedCount: currentSyncStatus.failedCount,
      lastError: error.message,
    });
  } finally {
    syncLock = false;
  }

  return results;
}

/**
 * Başarısız check-in'leri yeniden dene
 */
export async function retryFailedCheckIns(): Promise<SyncResult[]> {
  const unsyncedCheckIns = await getUnsyncedCheckIns();
  const failedCheckIns = unsyncedCheckIns.filter(
    (c) => c.syncAttempts > 0 && c.syncAttempts < MAX_RETRY_ATTEMPTS
  );

  if (failedCheckIns.length === 0) {
    return [];
  }

  console.log(
    `[OfflineSync] ${failedCheckIns.length} başarısız öğe yeniden deneniyor...`
  );

  const results: SyncResult[] = [];

  for (const checkIn of failedCheckIns) {
    // Retry delay
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

    const result = await syncSingleCheckIn(checkIn);
    results.push(result);
  }

  return results;
}

// Auto-sync: Online olunca otomatik senkronize et
let autoSyncEnabled = false;
let autoSyncInterval: NodeJS.Timeout | null = null;

/**
 * Online/offline event handler
 */
function handleOnlineStatusChange(): void {
  if (typeof navigator !== "undefined" && navigator.onLine) {
    console.log("[OfflineSync] Çevrimiçi olundu, sync başlatılıyor...");
    syncOfflineQueue();
  }
}

/**
 * Otomatik sync'i başlat
 */
export function startAutoSync(intervalMs: number = 30000): void {
  if (autoSyncEnabled) return;

  autoSyncEnabled = true;

  // Online event listener
  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnlineStatusChange);
  }

  // Periyodik sync
  autoSyncInterval = setInterval(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      syncOfflineQueue();
    }
  }, intervalMs);

  // İlk sync'i hemen yap
  if (typeof navigator !== "undefined" && navigator.onLine) {
    syncOfflineQueue();
  }

  console.log("[OfflineSync] Otomatik sync başlatıldı");
}

/**
 * Otomatik sync'i durdur
 */
export function stopAutoSync(): void {
  if (!autoSyncEnabled) return;

  autoSyncEnabled = false;

  if (typeof window !== "undefined") {
    window.removeEventListener("online", handleOnlineStatusChange);
  }

  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }

  console.log("[OfflineSync] Otomatik sync durduruldu");
}

/**
 * Conflict resolution: Aynı QR kod için çakışma kontrolü
 * Server'dan gelen veri ile local veriyi karşılaştır
 */
export async function resolveConflict(
  localCheckIn: OfflineCheckIn,
  serverData: { status?: string } | null
): Promise<"use_local" | "use_server" | "skip"> {
  // Server'da zaten check-in yapılmışsa, local'i atla
  if (serverData?.status === "checked_in") {
    console.log(
      `[OfflineSync] Conflict: ${localCheckIn.id} zaten check-in yapılmış, atlanıyor`
    );
    await markCheckInSynced(localCheckIn.id);
    return "skip";
  }

  // Server'da iptal edilmişse, local'i atla
  if (serverData?.status === "cancelled") {
    console.log(
      `[OfflineSync] Conflict: ${localCheckIn.id} iptal edilmiş, atlanıyor`
    );
    await markCheckInFailed(localCheckIn.id, "Rezervasyon iptal edilmiş");
    return "skip";
  }

  // Diğer durumlarda local'i kullan
  return "use_local";
}

/**
 * Sync durumunu sıfırla
 */
export function resetSyncStatus(): void {
  currentSyncStatus = {
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
  };
  notifySyncStatus(currentSyncStatus);
}

/**
 * Belirli bir check-in'i manuel olarak sync et
 */
export async function syncSingleItem(
  checkInId: string
): Promise<SyncResult | null> {
  const unsyncedCheckIns = await getUnsyncedCheckIns();
  const checkIn = unsyncedCheckIns.find((c) => c.id === checkInId);

  if (!checkIn) {
    console.log(`[OfflineSync] Check-in bulunamadı: ${checkInId}`);
    return null;
  }

  return syncSingleCheckIn(checkIn);
}

/**
 * Sync istatistiklerini getir
 */
export async function getSyncStats(): Promise<{
  total: number;
  synced: number;
  pending: number;
  failed: number;
}> {
  const queueCount = await getQueueCount();
  const unsyncedCheckIns = await getUnsyncedCheckIns();
  const failed = unsyncedCheckIns.filter(
    (c) => c.syncAttempts >= MAX_RETRY_ATTEMPTS
  ).length;

  return {
    total: queueCount.total,
    synced: queueCount.total - queueCount.unsynced,
    pending: queueCount.unsynced - failed,
    failed,
  };
}
