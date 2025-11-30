"use client";

import { useState, useEffect, useCallback } from "react";
import {
  QrCode,
  Camera,
  CheckCircle,
  XCircle,
  Users,
  MapPin,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
  CloudOff,
  Cloud,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useCheckInStore } from "@/store/checkin-store";
import { QRScanner } from "@/components/ui/qr-scanner";
import { socketService } from "@/lib/socket";
import { useEvents, useEventStats } from "@/hooks/use-reservations";
import { PageContainer, StatsGrid } from "@/components/ui/PageContainer";

export default function CheckInPage() {
  const [manualCode, setManualCode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [liveStats, setLiveStats] = useState<{
    totalExpected: number;
    checkedIn: number;
    remaining: number;
    cancelled: number;
    noShow: number;
  } | null>(null);
  const [liveCheckIns, setLiveCheckIns] = useState<
    Array<{
      reservationId: string;
      tableId: string;
      tableLabel?: string;
      customerName: string;
      guestCount: number;
      checkInTime: string;
    }>
  >([]);

  // Zustand store
  const {
    isOnline,
    offlineQueue,
    queueCount,
    syncStatus,
    lastCheckInResult,
    recentCheckIns,
    isLoading,
    performCheckIn,
    syncQueue,
    retryFailed,
    clearSynced,
    removeFromQueue,
    clearLastResult,
    initializeAutoSync,
    cleanupAutoSync,
    setOnlineStatus,
  } = useCheckInStore();

  // Events listesi
  const { data: events } = useEvents();

  // Event istatistikleri (API'den)
  const { data: apiStats } = useEventStats(selectedEventId);

  // Stats: Live stats varsa onu kullan, yoksa API'den gelen
  const stats = liveStats ||
    apiStats || {
      totalExpected: 0,
      checkedIn: 0,
      remaining: 0,
      cancelled: 0,
      noShow: 0,
    };

  // Component mount - Offline sync
  useEffect(() => {
    initializeAutoSync();

    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      cleanupAutoSync();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [initializeAutoSync, cleanupAutoSync, setOnlineStatus]);

  // Socket.io bağlantısı ve real-time güncellemeler
  useEffect(() => {
    if (!selectedEventId) return;

    // Socket bağlantısını başlat
    socketService.connect();
    socketService.joinEvent(selectedEventId, "door_staff");

    // Live stats listener (Requirement 5.2)
    socketService.onLiveStats((data) => {
      console.log("[CheckIn] Live stats received:", data);
      setLiveStats({
        totalExpected: data.totalExpected,
        checkedIn: data.checkedIn,
        remaining: data.remaining,
        cancelled: data.cancelled || 0,
        noShow: data.noShow || 0,
      });
    });

    // Guest check-in listener (Requirement 5.3)
    socketService.onGuestCheckedIn((data) => {
      console.log("[CheckIn] Guest checked in:", data);
      setLiveCheckIns((prev) => [data, ...prev.slice(0, 9)]);
    });

    return () => {
      socketService.leaveEvent();
      socketService.removeAllListeners();
    };
  }, [selectedEventId]);

  // İlk event'i otomatik seç
  useEffect(() => {
    if (events && events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  const handleCheckIn = useCallback(
    async (code: string) => {
      if (!code.trim()) return;

      // Aynı kodu tekrar okumayı engelle (3 saniye içinde)
      if (lastScannedCode === code) return;
      setLastScannedCode(code);
      setTimeout(() => setLastScannedCode(null), 3000);

      // Check-in yap - stats socket üzerinden otomatik güncellenecek
      await performCheckIn(code, selectedEventId);
      setManualCode("");
    },
    [lastScannedCode, performCheckIn, selectedEventId]
  );

  // QR Scanner callback
  const handleQRScan = useCallback(
    (decodedText: string) => {
      handleCheckIn(decodedText);
    },
    [handleCheckIn]
  );

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCheckIn(manualCode);
  };

  return (
    <PageContainer maxWidth="4xl">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Check-in</h1>
            <p className="text-slate-400 text-sm sm:text-base">
              QR kod okutarak giriş yapın
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            {/* Event seçici */}
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm w-full sm:min-w-[200px]"
            >
              <option value="">Etkinlik Seçin</option>
              {events?.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 sm:gap-4">
              {queueCount.unsynced > 0 && (
                <span className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs sm:text-sm">
                  <CloudOff className="w-3 h-3 sm:w-4 sm:h-4" />
                  {queueCount.unsynced}
                </span>
              )}
              {isOnline ? (
                <span className="flex items-center gap-1 sm:gap-2 text-green-400 text-xs sm:text-sm">
                  <Wifi className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Çevrimiçi</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 sm:gap-2 text-yellow-400 text-xs sm:text-sm">
                  <WifiOff className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Çevrimdışı</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <StatsGrid columns={3}>
          <div className="bg-slate-800 rounded-xl p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-blue-400">
              {stats.totalExpected}
            </p>
            <p className="text-slate-400 text-xs sm:text-sm">Beklenen</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-green-400">
              {stats.checkedIn}
            </p>
            <p className="text-slate-400 text-xs sm:text-sm">Giriş</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 sm:p-4 text-center">
            <p className="text-2xl sm:text-3xl font-bold text-yellow-400">
              {stats.remaining}
            </p>
            <p className="text-slate-400 text-xs sm:text-sm">Kalan</p>
          </div>
        </StatsGrid>

        {/* Offline Queue Panel */}
        {queueCount.unsynced > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3">
              <div className="flex items-center gap-2">
                <CloudOff className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                <h3 className="font-semibold text-yellow-400 text-sm sm:text-base">
                  Çevrimdışı Kuyruk ({queueCount.unsynced})
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {isOnline && (
                  <button
                    onClick={() => syncQueue()}
                    disabled={syncStatus.isSyncing}
                    className="flex items-center gap-1 px-2 sm:px-3 py-1 bg-yellow-500 text-black rounded-lg text-xs sm:text-sm font-medium disabled:opacity-50"
                  >
                    {syncStatus.isSyncing ? (
                      <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                    ) : (
                      <Cloud className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                    <span className="hidden sm:inline">
                      {syncStatus.isSyncing ? "Senkronize..." : "Senkronize Et"}
                    </span>
                    <span className="sm:hidden">Sync</span>
                  </button>
                )}
                {queueCount.total > queueCount.unsynced && (
                  <button
                    onClick={() => clearSynced()}
                    className="flex items-center gap-1 px-2 sm:px-3 py-1 bg-slate-700 text-slate-300 rounded-lg text-xs sm:text-sm"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2 max-h-32 sm:max-h-40 overflow-y-auto">
              {offlineQueue
                .filter((item) => !item.synced)
                .slice(0, 3)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-1.5 sm:py-2 px-2 sm:px-3 bg-slate-800/50 rounded-lg text-xs sm:text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {item.error ? (
                        <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                      ) : (
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400" />
                      )}
                      <span className="font-mono truncate max-w-[100px] sm:max-w-[150px]">
                        {item.qrCodeHash.substring(0, 12)}...
                      </span>
                    </div>
                    <button
                      onClick={() => removeFromQueue(item.id)}
                      className="p-1 text-slate-500"
                    >
                      <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* QR Scanner Area */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              <h2 className="text-base sm:text-lg font-semibold">QR Okuyucu</h2>
            </div>
            <button
              onClick={() => setShowScanner(!showScanner)}
              className={`px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm transition-colors ${
                showScanner ? "bg-red-600/20 text-red-400" : "bg-blue-600"
              }`}
            >
              {showScanner ? "Kapat" : "Aç"}
            </button>
          </div>

          {/* QR Scanner */}
          {showScanner ? (
            <div className="flex justify-center mb-4">
              <QRScanner
                onScan={handleQRScan}
                onError={(err) => console.error("[CheckIn] QR hata:", err)}
                width={280}
                height={280}
              />
            </div>
          ) : (
            <div className="aspect-video bg-slate-900 rounded-lg flex items-center justify-center mb-4 border-2 border-dashed border-slate-700 max-h-48 sm:max-h-64">
              <div className="text-center p-4">
                <QrCode className="w-12 h-12 sm:w-16 sm:h-16 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm sm:text-base">
                  QR kod okutmak için kamerayı açın
                </p>
              </div>
            </div>
          )}

          {/* Manuel kod girişi */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Manuel kod girişi..."
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isLoading || !manualCode.trim()}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 rounded-lg font-medium disabled:opacity-50 text-sm sm:text-base"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : (
                <span className="hidden sm:inline">Kontrol Et</span>
              )}
              {!isLoading && <span className="sm:hidden">Gönder</span>}
            </button>
          </form>
        </div>

        {/* Result */}
        {lastCheckInResult && (
          <div className="mb-6">
            <Alert
              variant={lastCheckInResult.success ? "success" : "destructive"}
              onClose={clearLastResult}
              icon={
                lastCheckInResult.success ? (
                  lastCheckInResult.isOffline ? (
                    <CloudOff className="w-5 h-5" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )
                ) : (
                  <XCircle className="w-5 h-5" />
                )
              }
              className="p-6"
            >
              <AlertTitle className="text-xl">
                {lastCheckInResult.message}
              </AlertTitle>
              {lastCheckInResult.reservation && (
                <AlertDescription>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-400 text-sm">Misafir</p>
                      <p className="text-white font-medium">
                        {lastCheckInResult.reservation.customerName}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Masa</p>
                      <p className="text-white font-medium flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {lastCheckInResult.reservation.tableLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Kişi Sayısı</p>
                      <p className="text-white font-medium flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {lastCheckInResult.reservation.guestCount} kişi
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Etkinlik</p>
                      <p className="text-white font-medium">
                        {lastCheckInResult.reservation.eventName}
                      </p>
                    </div>
                  </div>
                </AlertDescription>
              )}
              {lastCheckInResult.isOffline && (
                <AlertDescription>
                  <p className="mt-2 text-yellow-400 text-sm">
                    Bu check-in çevrimdışı kaydedildi. İnternet bağlantısı
                    sağlandığında otomatik olarak senkronize edilecek.
                  </p>
                </AlertDescription>
              )}
            </Alert>
          </div>
        )}

        {/* Recent Check-ins - Live + Local */}
        {(liveCheckIns.length > 0 || recentCheckIns.length > 0) && (
          <div className="bg-slate-800 rounded-xl p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
              Son Girişler
              {liveCheckIns.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] sm:text-xs rounded-full">
                  Canlı
                </span>
              )}
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {/* Live check-in'ler (socket'ten) */}
              {liveCheckIns.slice(0, 5).map((checkin, index) => (
                <div
                  key={`live-${index}`}
                  className="flex items-center justify-between py-1.5 sm:py-2 border-b border-slate-700 last:border-0"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">
                        {checkin.customerName}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-400">
                        {checkin.tableLabel || checkin.tableId}
                        {checkin.guestCount && ` • ${checkin.guestCount}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-xs text-slate-500 flex-shrink-0">
                    {new Date(checkin.checkInTime).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
              {/* Local check-in'ler (bu cihazdan) */}
              {recentCheckIns
                .slice(0, 5 - liveCheckIns.length)
                .map((checkin, index) => (
                  <div
                    key={`local-${index}`}
                    className="flex items-center justify-between py-1.5 sm:py-2 border-b border-slate-700 last:border-0"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      {checkin.isOffline ? (
                        <CloudOff className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm sm:text-base truncate">
                          {checkin.reservation?.customerName || "Çevrimdışı"}
                        </p>
                        <p className="text-xs sm:text-sm text-slate-400">
                          {checkin.reservation?.tableLabel || "Bekliyor"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] sm:text-xs text-slate-500 flex-shrink-0">
                      {checkin.isOffline ? "Offline" : "Az önce"}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
