import { create } from "zustand";
import { persist } from "zustand/middleware";
import { checkInApi } from "@/lib/api";
import { socketService, CheckInData, LiveStatsData } from "@/lib/socket";

// ==================== TYPES ====================

export interface ActiveEvent {
  id: string;
  name: string;
  eventDate: string;
  totalCapacity: number;
  checkedInCount: number;
  venueLayout: VenueLayout | null;
}

export interface VenueLayout {
  tables: VenueTable[];
  width?: number;
  height?: number;
  backgroundImage?: string;
}

export interface VenueTable {
  id: string;
  label: string;
  x: number;
  y: number;
  capacity: number;
  shape?: string;
  width?: number;
  height?: number;
  rotation?: number;
  section?: string;
}

export interface Customer {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  vipScore: number;
  isBlacklisted: boolean;
  tags?: string[];
}

export interface Reservation {
  id: string;
  eventId: string;
  tableId: string;
  customerId?: string;
  customer?: Customer;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  guestCount: number;
  qrCodeHash: string;
  status: "pending" | "confirmed" | "checked_in" | "cancelled" | "no_show";
  checkInTime?: string;
  specialRequests?: string;
  table?: VenueTable;
}

export interface EventStats {
  totalExpected: number;
  checkedIn: number;
  remaining: number;
  cancelled: number;
  noShow: number;
  checkInPercentage: number;
}

export interface CheckInHistoryEntry {
  reservationId: string;
  guestName: string;
  tableLabel: string;
  guestCount: number;
  checkInTime: string;
  isVIP: boolean;
}

export interface TableLocation {
  tableId: string;
  label: string;
  x: number;
  y: number;
  section?: string;
  directionText: string;
}

export interface CheckInResult {
  success: boolean;
  reservation: Reservation;
  tableLocation: TableLocation | null;
  message: string;
  isVIP: boolean;
  isBlacklisted: boolean;
}

export interface CheckInError {
  code:
    | "ALREADY_CHECKED_IN"
    | "CANCELLED"
    | "INVALID_QR"
    | "WRONG_EVENT"
    | "NOT_FOUND"
    | "NETWORK_ERROR";
  message: string;
  originalCheckInTime?: string;
}

export interface OfflineCheckIn {
  id: string;
  qrCodeHash: string;
  reservationId: string;
  timestamp: string;
  guestCountOverride?: number;
  status: "pending" | "syncing" | "synced" | "failed";
  retryCount: number;
  error?: string;
}

export interface WalkInData {
  guestName: string;
  guestCount: number;
  tableId: string;
  phone?: string;
}

// ==================== STORE ====================

interface CheckInState {
  // State
  selectedEventId: string | null;
  selectedEvent: ActiveEvent | null;
  reservations: Map<string, Reservation>; // qrCodeHash -> Reservation
  eventStats: EventStats | null;
  checkInHistory: CheckInHistoryEntry[];
  offlineQueue: OfflineCheckIn[];
  isOnline: boolean;
  soundEnabled: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  selectEvent: (eventId: string) => Promise<void>;
  clearEvent: () => void;
  checkIn: (qrCodeHash: string) => Promise<CheckInResult | CheckInError>;
  checkInManual: (
    reservationId: string
  ) => Promise<CheckInResult | CheckInError>;
  registerWalkIn: (data: WalkInData) => Promise<CheckInResult | CheckInError>;
  searchReservations: (query: string) => Promise<Reservation[]>;
  updateGuestCount: (reservationId: string, count: number) => Promise<void>;
  syncOfflineQueue: () => Promise<void>;
  toggleSound: () => void;
  setOnlineStatus: (isOnline: boolean) => void;
  refreshStats: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  addToHistory: (entry: CheckInHistoryEntry) => void;
  updateReservationInCache: (reservation: Reservation) => void;

  // Real-time (placeholder - WebSocket entegrasyonu Task 11'de)
  subscribeToUpdates: (eventId: string) => void;
  unsubscribeFromUpdates: () => void;
}

