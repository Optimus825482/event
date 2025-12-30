"use client";

/**
 * Guest Card - Misafir bilgi kartı
 * Requirements: 2.2, 3.4, 3.5, 12.1
 */

import { useState } from "react";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Users,
  Crown,
  AlertTriangle,
  CheckCircle,
  Minus,
  Plus,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Reservation, TableLocation } from "@/store/check-in-store";

interface GuestCardProps {
  reservation: Reservation;
  tableLocation: TableLocation | null;
  showCheckInButton?: boolean;
  onCheckIn?: () => void;
  onUpdateGuestCount?: (count: number) => void;
  onShowTableLocation?: () => void;
  isLoading?: boolean;
}

export function GuestCard({
  reservation,
  tableLocation,
  showCheckInButton = true,
  onCheckIn,
  onUpdateGuestCount,
  onShowTableLocation,
  isLoading = false,
}: GuestCardProps) {
  const [guestCount, setGuestCount] = useState(reservation.guestCount);

  const customer = reservation.customer;
  const guestName = customer?.fullName || reservation.guestName || "Misafir";
  const guestPhone = customer?.phone || reservation.guestPhone;
  const guestEmail = customer?.email || reservation.guestEmail;
  const isVIP = (customer?.vipScore || 0) > 0;
  const isBlacklisted = customer?.isBlacklisted || false;
  const isCheckedIn = reservation.status === "checked_in";
  const isCancelled = reservation.status === "cancelled";

  const handleGuestCountChange = (delta: number) => {
    const newCount = Math.max(1, guestCount + delta);
    setGuestCount(newCount);
    onUpdateGuestCount?.(newCount);
  };

  const formatCheckInTime = (time: string) => {
    const date = new Date(time);
    return date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isCheckedIn
          ? "bg-green-500/10 border-green-500/30"
          : isCancelled
          ? "bg-red-500/10 border-red-500/30"
          : isBlacklisted
          ? "bg-orange-500/10 border-orange-500/30"
          : isVIP
          ? "bg-yellow-500/10 border-yellow-500/30"
          : "bg-slate-800 border-slate-700"
      }`}
    >
      {/* Header - Badges */}
      <div className="flex items-center gap-2 mb-3">
        {isVIP && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-full">
            <Crown className="w-3 h-3" />
            VIP
          </span>
        )}
        {isBlacklisted && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-full">
            <AlertTriangle className="w-3 h-3" />
            Kara Liste
          </span>
        )}
        {isCheckedIn && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
            <CheckCircle className="w-3 h-3" />
            Giriş Yapıldı
          </span>
        )}
        {isCancelled && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
            İptal
          </span>
        )}
      </div>

      {/* Guest Info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" />
          <span className="text-white font-medium">{guestName}</span>
        </div>

        {guestPhone && (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-400" />
            <a
              href={`tel:${guestPhone}`}
              className="text-slate-300 text-sm hover:text-blue-400 transition-colors"
            >
              {guestPhone}
            </a>
          </div>
        )}

        {guestEmail && (
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300 text-sm truncate">
              {guestEmail}
            </span>
          </div>
        )}
      </div>

      {/* Table & Guest Count */}
      <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg mb-4">
        <div className="flex items-center gap-3">
          {/* Table Location */}
          <button
            onClick={onShowTableLocation}
            className="flex items-center gap-2 hover:text-blue-400 transition-colors"
            disabled={!tableLocation}
          >
            <MapPin className="w-4 h-4 text-blue-400" />
            <span className="text-white font-medium">
              {tableLocation?.label || reservation.table?.label || "Masa"}
            </span>
          </button>

          <div className="w-px h-6 bg-slate-700" />

          {/* Guest Count */}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            {onUpdateGuestCount && !isCheckedIn ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleGuestCountChange(-1)}
                  className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
                  disabled={guestCount <= 1}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-8 text-center text-white font-medium">
                  {guestCount}
                </span>
                <button
                  onClick={() => handleGuestCountChange(1)}
                  className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="text-white">{reservation.guestCount} kişi</span>
            )}
          </div>
        </div>
      </div>

      {/* Check-in Time (if checked in) */}
      {isCheckedIn && reservation.checkInTime && (
        <div className="flex items-center gap-2 text-sm text-green-400 mb-4">
          <Clock className="w-4 h-4" />
          <span>Giriş: {formatCheckInTime(reservation.checkInTime)}</span>
        </div>
      )}

      {/* Special Requests */}
      {reservation.specialRequests && (
        <div className="p-3 bg-slate-900/50 rounded-lg mb-4">
          <p className="text-xs text-slate-400 mb-1">Özel İstek:</p>
          <p className="text-sm text-slate-300">
            {reservation.specialRequests}
          </p>
        </div>
      )}

      {/* Check-in Button */}
      {showCheckInButton && !isCheckedIn && !isCancelled && (
        <Button
          onClick={onCheckIn}
          disabled={isLoading}
          className={`w-full ${
            isBlacklisted
              ? "bg-orange-600 hover:bg-orange-700"
              : isVIP
              ? "bg-yellow-600 hover:bg-yellow-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              İşleniyor...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {isBlacklisted ? "Dikkat! Giriş Yap" : "Giriş Yap"}
            </span>
          )}
        </Button>
      )}

      {/* Table Direction */}
      {tableLocation && isCheckedIn && (
        <button
          onClick={onShowTableLocation}
          className="w-full p-3 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg text-blue-400 text-sm transition-colors"
        >
          <MapPin className="w-4 h-4 inline mr-2" />
          {tableLocation.directionText}
        </button>
      )}
    </div>
  );
}
