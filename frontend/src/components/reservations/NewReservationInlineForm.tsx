"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  X,
  Users,
  Phone,
  Mail,
  User,
  ChevronDown,
  ArrowLeft,
  Loader2,
  Check,
} from "lucide-react";
import { reservationsApi } from "@/lib/api";
import type { Event, Reservation } from "@/types";

interface NewReservationInlineFormProps {
  event: Event;
  reservations: Reservation[];
  onCancel: () => void;
  onSuccess: () => void;
  onTableSelect?: (tableId: string | null) => void;
}

export function NewReservationInlineForm({
  event,
  reservations,
  onCancel,
  onSuccess,
  onTableSelect,
}: NewReservationInlineFormProps) {
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
  const [tableDropdownOpen, setTableDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Dropdown dışına tıklayınca kapat
  useEffect(() => {
    if (!tableDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setTableDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tableDropdownOpen]);

  // Her masa için toplam rezerve kişi sayısını hesapla
  const tableGuestCounts = useMemo(() => {
    const counts = new Map<string, number>();
    reservations
      .filter((r) => r.status !== "cancelled")
      .forEach((r) => {
        counts.set(
          r.tableId,
          (counts.get(r.tableId) || 0) + (r.guestCount || 0),
        );
      });
    return counts;
  }, [reservations]);

  const availableTables = useMemo(() => {
    const tables =
      event.venueLayout?.tables ||
      (event.venueLayout as any)?.placedTables ||
      [];
    if (tables.length === 0) return [];
    return tables.map((table: any) => {
      const capacity = table.capacity || 0;
      const usedGuests = tableGuestCounts.get(table.id) || 0;
      const remaining = capacity - usedGuests;
      const isFull = remaining <= 0;
      return {
        id: table.id,
        label: table.isLoca
          ? `Loca ${table.locaName || table.label || ""}`
          : table.label || `Masa ${table.tableNumber}`,
        capacity,
        remaining,
        isFull,
      };
    });
  }, [event, tableGuestCounts]);

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
      onTableSelect?.(null);
      setFormData({
        guestName: "",
        guestPhone: "",
        guestEmail: "",
        guestCount: 1,
        tableId: "",
        specialRequests: "",
      });
      setShowOptional(false);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || "Rezervasyon oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onTableSelect?.(null);
              onCancel();
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-300">
            Yeni Rezervasyon
          </span>
        </div>
        <button
          onClick={() => {
            onTableSelect?.(null);
            onCancel();
          }}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-2.5 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Masa Seçimi — Custom Dropdown */}
        <div ref={dropdownRef}>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Masa / Loca
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setTableDropdownOpen(!tableDropdownOpen)}
              className={`w-full h-11 flex items-center justify-between rounded-xl px-3 text-sm transition-all border ${
                formData.tableId
                  ? "bg-purple-600/20 border-purple-500/50 text-purple-200"
                  : "bg-slate-700/50 border-slate-600 text-slate-400"
              } focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20`}
            >
              {formData.tableId
                ? (() => {
                    const sel = availableTables.find(
                      (t) => t.id === formData.tableId,
                    );
                    return sel ? (
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-400 shadow-lg shadow-purple-400/50" />
                        <span className="font-medium text-white">
                          {sel.label}
                        </span>
                        <span className="text-xs text-purple-300/70">
                          ({sel.remaining}/{sel.capacity} boş)
                        </span>
                      </span>
                    ) : (
                      "Masa seçin..."
                    );
                  })()
                : "Masa seçin..."}
              <ChevronDown
                className={`w-4 h-4 transition-transform ${tableDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {tableDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full max-h-[240px] overflow-y-auto bg-slate-800 border border-slate-600 rounded-xl shadow-2xl shadow-black/40">
                {availableTables.map((table) => {
                  const isSelected = formData.tableId === table.id;
                  return (
                    <button
                      key={table.id}
                      type="button"
                      disabled={table.isFull}
                      onClick={() => {
                        setFormData({ ...formData, tableId: table.id });
                        onTableSelect?.(table.id);
                        setTableDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                        table.isFull
                          ? "text-slate-600 cursor-not-allowed"
                          : isSelected
                            ? "bg-purple-600/30 text-white"
                            : "text-slate-300 hover:bg-slate-700/80 hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-purple-400" />
                        )}
                        <span className={isSelected ? "font-medium" : ""}>
                          {table.label}
                        </span>
                      </span>
                      <span
                        className={`text-xs ${
                          table.isFull
                            ? "text-red-500/60"
                            : table.remaining < table.capacity
                              ? "text-yellow-400/70"
                              : "text-green-400/70"
                        }`}
                      >
                        {table.isFull
                          ? "Dolu"
                          : table.remaining < table.capacity
                            ? `${table.remaining}/${table.capacity} boş`
                            : `${table.capacity} kişilik`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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

        {/* Detay Ekle */}
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

        {showOptional && (
          <div className="space-y-3 pt-1">
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
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Özel İstekler (opsiyonel)
              </label>
              <textarea
                value={formData.specialRequests}
                onChange={(e) =>
                  setFormData({ ...formData, specialRequests: e.target.value })
                }
                rows={2}
                maxLength={500}
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none"
                placeholder="Özel istekler, notlar..."
              />
            </div>
          </div>
        )}

        {/* Butonlar */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              onTableSelect?.(null);
              onCancel();
            }}
            className="flex-1 h-10 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 h-10 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              "Oluştur"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