// Helper: Generate table direction text
function generateDirectionText(
  table: VenueTable,
  venueLayout: VenueLayout
): string {
  if (!venueLayout.tables || venueLayout.tables.length === 0) {
    return `Masa ${table.label}`;
  }

  // Calculate relative position
  const centerX = (venueLayout.width || 800) / 2;
  const centerY = (venueLayout.height || 600) / 2;

  let direction = "";
  if (table.y < centerY * 0.6) direction = "Ön ";
  else if (table.y > centerY * 1.4) direction = "Arka ";

  if (table.x < centerX * 0.6) direction += "Sol";
  else if (table.x > centerX * 1.4) direction += "Sağ";
  else direction += "Orta";

  if (table.section) {
    return `${table.section} bölümü, ${direction.trim()} taraf - Masa ${
      table.label
    }`;
  }

  return `${direction.trim()} taraf - Masa ${table.label}`;
}

// Helper: Create table location from reservation
function createTableLocation(
  reservation: Reservation,
  venueLayout: VenueLayout | null
): TableLocation | null {
  if (!venueLayout || !reservation.tableId) return null;

  const table = venueLayout.tables?.find((t) => t.id === reservation.tableId);
  if (!table) return null;

  return {
    tableId: table.id,
    label: table.label,
    x: table.x,
    y: table.y,
    section: table.section,
    directionText: generateDirectionText(table, venueLayout),
  };
}

