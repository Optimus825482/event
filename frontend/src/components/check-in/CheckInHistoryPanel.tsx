"use client";

/**
 * Check-in History Panel - Son check-in'ler
 * Requirements: 6.1, 6.2, 6.3
 */

import { Clock, User, MapPin, Users, Crown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCheckInStore } from "@/store/check-in-store";
import type { CheckInHistoryEntry } from "@/store/check-in-store";

interface CheckInHistoryPanelProps {
  onSelectEntry?: (entry: CheckInHistoryEntry) => void;
  onRefresh?: () => void;
}

export function CheckInHistoryPanel({
  onSelectEntry,
  onRefresh,
}: CheckInHistoryPanelProps) {
  const { checkInHistory, refreshHistory, isLoading } = useCheckInStore();

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (timeStr: string) => {
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Az önce";
    if (diffMins < 60) return `${diffMins} dk önce`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} saat önce`;

    return formatTime(timeStr);
  };

  const handleRefresh = async () => {
    await refreshHistory();
    onRefresh?.();
  };

  if (checkInHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-white font-medium mb-1">Henüz Giriş Yok</h3>
        <p className="text-slate-400 text-sm text-center">
          Check-in yapıldığında burada görünecek
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          Son Girişler
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="text-slate-400 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* History List */}
      <div className="space-y-2">
        {checkInHistory.map((entry, index) => (
          <button
            key={`${entry.reservationId}-${index}`}
            onClick={() => onSelectEntry?.(entry)}
            className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors text-left"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    entry.isVIP ? "bg-yellow-500/20" : "bg-slate-700"
                  }`}
                >
                  {entry.isVIP ? (
                    <Crown className="w-5 h-5 text-yellow-400" />
                  ) : (
                    <User className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                {/* Info */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">
                      {entry.guestName}
                    </span>
                    {entry.isVIP && (
                      <span className="text-xs text-yellow-400 bg-yellow-500/20 px-1.5 py-0.5 rounded">
                        VIP
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {entry.tableLabel}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {entry.guestCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Time */}
              <div className="text-right">
                <div className="text-sm text-slate-400">
                  {formatTime(entry.checkInTime)}
                </div>
                <div className="text-xs text-slate-500">
                  {formatRelativeTime(entry.checkInTime)}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-500">
        Son {checkInHistory.length} giriş gösteriliyor
      </div>
    </div>
  );
}
