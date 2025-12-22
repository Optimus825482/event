/**
 * Check-in Store - Zustand ile check-in ve offline queue yönetimi
 * Requirements: 5.4 - Offline check-in queue ve sync mekanizması
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { reservationsApi } from "@/lib/api";
import {
  addOfflineCheckIn,
  getAllOfflineCheckIns,
  getQueueCount,
  clearSyncedCheckIns,
  deleteOfflineCheckIn,
  OfflineCheckIn,
} from "@/lib/offline-db";
import {
  syncOfflineQueue,
  startAutoSync,
  stopAutoSync,
  onSyncStatusChange,
  retryFailedCheckIns,
  getSyncStats,
  SyncStatus,
} from "@/lib/offline-sync";

// Check-in sonucu
export interface CheckInResult {
  success: boolean;
  message: string;
  reservation?: {
    id: string;
    customerName: string;
    tableLabel: string;
    guestCount: number;
    eventName: string;
  };
  tableLocation?: {
    x: number;
    y: number;
    label: string;
  };
  isOffline?: boolean;
}

// Event istatistikleri
export interface EventStats {
  totalExpected: number;
  checkedIn: number;
  remaining: number;
  cancelled: number;
  noShow: number;
}

// Store state
interface CheckInState {
  // Online durumu
  isOnline: boolean;

  // Offline queue
  offlineQueue: OfflineCheckIn[];
  queueCount: { total: number; unsynced: number };

  // Sync durumu
  syncStatus: SyncStatus;

  // Son check-in sonucu
  lastCheckInResult: CheckInResult | null;

  // Event istatistikleri
  eventStats: EventStats | null;

  // Son check-in'ler
  recentCheckIns: CheckInResult[];

  // Loading durumu
  isLoading: boolean;

  // Actions
  setOnlineStatus: (isOnline: boolean) => void;
  performCheckIn: (
    qrCodeHash: string,
    eventId?: string
  ) => Promise<CheckInResult>;
  loadOfflineQueue: () => Promise<void>;
  syncQueue: () => Promise<void>;
  retryFailed: () => Promise<void>;
  clearSynced: () => Promise<void>;
  removeFromQueue: (id: string) => Promise<void>;
  updateSyncStatus: (status: SyncStatus) => void;
  setEventStats: (stats: EventStats) => void;
  clearLastResult: () => void;
  initializeAutoSync: () => void;
  cleanupAutoSync: () => void;
}

export const useCheckInStore = create<CheckInState>()(
  persist(
    (set, get) => ({
      // Initial state
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      offlineQueue: [],
      queueCount: { total: 0, unsynced: 0 },
      syncStatus: {
        isSyncing: false,
        pendingCount: 0,
        failedCount: 0,
      },
      lastCheckInResult: null,
      eventStats: null,
      recentCheckIns: [],
      isLoading: false,

      // Online durumunu güncelle
      setOnlineStatus: (isOnline) => {
        set({ isOnline });

        // Online olunca otomatik sync
        if (isOnline) {
          get().syncQueue();
        }
      },

      // Check-in işlemi yap
      performCheckIn: async (qrCodeHash, eventId) => {
        set({ isLoading: true });

        const { isOnline } = get();

        try {
          if (isOnline) {
            // Online: API'ye direkt istek (QR hash ile check-in)
            try {
              const checkInResponse = await reservationsApi.checkIn(qrCodeHash);

              if (checkInResponse.data?.success) {
                const resData = checkInResponse.data.reservation;
                const result: CheckInResult = {
                  success: true,
                  message: checkInResponse.data.message || "Giriş başarılı!",
                  reservation: {
                    id: resData?.id || "",
                    customerName: resData?.customer?.fullName || "Misafir",
                    tableLabel:
                      checkInResponse.data.tableLocation?.label ||
                      resData?.tableId ||
                      "Masa",
                    guestCount: resData?.guestCount || 1,
                    eventName: resData?.event?.name || "Etkinlik",
                  },
                  tableLocation: checkInResponse.data.tableLocation,
                };

                // Son check-in'lere ekle
                set((state) => ({
                  lastCheckInResult: result,
                  recentCheckIns: [result, ...state.recentCheckIns.slice(0, 9)],
                  isLoading: false,
                }));

                return result;
              }

              throw new Error("Check-in başarısız");
            } catch (apiError: any) {
              // API hatası - offline queue'ya ekle
              if (!apiError.response || apiError.code === "ERR_NETWORK") {
                set({ isOnline: false });

                // Offline olarak işle
                const offlineCheckIn = await addOfflineCheckIn(
                  qrCodeHash,
                  eventId
                );
                await get().loadOfflineQueue();

                const result: CheckInResult = {
                  success: true,
                  message: "Check-in kaydedildi (çevrimdışı)",
                  isOffline: true,
                };

                set({ lastCheckInResult: result, isLoading: false });
                return result;
              }

              // Diğer API hataları
              const errorMessage =
                apiError.response?.data?.message || "Check-in başarısız";
              const result: CheckInResult = {
                success: false,
                message: errorMessage,
              };

              set({ lastCheckInResult: result, isLoading: false });
              return result;
            }
          } else {
            // Offline: IndexedDB'ye kaydet
            const offlineCheckIn = await addOfflineCheckIn(qrCodeHash, eventId);
            await get().loadOfflineQueue();

            const result: CheckInResult = {
              success: true,
              message: "Check-in kaydedildi (çevrimdışı)",
              isOffline: true,
            };

            set({ lastCheckInResult: result, isLoading: false });
            return result;
          }
        } catch (error: any) {
          const result: CheckInResult = {
            success: false,
            message: error.message || "Bir hata oluştu",
          };

          set({ lastCheckInResult: result, isLoading: false });
          return result;
        }
      },

      // Offline queue'yu yükle
      loadOfflineQueue: async () => {
        try {
          const queue = await getAllOfflineCheckIns();
          const count = await getQueueCount();

          set({
            offlineQueue: queue,
            queueCount: count,
          });
        } catch {
          // Queue yükleme hatası - sessizce devam et
        }
      },

      // Queue'yu senkronize et
      syncQueue: async () => {
        const { isOnline } = get();

        if (!isOnline) {
          return;
        }

        try {
          await syncOfflineQueue();
          await get().loadOfflineQueue();
        } catch {
          // Sync hatası - sessizce devam et
        }
      },

      // Başarısız check-in'leri yeniden dene
      retryFailed: async () => {
        const { isOnline } = get();

        if (!isOnline) {
          return;
        }

        try {
          await retryFailedCheckIns();
          await get().loadOfflineQueue();
        } catch {
          // Retry hatası - sessizce devam et
        }
      },

      // Senkronize edilmiş öğeleri temizle
      clearSynced: async () => {
        try {
          await clearSyncedCheckIns();
          await get().loadOfflineQueue();
        } catch {
          // Temizleme hatası - sessizce devam et
        }
      },

      // Queue'dan öğe sil
      removeFromQueue: async (id) => {
        try {
          await deleteOfflineCheckIn(id);
          await get().loadOfflineQueue();
        } catch {
          // Silme hatası - sessizce devam et
        }
      },

      // Sync durumunu güncelle
      updateSyncStatus: (status) => {
        set({ syncStatus: status });
      },

      // Event istatistiklerini güncelle
      setEventStats: (stats) => {
        set({ eventStats: stats });
      },

      // Son sonucu temizle
      clearLastResult: () => {
        set({ lastCheckInResult: null });
      },

      // Otomatik sync'i başlat
      initializeAutoSync: () => {
        // Online/offline event listener'ları
        if (typeof window !== "undefined") {
          const handleOnline = () => get().setOnlineStatus(true);
          const handleOffline = () => get().setOnlineStatus(false);

          window.addEventListener("online", handleOnline);
          window.addEventListener("offline", handleOffline);

          // Sync status listener
          onSyncStatusChange((status) => {
            get().updateSyncStatus(status);
          });

          // Auto sync başlat
          startAutoSync(30000); // 30 saniyede bir

          // İlk yükleme
          get().loadOfflineQueue();
        }
      },

      // Otomatik sync'i durdur
      cleanupAutoSync: () => {
        stopAutoSync();
      },
    }),
    {
      name: "checkin-storage",
      partialize: (state) => ({
        // Sadece gerekli state'leri persist et
        recentCheckIns: state.recentCheckIns.slice(0, 10),
      }),
    }
  )
);
