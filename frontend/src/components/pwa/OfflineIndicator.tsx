"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi, CloudOff, RefreshCw } from "lucide-react";
import { usePWAStore } from "@/store/pwa-store";
import { cn } from "@/lib/utils";

interface OfflineIndicatorProps {
  className?: string;
}

export function OfflineIndicator({ className }: OfflineIndicatorProps) {
  const { isOnline, pendingSyncCount } = usePWAStore();
  const [isVisible, setIsVisible] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setIsVisible(true);
      setShowReconnected(false);
    } else if (isVisible) {
      // Show "reconnected" message briefly
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setShowReconnected(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ease-in-out",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium",
          showReconnected
            ? "bg-green-600 text-white"
            : "bg-amber-500 text-amber-950"
        )}
      >
        {showReconnected ? (
          <>
            <Wifi className="w-4 h-4" />
            <span>Bağlantı sağlandı</span>
            {pendingSyncCount > 0 && (
              <span className="flex items-center gap-1 ml-2">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {pendingSyncCount} işlem senkronize ediliyor...
              </span>
            )}
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Çevrimdışı - İnternet bağlantınız yok</span>
            {pendingSyncCount > 0 && (
              <span className="flex items-center gap-1 ml-2 text-amber-800">
                <CloudOff className="w-3 h-3" />
                {pendingSyncCount} bekleyen işlem
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default OfflineIndicator;
