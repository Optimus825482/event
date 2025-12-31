"use client";

/**
 * Event Selector Modal - Aktif etkinlik seçimi
 * Requirements: 1.1, 1.3
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  CheckCircle,
  Loader2,
  X,
  MapPin,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkInApi } from "@/lib/api";
import type { ActiveEvent } from "@/store/check-in-store";

interface EventSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (eventId: string) => void;
  currentEventId?: string | null;
}

export function EventSelectorModal({
  isOpen,
  onClose,
  onSelect,
  currentEventId,
}: EventSelectorModalProps) {
  const router = useRouter();
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadEvents();
    }
  }, [isOpen]);

  const loadEvents = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await checkInApi.getActiveEvents();
      setEvents(response.data || []);
    } catch (err: any) {
      console.error("[EventSelector] Load error:", err);
      setError(err.response?.data?.message || "Etkinlikler yüklenemedi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (eventId: string) => {
    onSelect(eventId);
    onClose();
  };

  // Yerleşim planı görünümüne git
  const handleViewLayout = (eventId: string) => {
    onClose();
    router.push(`/check-in/${eventId}/layout`);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Etkinlik Seç</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
              <p className="text-slate-400 text-sm">
                Etkinlikler yükleniyor...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-3">
                <X className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-red-400 text-sm mb-4">{error}</p>
              <Button variant="outline" size="sm" onClick={loadEvents}>
                Tekrar Dene
              </Button>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6 text-slate-500" />
              </div>
              <p className="text-slate-400 text-sm text-center">
                Bugün için aktif etkinlik bulunamadı
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const isSelected = event.id === currentEventId;
                const progress =
                  event.totalCapacity > 0
                    ? Math.round(
                        (event.checkedInCount / event.totalCapacity) * 100
                      )
                    : 0;

                return (
                  <div
                    key={event.id}
                    className={`w-full p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-blue-600/20 border-blue-500"
                        : "bg-slate-700/50 border-slate-600 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-white line-clamp-1">
                        {event.name}
                      </h3>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0 ml-2" />
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(event.eventDate)}
                      </span>
                      <span>{formatTime(event.eventDate)}</span>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {event.checkedInCount} / {event.totalCapacity} giriş
                        </span>
                        <span className="text-slate-500">{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSelect(event.id)}
                        className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        QR/Arama
                      </button>
                      <button
                        onClick={() => handleViewLayout(event.id)}
                        className="flex-1 py-2 px-3 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <MapPin className="w-4 h-4" />
                        Yerleşim Planı
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <Button
            variant="outline"
            className="w-full border-slate-600"
            onClick={onClose}
          >
            İptal
          </Button>
        </div>
      </div>
    </div>
  );
}
