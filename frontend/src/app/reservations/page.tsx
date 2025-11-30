"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  AlertCircle,
  Loader2,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { useEvents } from "@/hooks/use-reservations";
import { formatDate } from "@/lib/utils";
import type { Event } from "@/types";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";

// Etkinlik seçim store'u - basit state management
export const useSelectedEvent = () => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    // localStorage'dan oku
    const stored = localStorage.getItem("selectedEventId");
    if (stored) setSelectedEventId(stored);
  }, []);

  const selectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    localStorage.setItem("selectedEventId", eventId);
  };

  const clearEvent = () => {
    setSelectedEventId(null);
    localStorage.removeItem("selectedEventId");
  };

  return { selectedEventId, selectEvent, clearEvent };
};

// Kalan gün hesaplama
function getDaysRemaining(eventDate: string): number {
  const now = new Date();
  const event = new Date(eventDate);
  const diff = event.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Etkinlik kartı
function EventCard({
  event,
  onSelect,
}: {
  event: Event;
  onSelect: (id: string) => void;
}) {
  const daysRemaining = getDaysRemaining(event.eventDate);
  const isPast = daysRemaining < 0;
  const isToday = daysRemaining === 0;

  return (
    <button
      onClick={() => onSelect(event.id)}
      disabled={isPast}
      className={`w-full p-4 sm:p-6 rounded-xl border-2 text-left transition-all ${
        isPast
          ? "border-slate-700 bg-slate-800/50 opacity-50 cursor-not-allowed"
          : "border-slate-700 bg-slate-800 cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-xl font-semibold mb-2 truncate">
            {event.name}
          </h3>
          <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
              {formatDate(event.eventDate)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 sm:w-4 sm:h-4" />
              {event.venueLayout?.tables?.length || 0} masa
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {isPast ? (
            <span className="px-2 sm:px-3 py-1 bg-slate-700 text-slate-400 rounded-full text-xs sm:text-sm">
              Geçmiş
            </span>
          ) : isToday ? (
            <span className="px-2 sm:px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-xs sm:text-sm">
              Bugün
            </span>
          ) : (
            <span className="px-2 sm:px-3 py-1 bg-blue-600/20 text-blue-400 rounded-full text-xs sm:text-sm">
              {daysRemaining} gün
            </span>
          )}
          {!isPast && (
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          )}
        </div>
      </div>
    </button>
  );
}

export default function ReservationsPage() {
  const router = useRouter();
  const { selectedEventId, selectEvent } = useSelectedEvent();
  const { data: events, isLoading, error } = useEvents();

  // Etkinlik seçildiğinde dashboard'a yönlendir
  const handleSelectEvent = (eventId: string) => {
    selectEvent(eventId);
    router.push(`/reservations/dashboard?eventId=${eventId}`);
  };

  // Eğer zaten seçili etkinlik varsa dashboard'a yönlendir
  useEffect(() => {
    if (selectedEventId) {
      router.push(`/reservations/dashboard?eventId=${selectedEventId}`);
    }
  }, [selectedEventId, router]);

  // Aktif ve geçmiş etkinlikleri ayır
  const activeEvents =
    events?.filter((e) => getDaysRemaining(e.eventDate) >= 0) || [];
  const pastEvents =
    events?.filter((e) => getDaysRemaining(e.eventDate) < 0) || [];

  return (
    <PageContainer maxWidth="4xl">
      <div className="space-y-6">
        <PageHeader
          title="Etkinlik Seçin"
          description="Rezervasyon işlemleri için bir etkinlik seçin"
          icon={<Calendar className="w-6 h-6 text-blue-400" />}
        />

        {isLoading && (
          <div className="flex items-center justify-center py-8 sm:py-12">
            <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-blue-500" />
            <span className="ml-2 text-slate-400 text-sm sm:text-base">
              Yükleniyor...
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-8 sm:py-12 text-red-400">
            <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
            <span className="text-sm sm:text-base">Hata oluştu</span>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Aktif Etkinlikler */}
            {activeEvents.length > 0 && (
              <div>
                <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-slate-300">
                  Aktif Etkinlikler
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  {activeEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onSelect={handleSelectEvent}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Geçmiş Etkinlikler */}
            {pastEvents.length > 0 && (
              <div>
                <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-slate-500">
                  Geçmiş Etkinlikler
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  {pastEvents.slice(0, 5).map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onSelect={handleSelectEvent}
                    />
                  ))}
                </div>
              </div>
            )}

            {events?.length === 0 && (
              <div className="text-center py-8 sm:py-12 text-slate-400">
                <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base">
                  Henüz etkinlik oluşturulmamış
                </p>
                <p className="text-xs sm:text-sm mt-2">
                  Etkinlik modülünden yeni etkinlik oluşturabilirsiniz
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
