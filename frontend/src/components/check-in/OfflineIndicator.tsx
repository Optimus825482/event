"use client";

/**
 * Offline Indicator - Çevrimdışı durum göstergesi
 * Requirements: 8.3, 8.4
 */

import { useState, useEffect } from "react";
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCheckInStore } from "@/store/check-in-store";
import {
  getQueueStatus,
  syncQueue,
  type QueueStatus,
} from "@/lib/offline-check-in-queue";

interface OfflineIndicatorProps {
  compact?: boolean;
  showSyncButton?: boolean;
}

export function OfflineIndicator({
  compact = false,
  showSyncButton = true,
}: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<
    "success" | "error" | null
  >(null);

  const { setOnlineStatus, syncOfflineQueue } = useCheckInStore();

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setOnlineStatus(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setOnlineStatus(false);
    };

    // Initial state
    setIsOnline(navigator.onLine);
    setOnlineStatus(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnlineStatus]);

  // Queue status polling
  useEffect(() => {
    const updateQueueStatus = async () => {
      const status = await getQueueStatus();
      setQueueStatus(status);
    };

    updateQueueStatus();
    const interval = setInterval(updateQueueStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    setLastSyncResult(null);

    try {
      await syncOfflineQueue();
      const result = await syncQueue();
      setLastSyncResult(result.success ? "success" : "error");

      // Update queue status
      const status = await getQueueStatus();
      setQueueStatus(status);

      // Clear result after 3 seconds
      setTimeout(() => setLastSyncResult(null), 3000);
    } catch (error) {
      setLastSyncResult("error");
    } finally {
      setIsSyncing(false);
    }
  };

  const pendingCount = queueStatus?.pending || 0;
  const failedCount = queueStatus?.failed || 0;
  const hasPending = pendingCount > 0 || failedCount > 0;

  // Compact mode - just an icon
  if (compact) {
    if (isOnline && !hasPending) return null;

    return (
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 rounded-full">
            <WifiOff className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400">Çevrimdışı</span>
          </div>
        ) : hasPending ? (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded-full hover:bg-yellow-500/30 transition-colors"
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4 text-yellow-400" />
            )}
            <span className="text-xs text-yellow-400">
              {pendingCount + failedCount}
            </span>
          </button>
        ) : null}
      </div>
    );
  }

  // Full mode
  return (
    <div
      className={`p-3 rounded-lg border ${
        !isOnline
          ? "bg-red-500/10 border-red-500/30"
          : hasPending
          ? "bg-yellow-500/10 border-yellow-500/30"
          : "bg-green-500/10 border-green-500/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Status Icon */}
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              !isOnline
                ? "bg-red-500/20"
                : hasPending
                ? "bg-yellow-500/20"
                : "bg-green-500/20"
            }`}
          >
            {!isOnline ? (
              <WifiOff className="w-5 h-5 text-red-400" />
            ) : hasPending ? (
              <CloudOff className="w-5 h-5 text-yellow-400" />
            ) : (
              <Wifi className="w-5 h-5 text-green-400" />
            )}
          </div>

          {/* Status Text */}
          <div>
            <div
              className={`font-medium ${
                !isOnline
                  ? "text-red-400"
                  : hasPending
                  ? "text-yellow-400"
                  : "text-green-400"
              }`}
            >
              {!isOnline
                ? "Çevrimdışı"
                : hasPending
                ? "Senkronizasyon Bekliyor"
                : "Bağlı"}
            </div>
            <div className="text-xs text-slate-400">
              {!isOnline
                ? "İnternet bağlantısı yok"
                : hasPending
                ? `${pendingCount} bekleyen, ${failedCount} başarısız`
                : "Tüm veriler güncel"}
            </div>
          </div>
        </div>

        {/* Sync Button */}
        {showSyncButton && isOnline && hasPending && (
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            size="sm"
            variant="outline"
            className={`border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20 ${
              lastSyncResult === "success"
                ? "border-green-500/50 text-green-400"
                : lastSyncResult === "error"
                ? "border-red-500/50 text-red-400"
                : ""
            }`}
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : lastSyncResult === "success" ? (
              <Check className="w-4 h-4" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span className="ml-1">
              {isSyncing
                ? "Senkronize ediliyor..."
                : lastSyncResult === "success"
                ? "Tamamlandı"
                : "Senkronize Et"}
            </span>
          </Button>
        )}
      </div>

      {/* Offline Warning */}
      {!isOnline && (
        <div className="mt-3 p-2 bg-slate-900/50 rounded text-xs text-slate-400">
          Check-in işlemleri yerel olarak kaydedilecek ve bağlantı sağlandığında
          otomatik olarak senkronize edilecektir.
        </div>
      )}
    </div>
  );
}
