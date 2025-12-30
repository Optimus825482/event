"use client";

import { useState, useMemo } from "react";
import {
  Calendar,
  MapPin,
  Users,
  ChevronRight,
  Search,
  Filter,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Event } from "../types";

const EVENT_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  planning: {
    label: "Planlama",
    color: "text-yellow-400",
    bg: "bg-yellow-500/20 border-yellow-500/30",
  },
  ready: {
    label: "Hazır",
    color: "text-blue-400",
    bg: "bg-blue-500/20 border-blue-500/30",
  },
  completed: {
    label: "Tamamlandı",
    color: "text-green-400",
    bg: "bg-green-500/20 border-green-500/30",
  },
  cancelled: {
    label: "İptal",
    color: "text-red-400",
    bg: "bg-red-500/20 border-red-500/30",
  },
};

interface EventAssignmentModuleProps {
  events: Event[];
  loading: boolean;
  onSelectEvent: (eventId: string, hasTeamAssignment: boolean) => void;
}

export function EventAssignmentModule({
  events,
  loading,
  onSelectEvent,
}: EventAssignmentModuleProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Filtrelenmiş etkinlikler
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Arama filtresi
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = event.name.toLowerCase().includes(query);
        const matchesVenue = event.venue?.name?.toLowerCase().includes(query);
        if (!matchesName && !matchesVenue) return false;
      }

      // Durum filtresi
      if (statusFilter !== "all" && event.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [events, searchQuery, statusFilter]);

  // Etkinlikleri tarihe göre grupla ve sırala (en yeni üstte)
  const groupedEvents = useMemo(() => {
    const groups: Record<string, Event[]> = {
      upcoming: [],
      today: [],
      past: [],
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Önce tarihe göre azalan sırala (en yeni üstte)
    const sortedEvents = [...filteredEvents].sort((a, b) => {
      const dateA = new Date(a.eventDate || a.date || "").getTime();
      const dateB = new Date(b.eventDate || b.date || "").getTime();
      return dateB - dateA; // Azalan sıra
    });

    sortedEvents.forEach((event) => {
      const eventDate = new Date(event.eventDate || event.date || "");
      eventDate.setHours(0, 0, 0, 0);

      if (eventDate.getTime() === today.getTime()) {
        groups.today.push(event);
      } else if (eventDate > today) {
        groups.upcoming.push(event);
      } else {
        groups.past.push(event);
      }
    });

    // Yaklaşan etkinlikleri tarihe göre artan sırala (en yakın üstte)
    groups.upcoming.sort((a, b) => {
      const dateA = new Date(a.eventDate || a.date || "").getTime();
      const dateB = new Date(b.eventDate || b.date || "").getTime();
      return dateA - dateB;
    });

    return groups;
  }, [filteredEvents]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-64 bg-slate-700" />
          <Skeleton className="h-10 w-32 bg-slate-700" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full bg-slate-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const renderEventCard = (event: Event) => {
    const statusConfig =
      EVENT_STATUS_CONFIG[event.status] || EVENT_STATUS_CONFIG.planning;
    const hasLayout =
      event.hasVenueLayout ||
      (event.venueLayout?.placedTables?.length || 0) > 0;
    const tableCount = event.venueLayout?.placedTables?.length || 0;

    return (
      <Card
        key={event.id}
        className="bg-slate-800 border-slate-700 hover:border-amber-500/50 transition-all cursor-pointer group"
        onClick={() =>
          onSelectEvent(event.id, event.hasTeamAssignment || false)
        }
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              {/* Tarih Badge */}
              <div className="flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-amber-500/20 border border-amber-500/30">
                <span className="text-lg font-bold text-amber-400">
                  {new Date(event.eventDate || event.date || "").getDate()}
                </span>
                <span className="text-xs text-amber-400/80">
                  {new Date(
                    event.eventDate || event.date || ""
                  ).toLocaleDateString("tr-TR", { month: "short" })}
                </span>
              </div>

              {/* Etkinlik Bilgileri */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white truncate group-hover:text-amber-400 transition-colors">
                  {event.name}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                  {event.venue?.name && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.venue.name}
                    </span>
                  )}
                  {event.time && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {event.time}
                    </span>
                  )}
                </div>
              </div>

              {/* Durum ve Bilgiler */}
              <div className="flex items-center gap-3">
                {hasLayout && (
                  <Badge
                    variant="outline"
                    className="bg-slate-700/50 border-slate-600 text-slate-300"
                  >
                    <Users className="w-3 h-3 mr-1" />
                    {tableCount} Masa
                  </Badge>
                )}
                {event.hasTeamAssignment ? (
                  <Badge
                    variant="outline"
                    className="bg-green-500/20 border-green-500/30 text-green-400"
                  >
                    ✓ Ekip Atandı
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-orange-500/20 border-orange-500/30 text-orange-400"
                  >
                    Ekip Bekliyor
                  </Badge>
                )}
                <Badge variant="outline" className={statusConfig.bg}>
                  {statusConfig.label}
                </Badge>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 transition-colors ml-4" />
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderEventGroup = (
    title: string,
    events: Event[],
    emptyMessage: string
  ) => {
    if (events.length === 0) return null;

    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-400 px-1">
          {title} ({events.length})
        </h3>
        {events.map(renderEventCard)}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Etkinlik veya mekan ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-800 border-slate-700"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={`border-slate-600 ${showFilters ? "bg-slate-700" : ""}`}
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>
        <Badge
          variant="outline"
          className="bg-amber-500/20 text-amber-400 border-amber-500/30"
        >
          {filteredEvents.length} Etkinlik
        </Badge>
      </div>

      {/* Filtreler */}
      {showFilters && (
        <div className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Durum:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-slate-700 border-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="planning">Planlama</SelectItem>
                <SelectItem value="ready">Hazır</SelectItem>
                <SelectItem value="completed">Tamamlandı</SelectItem>
                <SelectItem value="cancelled">İptal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
            className="text-slate-400 hover:text-white"
          >
            Filtreleri Temizle
          </Button>
        </div>
      )}

      {/* Etkinlik Listesi */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
          <Calendar className="w-12 h-12 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400">
            {searchQuery || statusFilter !== "all"
              ? "Arama kriterlerine uygun etkinlik bulunamadı"
              : "Henüz etkinlik yok"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Bugün */}
          {groupedEvents.today.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-amber-400 px-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Bugün ({groupedEvents.today.length})
              </h3>
              {groupedEvents.today.map(renderEventCard)}
            </div>
          )}

          {/* Yaklaşan */}
          {renderEventGroup("Yaklaşan Etkinlikler", groupedEvents.upcoming, "")}

          {/* Geçmiş */}
          {renderEventGroup("Geçmiş Etkinlikler", groupedEvents.past, "")}
        </div>
      )}
    </div>
  );
}
