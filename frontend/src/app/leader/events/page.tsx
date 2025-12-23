"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  ChevronRight,
  Search,
  Filter,
  Star,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/ui/PageContainer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { leaderApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast-notification";

interface Event {
  id: string;
  name: string;
  date: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
  status: string;
  guestCount?: number;
  needsReview?: boolean;
}

const statusColors: Record<string, string> = {
  planned: "bg-blue-500/20 text-blue-400",
  confirmed: "bg-green-500/20 text-green-400",
  active: "bg-amber-500/20 text-amber-400",
  completed: "bg-slate-500/20 text-slate-400",
  cancelled: "bg-red-500/20 text-red-400",
};

const statusLabels: Record<string, string> = {
  planned: "Planlandı",
  confirmed: "Onaylandı",
  active: "Aktif",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

export default function LeaderEventsPage() {
  const router = useRouter();
  const toast = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await leaderApi.getDashboard();
      // Tüm etkinlikleri birleştir
      const allEvents = [
        ...res.data.assignedEvents.map((e: Event) => ({
          ...e,
          needsReview: false,
        })),
        ...res.data.pastEventsForReview.map((e: Event) => ({
          ...e,
          needsReview: true,
        })),
      ];
      // Tekrarları kaldır
      const uniqueEvents = allEvents.filter(
        (event, index, self) =>
          index === self.findIndex((e) => e.id === event.id)
      );
      setEvents(uniqueEvents);
      setFilteredEvents(uniqueEvents);
    } catch (error) {
      console.error("Etkinlikler yüklenemedi:", error);
      toast.error("Etkinlikler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    let filtered = events;
    if (searchQuery) {
      filtered = filtered.filter((e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }
    setFilteredEvents(filtered);
  }, [searchQuery, statusFilter, events]);

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48 bg-slate-700" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 bg-slate-700 rounded-lg" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title="Etkinlikler"
          description="Atandığınız ve değerlendirme bekleyen etkinlikler"
          icon={<Calendar className="w-6 h-6 text-cyan-400" />}
        />

        {/* Filtreler */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Etkinlik ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-slate-800 border-slate-700">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="planned">Planlandı</SelectItem>
              <SelectItem value="confirmed">Onaylandı</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="completed">Tamamlandı</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Etkinlik Listesi */}
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-slate-500 mb-4" />
            <p className="text-slate-400">Etkinlik bulunamadı</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event) => (
              <Card
                key={event.id}
                className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all cursor-pointer group"
                onClick={() => router.push(`/leader/events/${event.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                      {event.name}
                    </h3>
                    <Badge
                      className={
                        statusColors[event.status] || statusColors.planned
                      }
                    >
                      {statusLabels[event.status] || event.status}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {new Date(event.date).toLocaleDateString("tr-TR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </div>
                    {event.startTime && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {event.startTime}
                        {event.endTime && ` - ${event.endTime}`}
                      </div>
                    )}
                    {event.venue && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {event.venue}
                      </div>
                    )}
                    {event.guestCount && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {event.guestCount} Misafir
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700">
                    {event.needsReview ? (
                      <Badge className="bg-amber-500/20 text-amber-400">
                        <Star className="w-3 h-3 mr-1" />
                        Değerlendirme Bekliyor
                      </Badge>
                    ) : event.status === "completed" ? (
                      <Badge className="bg-green-500/20 text-green-400">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Tamamlandı
                      </Badge>
                    ) : (
                      <span />
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
