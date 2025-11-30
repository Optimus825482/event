"use client";

import { useState } from "react";
import {
  X,
  User,
  Phone,
  Users,
  QrCode,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Mail,
} from "lucide-react";
import { TableInstance, Reservation } from "@/types";
import { formatPhone } from "@/lib/utils";

interface ReservationDetailPanelProps {
  table: TableInstance | null;
  reservation: Reservation | null;
  onClose: () => void;
  onEdit?: (reservation: Reservation) => void;
  onCancel?: (reservationId: string) => void;
  onCheckIn?: (reservationId: string) => void;
  onShowQR?: (reservation: Reservation) => void;
  onCreateReservation?: (table: TableInstance) => void;
}

/**
 * Masa tıklandığında rezervasyon detaylarını gösteren side panel
 * Requirements: 8.2 - Side panel ile detay gösterimi, hızlı düzenleme seçenekleri
 */
export function ReservationDetailPanel({
  table,
  reservation,
  onClose,
  onEdit,
  onCancel,
  onCheckIn,
  onShowQR,
  onCreateReservation,
}: ReservationDetailPanelProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!table) return null;

  // Rezervasyon durumu badge renkleri
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { bg: string; text: string; label: string }
    > = {
      pending: {
        bg: "bg-yellow-500/20",
        text: "text-yellow-400",
        label: "Beklemede",
      },
      confirmed: {
        bg: "bg-blue-500/20",
        text: "text-blue-400",
        label: "Onaylandı",
      },
      checked_in: {
        bg: "bg-green-500/20",
        text: "text-green-400",
        label: "Giriş Yapıldı",
      },
      cancelled: {
        bg: "bg-red-500/20",
        text: "text-red-400",
        label: "İptal Edildi",
      },
      no_show: {
        bg: "bg-slate-500/20",
        text: "text-slate-400",
        label: "Gelmedi",
      },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}
      >
        {config.label}
      </span>
    );
  };

  // Tarih formatla
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // İptal işlemi
  const handleCancel = async () => {
    if (!reservation || !onCancel) return;
    if (!confirm("Bu rezervasyonu iptal etmek istediğinize emin misiniz?"))
      return;

    setIsLoading(true);
    try {
      await onCancel(reservation.id);
    } finally {
      setIsLoading(false);
    }
  };

  // Check-in işlemi
  const handleCheckIn = async () => {
    if (!reservation || !onCheckIn) return;

    setIsLoading(true);
    try {
      await onCheckIn(reservation.id);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-slate-800 shadow-xl z-50 flex flex-col border-l border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div>
          <h2 className="text-lg font-semibold">{table.label}</h2>
          <p className="text-sm text-slate-400">
            {table.typeName} • {table.capacity} kişilik
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 bg-slate-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {reservation ? (
          // Rezervasyon detayları
          <div className="space-y-4">
            {/* Durum */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Durum</span>
              {getStatusBadge(reservation.status)}
            </div>

            {/* Misafir Bilgileri */}
            <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium text-slate-300 mb-2">
                Misafir Bilgileri
              </h3>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium">
                    {reservation.customer?.fullName || "Misafir"}
                  </p>
                  {reservation.customer?.vipScore &&
                    reservation.customer.vipScore >= 70 && (
                      <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-0.5 rounded">
                        VIP
                      </span>
                    )}
                </div>
              </div>

              {reservation.customer?.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {formatPhone(reservation.customer.phone)}
                </div>
              )}

              {reservation.customer?.email && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {reservation.customer.email}
                </div>
              )}
            </div>

            {/* Rezervasyon Detayları */}
            <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium text-slate-300 mb-2">
                Rezervasyon Detayları
              </h3>

              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-slate-400" />
                <span>{reservation.guestCount} Kişi</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{formatDate(reservation.createdAt)}</span>
              </div>

              {reservation.checkInTime && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <Clock className="w-4 h-4" />
                  <span>Giriş: {formatDate(reservation.checkInTime)}</span>
                </div>
              )}

              {reservation.specialRequests && (
                <div className="mt-2 p-2 bg-slate-600/50 rounded text-sm">
                  <p className="text-slate-400 text-xs mb-1">Özel İstekler:</p>
                  <p>{reservation.specialRequests}</p>
                </div>
              )}
            </div>

            {/* Ödeme Bilgisi */}
            {reservation.totalAmount > 0 && (
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Toplam Tutar</span>
                  <span className="font-semibold">
                    ₺{reservation.totalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-slate-400">Ödeme Durumu</span>
                  {reservation.isPaid ? (
                    <span className="text-green-400 text-sm flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Ödendi
                    </span>
                  ) : (
                    <span className="text-yellow-400 text-sm flex items-center gap-1">
                      <XCircle className="w-4 h-4" /> Ödenmedi
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Rezervasyon yok
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-400 mb-4">
              Bu masa için rezervasyon bulunmuyor
            </p>
            {onCreateReservation && (
              <button
                onClick={() => onCreateReservation(table)}
                className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium"
              >
                Rezervasyon Oluştur
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {reservation &&
        reservation.status !== "cancelled" &&
        reservation.status !== "no_show" && (
          <div className="p-4 border-t border-slate-700 space-y-2">
            {/* QR Kod */}
            {onShowQR && (
              <button
                onClick={() => onShowQR(reservation)}
                className="w-full py-2 bg-slate-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                QR Kod Göster
              </button>
            )}

            {/* Check-in (sadece pending/confirmed için) */}
            {onCheckIn &&
              (reservation.status === "pending" ||
                reservation.status === "confirmed") && (
                <button
                  onClick={handleCheckIn}
                  disabled={isLoading}
                  className="w-full py-2 bg-green-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {isLoading ? "İşleniyor..." : "Check-in Yap"}
                </button>
              )}

            {/* Düzenle ve İptal */}
            <div className="flex gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(reservation)}
                  className="flex-1 py-2 bg-slate-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Düzenle
                </button>
              )}
              {onCancel && reservation.status !== "checked_in" && (
                <button
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="flex-1 py-2 bg-red-600/20 text-red-400 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {isLoading ? "..." : "İptal"}
                </button>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
