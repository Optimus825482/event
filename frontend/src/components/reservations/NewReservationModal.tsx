"use client";

import { useState, useMemo } from "react";
import { X, Users, Phone, Mail, User, ChevronDown } from "lucide-react";
import { reservationsApi } from "@/lib/api";
import type { Event, Reservation } from "@/types";

interface NewReservationModalProps {
  event: Event;
  reservations: Reservation[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onTableSelect?: (tableId: string | null) => void;
}

export function NewReservationModal({
  event,
  reservations,
  isOpen,
  onClose,
  onSuccess,
  onTableSelect,
}: NewReservationModalProps) {
  const [formData, setFormData] = useState({
    guestName: "",
    guestPhone: "",
    guestEmail: "",
    guestCount: 1,
    tableId: "",
    specialRequests: "",
  });
  const [showOptional, setShowOptional] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rezerve edilmiş masa ID'lerini bul
  const reservedTableIds = useMemo(() => {
    return new Set(
      reservations
        .filter((r) => r.status !== "cancelled")
        .map((r) => r.tableId),
    );
  }, [reservations]);

  // Mevcut layout'tan masaları çıkar ve rezervasyon durumunu ekle
  const availableTables = useMemo(() => {
    if (!event.venueLayout?.tables) return [];
    return event.venueLayout.tables.map((table: any) => {
      const isReserved = reservedTableIds.has(table.id);
      return {
        id: table.id,
        label: table.isLoca
          ? `Loca ${table.locaName}`
          : `Masa ${table.tableNumber}`,
        capacity: table.capacity || 0,
        isReserved,
      };
    });
  }, [event, reservedTableIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.tableId) {
      setError("Lütfen bir masa seçin");
      return;
    }

    setSubmitting(true);

    try {
      await reservationsApi.create({
        eventId: event.id,
        tableId: formData.tableId,
        guestCount: formData.guestCount,
        guestName: formData.guestName,
        guestPhone: formData.guestPhone,
        guestEmail: formData.guestEmail || undefined,
        specialRequests: formData.specialRequests || undefined,
      });
      onSuccess();
      onTableSelect?.(null);
      onClose();
      // Reset form
      setFormData({
        guestName: "",
        guestPhone: "",
        guestEmail: "",
        guestCount: 1,
        tableId: "",
        specialRequests: "",
      });
      setShowOptional(false);
    } catch (err: any) {
      setError(err.response?.data?.message || "Rezervasyon oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center md:justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-600 rounded-2xl md:rounded-l-2xl md:rounded-r-none w-full max-w-lg md:max-w-md md:h-full mx-4 md:mx-0 shadow-2xl flex flex-col animate-in slide-in-from-right md:slide-in-from-right-full duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Yeni Rezervasyon</h2>
            <p className="text-xs text-slate-400 mt-0.5">{event.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 space-y-3"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-2.5 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Masa Seçimi */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Masa / Loca
            </label>
            <select
              required
              value={formData.tableId}
              onChange={(e) => {
                setFormData({ ...formData, tableId: e.target.value });
                onTableSelect?.(e.target.value || null);
              }}
              className="w-full h-10 bg-slate-700/50 border border-slate-600 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="">Masa seçin...</option>
              {availableTables.map((table) => (
                <option
                  key={table.id}
                  value={table.id}
                  disabled={table.isReserved}
                >
                  {table.label} (Kap: {table.capacity})
                  {table.isReserved ? " - Dolu" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Misafir Adı */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              <User className="w-3.5 h-3.5 inline mr-1" />
              Misafir Adı
            </label>
            <input
              type="text"
              required
              value={formData.guestName}
              onChange={(e) =>
                setFormData({ ...formData, guestName: e.target.value })
              }
              className="w-full h-10 bg-slate-700/50 border border-slate-600 rounded-lg px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              placeholder="Ad Soyad"
            />
          </div>

          {/* Kişi Sayısı */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              <Users className="w-3.5 h-3.5 inline mr-1" />
              Kişi Sayısı
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.guestCount}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  guestCount: parseInt(e.target.value) || 1,
                })
              }
              className="w-full h-10 bg-slate-700/50 border border-slate-600 rounded-lg px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          {/* Detay Ekle Butonu */}
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="w-full flex items-center justify-between h-9 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 text-xs text-slate-300 transition-colors"
          >
            <span>Detay Ekle (Telefon, Email, Not)</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showOptional ? "rotate-180" : ""}`}
            />
          </button>

          {/* Opsiyonel Alanlar */}
          {showOptional && (
            <div className="space-y-3 pt-1">
              {/* Telefon */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  <Phone className="w-3.5 h-3.5 inline mr-1" />
                  Telefon (opsiyonel)
                </label>
                <input
                  type="tel"
                  value={formData.guestPhone}
                  onChange={(e) =>
                    setFormData({ ...formData, guestPhone: e.target.value })
                  }
                  className="w-full h-10 bg-slate-700/50 border border-slate-600 rounded-lg px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  placeholder="0555 123 45 67"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  <Mail className="w-3.5 h-3.5 inline mr-1" />
                  Email (opsiyonel)
                </label>
                <input
                  type="email"
                  value={formData.guestEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, guestEmail: e.target.value })
                  }
                  className="w-full h-10 bg-slate-700/50 border border-slate-600 rounded-lg px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  placeholder="ornek@email.com"
                />
              </div>

              {/* Özel İstekler */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Özel İstekler (opsiyonel)
                </label>
                <textarea
                  value={formData.specialRequests}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      specialRequests: e.target.value,
                    })
                  }
                  rows={2}
                  maxLength={500}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none"
                  placeholder="Özel istekler, notlar..."
                />
              </div>
            </div>
          )}
        </form>

        {/* Buttons */}
        <div className="flex gap-2 p-4 border-t border-slate-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 h-10 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Oluşturuluyor..." : "Oluştur"}
          </button>
        </div>
      </div>
    </div>
  );
}
