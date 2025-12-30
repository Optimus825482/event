"use client";

/**
 * Event Stats Dashboard - Etkinlik istatistikleri
 * Requirements: 5.1, 5.3, 5.4
 */

import { Users, UserCheck, UserX, Clock, TrendingUp } from "lucide-react";
import type { EventStats } from "@/store/check-in-store";

interface EventStatsDashboardProps {
  stats: EventStats | null;
  eventName?: string;
  isRealtime?: boolean;
  compact?: boolean;
}

export function EventStatsDashboard({
  stats,
  eventName,
  isRealtime = false,
  compact = false,
}: EventStatsDashboardProps) {
  if (!stats) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-700 rounded w-1/3" />
          <div className="h-8 bg-slate-700 rounded" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-12 bg-slate-700 rounded" />
            <div className="h-12 bg-slate-700 rounded" />
            <div className="h-12 bg-slate-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  const {
    totalExpected,
    checkedIn,
    remaining,
    cancelled,
    noShow,
    checkInPercentage,
  } = stats;

  if (compact) {
    return (
      <div className="flex items-center gap-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-green-400" />
          <span className="text-white font-medium">{checkedIn}</span>
          <span className="text-slate-400 text-sm">/ {totalExpected}</span>
        </div>
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${checkInPercentage}%` }}
          />
        </div>
        <span className="text-slate-400 text-sm font-medium">
          {Math.round(checkInPercentage)}%
        </span>
        {isRealtime && (
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            {eventName && (
              <h3 className="text-white font-medium mb-1 line-clamp-1">
                {eventName}
              </h3>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <TrendingUp className="w-4 h-4" />
              <span>Check-in İstatistikleri</span>
              {isRealtime && (
                <span className="flex items-center gap-1 text-green-400">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Canlı
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">
              {Math.round(checkInPercentage)}%
            </div>
            <div className="text-xs text-slate-400">Tamamlandı</div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3 bg-slate-900/50">
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${checkInPercentage}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>{checkedIn} giriş yapıldı</span>
          <span>{remaining} kalan</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 divide-x divide-slate-700">
        <StatItem
          icon={<Users className="w-4 h-4" />}
          label="Beklenen"
          value={totalExpected}
          color="text-blue-400"
        />
        <StatItem
          icon={<UserCheck className="w-4 h-4" />}
          label="Giriş"
          value={checkedIn}
          color="text-green-400"
        />
        <StatItem
          icon={<Clock className="w-4 h-4" />}
          label="Kalan"
          value={remaining}
          color="text-yellow-400"
        />
        <StatItem
          icon={<UserX className="w-4 h-4" />}
          label="İptal/No-show"
          value={cancelled + noShow}
          color="text-red-400"
        />
      </div>
    </div>
  );
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

function StatItem({ icon, label, value, color }: StatItemProps) {
  return (
    <div className="p-3 text-center">
      <div className={`flex justify-center mb-1 ${color}`}>{icon}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