export const useCheckInStore = create<CheckInState>()(
  persist(
    (set, get) => ({
      // Initial State
      selectedEventId: null,
      selectedEvent: null,
      reservations: new Map(),
      eventStats: null,
      checkInHistory: [],
      offlineQueue: [],
      isOnline: true,
      soundEnabled: true,
      isLoading: false,
      error: null,

      // Select Event - Load event data and reservations
      selectEvent: async (eventId: string) => {
        set({ isLoading: true, error: null });

        try {
          // Fetch event details with reservations
          const response = await checkInApi.getEventForCheckIn(eventId);
          const { event, reservations, stats } = response.data;

          // Build reservations map (qrCodeHash -> Reservation)
          const reservationsMap = new Map<string, Reservation>();
          reservations.forEach((r: Reservation) => {
            if (r.qrCodeHash) {
              reservationsMap.set(r.qrCodeHash, r);
            }
          });

          // Build check-in history from already checked-in reservations
          const history: CheckInHistoryEntry[] = reservations
            .filter(
              (r: Reservation) => r.status === "checked_in" && r.checkInTime
            )
            .sort(
              (a: Reservation, b: Reservation) =>
                new Date(b.checkInTime!).getTime() -
                new Date(a.checkInTime!).getTime()
            )
            .slice(0, 20)
            .map((r: Reservation) => ({
              reservationId: r.id,
              guestName: r.customer?.fullName || r.guestName || "Misafir",
              tableLabel: r.table?.label || "Bilinmiyor",
              guestCount: r.guestCount,
              checkInTime: r.checkInTime!,
              isVIP: (r.customer?.vipScore || 0) > 0,
            }));

          set({
            selectedEventId: eventId,
            selectedEvent: event,
            reservations: reservationsMap,
            eventStats: stats,
            checkInHistory: history,
            isLoading: false,
          });
        } catch (error: any) {
          console.error("[CheckInStore] Event load error:", error);
          set({
            error: error.response?.data?.message || "Etkinlik yüklenemedi",
            isLoading: false,
          });
        }
      },

      // Clear selected event
      clearEvent: () => {
        set({
          selectedEventId: null,
          selectedEvent: null,
          reservations: new Map(),
          eventStats: null,
          checkInHistory: [],
          error: null,
        });
      },

      // Check-in via QR code
      checkIn: async (qrCodeHash: string) => {
        const { selectedEventId, selectedEvent, isOnline, offlineQueue } =
          get();

        if (!selectedEventId) {
          return {
            code: "WRONG_EVENT" as const,
            message: "Lütfen önce bir etkinlik seçin",
          };
        }

        // Check cache first
        const cachedReservation = get().reservations.get(qrCodeHash);

        // Validate event match
        if (
          cachedReservation &&
          cachedReservation.eventId !== selectedEventId
        ) {
          return {
            code: "WRONG_EVENT" as const,
            message: "Bu QR kod farklı bir etkinliğe ait",
          };
        }

        // Check if already checked in
        if (cachedReservation?.status === "checked_in") {
          return {
            code: "ALREADY_CHECKED_IN" as const,
            message: "Bu misafir zaten giriş yapmış",
            originalCheckInTime: cachedReservation.checkInTime,
          };
        }

        // Check if cancelled
        if (cachedReservation?.status === "cancelled") {
          return {
            code: "CANCELLED" as const,
            message: "Bu rezervasyon iptal edilmiş",
          };
        }

        // Offline mode - queue the check-in
        if (!isOnline) {
          if (!cachedReservation) {
            return {
              code: "NETWORK_ERROR" as const,
              message: "Çevrimdışı modda bu QR kod bulunamadı",
            };
          }

          const offlineEntry: OfflineCheckIn = {
            id: `offline-${Date.now()}`,
            qrCodeHash,
            reservationId: cachedReservation.id,
            timestamp: new Date().toISOString(),
            status: "pending",
            retryCount: 0,
          };

          // Update local state optimistically
          const updatedReservation = {
            ...cachedReservation,
            status: "checked_in" as const,
            checkInTime: offlineEntry.timestamp,
          };

          const newReservations = new Map(get().reservations);
          newReservations.set(qrCodeHash, updatedReservation);

          set({
            reservations: newReservations,
            offlineQueue: [...offlineQueue, offlineEntry],
          });

          // Add to history
          get().addToHistory({
            reservationId: cachedReservation.id,
            guestName:
              cachedReservation.customer?.fullName ||
              cachedReservation.guestName ||
              "Misafir",
            tableLabel: cachedReservation.table?.label || "Bilinmiyor",
            guestCount: cachedReservation.guestCount,
            checkInTime: offlineEntry.timestamp,
            isVIP: (cachedReservation.customer?.vipScore || 0) > 0,
          });

          return {
            success: true,
            reservation: updatedReservation,
            tableLocation: createTableLocation(
              updatedReservation,
              selectedEvent?.venueLayout || null
            ),
            message: "Check-in kaydedildi (çevrimdışı)",
            isVIP: (cachedReservation.customer?.vipScore || 0) > 0,
            isBlacklisted: cachedReservation.customer?.isBlacklisted || false,
          };
        }

        // Online mode - call API
        try {
          const response = await checkInApi.checkIn(qrCodeHash);
          const { reservation, tableLocation } = response.data;

          // Update cache
          get().updateReservationInCache(reservation);

          // Add to history
          get().addToHistory({
            reservationId: reservation.id,
            guestName:
              reservation.customer?.fullName ||
              reservation.guestName ||
              "Misafir",
            tableLabel:
              tableLocation?.label || reservation.table?.label || "Bilinmiyor",
            guestCount: reservation.guestCount,
            checkInTime: reservation.checkInTime,
            isVIP: (reservation.customer?.vipScore || 0) > 0,
          });

          // Refresh stats
          get().refreshStats();

          return {
            success: true,
            reservation,
            tableLocation:
              tableLocation ||
              createTableLocation(
                reservation,
                selectedEvent?.venueLayout || null
              ),
            message: "Check-in başarılı!",
            isVIP: (reservation.customer?.vipScore || 0) > 0,
            isBlacklisted: reservation.customer?.isBlacklisted || false,
          };
        } catch (error: any) {
          const errorData = error.response?.data?.error || {};

          if (error.response?.status === 409) {
            return {
              code: "ALREADY_CHECKED_IN" as const,
              message: errorData.message || "Bu misafir zaten giriş yapmış",
              originalCheckInTime: errorData.details?.originalCheckInTime,
            };
          }

          if (error.response?.status === 400) {
            if (errorData.code === "CANCELLED") {
              return {
                code: "CANCELLED" as const,
                message: "Bu rezervasyon iptal edilmiş",
              };
            }
            if (errorData.code === "WRONG_EVENT") {
              return {
                code: "WRONG_EVENT" as const,
                message: "Bu QR kod farklı bir etkinliğe ait",
              };
            }
          }

          if (error.response?.status === 404) {
            return {
              code: "NOT_FOUND" as const,
              message: "Rezervasyon bulunamadı",
            };
          }

          return {
            code: "NETWORK_ERROR" as const,
            message: error.response?.data?.message || "Bağlantı hatası",
          };
        }
      },

      // Manual check-in by reservation ID
      checkInManual: async (reservationId: string) => {
        const { selectedEventId, selectedEvent, reservations } = get();

        if (!selectedEventId) {
          return {
            code: "WRONG_EVENT" as const,
            message: "Lütfen önce bir etkinlik seçin",
          };
        }

        // Find reservation in cache
        let reservation: Reservation | undefined;
        for (const r of reservations.values()) {
          if (r.id === reservationId) {
            reservation = r;
            break;
          }
        }

        if (!reservation) {
          return {
            code: "NOT_FOUND" as const,
            message: "Rezervasyon bulunamadı",
          };
        }

        // Use QR code check-in
        return get().checkIn(reservation.qrCodeHash);
      },

      // Register walk-in guest
      registerWalkIn: async (data: WalkInData) => {
        const { selectedEventId, selectedEvent, isOnline } = get();

        if (!selectedEventId) {
          return {
            code: "WRONG_EVENT" as const,
            message: "Lütfen önce bir etkinlik seçin",
          };
        }

        if (!isOnline) {
          return {
            code: "NETWORK_ERROR" as const,
            message: "Walk-in kayıt için internet bağlantısı gerekli",
          };
        }

        try {
          const response = await checkInApi.registerWalkIn({
            eventId: selectedEventId,
            ...data,
          });

          const { reservation, tableLocation } = response.data;

          // Update cache
          get().updateReservationInCache(reservation);

          // Add to history
          get().addToHistory({
            reservationId: reservation.id,
            guestName: data.guestName,
            tableLabel: tableLocation?.label || "Bilinmiyor",
            guestCount: data.guestCount,
            checkInTime: reservation.checkInTime,
            isVIP: false,
          });

          // Refresh stats
          get().refreshStats();

          return {
            success: true,
            reservation,
            tableLocation:
              tableLocation ||
              createTableLocation(
                reservation,
                selectedEvent?.venueLayout || null
              ),
            message: "Walk-in misafir kaydedildi!",
            isVIP: false,
            isBlacklisted: false,
          };
        } catch (error: any) {
          return {
            code: "NETWORK_ERROR" as const,
            message: error.response?.data?.message || "Kayıt başarısız",
          };
        }
      },

      // Search reservations
      searchReservations: async (query: string) => {
        const { selectedEventId, reservations, isOnline } = get();

        if (!selectedEventId || !query.trim()) {
          return [];
        }

        const queryLower = query.toLowerCase().trim();

        // Search in cache first
        const cachedResults: Reservation[] = [];
        for (const r of reservations.values()) {
          const guestName = (
            r.customer?.fullName ||
            r.guestName ||
            ""
          ).toLowerCase();
          const phone = (r.customer?.phone || r.guestPhone || "").toLowerCase();

          if (guestName.includes(queryLower) || phone.includes(queryLower)) {
            cachedResults.push(r);
          }
        }

        // If offline, return cached results
        if (!isOnline) {
          return cachedResults.slice(0, 20);
        }

        // Online - fetch from API for more accurate results
        try {
          const response = await checkInApi.searchForCheckIn(
            query,
            selectedEventId
          );
          return response.data;
        } catch (error) {
          // Fallback to cached results
          return cachedResults.slice(0, 20);
        }
      },

      // Update guest count
      updateGuestCount: async (reservationId: string, count: number) => {
        const { isOnline } = get();

        if (!isOnline) {
          // TODO: Queue for offline sync
          return;
        }

        try {
          await checkInApi.updateGuestCount(reservationId, count);
          get().refreshStats();
        } catch (error) {
          console.error("[CheckInStore] Guest count update error:", error);
        }
      },

      // Sync offline queue
      syncOfflineQueue: async () => {
        const { offlineQueue, isOnline } = get();

        if (!isOnline || offlineQueue.length === 0) return;

        const pendingItems = offlineQueue.filter(
          (item) => item.status === "pending"
        );

        for (const item of pendingItems) {
          // Update status to syncing
          set({
            offlineQueue: get().offlineQueue.map((q) =>
              q.id === item.id ? { ...q, status: "syncing" as const } : q
            ),
          });

          try {
            await checkInApi.checkIn(item.qrCodeHash);

            // Mark as synced
            set({
              offlineQueue: get().offlineQueue.map((q) =>
                q.id === item.id ? { ...q, status: "synced" as const } : q
              ),
            });
          } catch (error: any) {
            // Mark as failed
            set({
              offlineQueue: get().offlineQueue.map((q) =>
                q.id === item.id
                  ? {
                      ...q,
                      status: "failed" as const,
                      retryCount: q.retryCount + 1,
                      error: error.response?.data?.message || "Sync failed",
                    }
                  : q
              ),
            });
          }
        }

        // Clean up synced items
        set({
          offlineQueue: get().offlineQueue.filter((q) => q.status !== "synced"),
        });

        // Refresh stats after sync
        get().refreshStats();
      },

      // Toggle sound
      toggleSound: () => {
        set({ soundEnabled: !get().soundEnabled });
      },

      // Set online status
      setOnlineStatus: (isOnline: boolean) => {
        const wasOffline = !get().isOnline;
        set({ isOnline });

        // Auto-sync when coming back online
        if (isOnline && wasOffline) {
          get().syncOfflineQueue();
        }
      },

      // Refresh stats
      refreshStats: async () => {
        const { selectedEventId, isOnline } = get();
        if (!selectedEventId || !isOnline) return;

        try {
          const response = await checkInApi.getEventStats(selectedEventId);
          set({ eventStats: response.data });
        } catch (error) {
          console.error("[CheckInStore] Stats refresh error:", error);
        }
      },

      // Refresh history
      refreshHistory: async () => {
        const { selectedEventId, isOnline } = get();
        if (!selectedEventId || !isOnline) return;

        try {
          const response = await checkInApi.getCheckInHistory(selectedEventId);
          set({ checkInHistory: response.data });
        } catch (error) {
          console.error("[CheckInStore] History refresh error:", error);
        }
      },

      // Add to history (local)
      addToHistory: (entry: CheckInHistoryEntry) => {
        const { checkInHistory } = get();
        const newHistory = [entry, ...checkInHistory].slice(0, 20);
        set({ checkInHistory: newHistory });
      },

      // Update reservation in cache
      updateReservationInCache: (reservation: Reservation) => {
        if (!reservation.qrCodeHash) return;

        const newReservations = new Map(get().reservations);
        newReservations.set(reservation.qrCodeHash, reservation);
        set({ reservations: newReservations });
      },

      // Real-time subscriptions
      subscribeToUpdates: (eventId: string) => {
        // Connect socket if not connected
        socketService.connect();

        // Join event room
        socketService.joinEvent(eventId, "check-in");

        // Listen for check-in updates from other devices
        socketService.onGuestCheckedIn((data: CheckInData) => {
          console.log("[CheckInStore] Real-time check-in received:", data);

          // Add to history if not already there
          const { checkInHistory } = get();
          const exists = checkInHistory.some(
            (h) => h.reservationId === data.reservationId
          );

          if (!exists) {
            get().addToHistory({
              reservationId: data.reservationId,
              guestName: data.customerName,
              tableLabel: data.tableLabel || "Bilinmiyor",
              guestCount: data.guestCount,
              checkInTime: data.checkInTime,
              isVIP: false, // Real-time'da VIP bilgisi yok
            });
          }
        });

        // Listen for live stats updates
        socketService.onLiveStats((data: LiveStatsData) => {
          console.log("[CheckInStore] Real-time stats received:", data);

          set({
            eventStats: {
              totalExpected: data.totalExpected,
              checkedIn: data.checkedIn,
              remaining: data.remaining,
              cancelled: data.cancelled,
              noShow: data.noShow,
              checkInPercentage:
                data.totalExpected > 0
                  ? Math.round((data.checkedIn / data.totalExpected) * 100)
                  : 0,
            },
          });
        });

        console.log(
          "[CheckInStore] Subscribed to real-time updates for event:",
          eventId
        );
      },

      unsubscribeFromUpdates: () => {
        // Remove listeners but keep socket connected for other features
        socketService.getSocket()?.off("guestCheckedIn");
        socketService.getSocket()?.off("liveStats");
        console.log("[CheckInStore] Unsubscribed from real-time updates");
      },
    }),
    {
      name: "check-in-storage",
      partialize: (state) => ({
        selectedEventId: state.selectedEventId,
        soundEnabled: state.soundEnabled,
        offlineQueue: state.offlineQueue,
      }),
      // Custom serialization for Map
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          return JSON.parse(str);
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
