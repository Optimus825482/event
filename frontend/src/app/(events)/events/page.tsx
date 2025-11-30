"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Calendar,
  Users,
  Clock,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  MapPin,
} from "lucide-react";
import { eventsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PageContainer,
  PageHeader,
  CardGrid,
} from "@/components/ui/PageContainer";

interface Event {
  id: string;
  name: string;
  eventDate: string;
  status: string;
  totalCapacity: number;
  reservedCount?: number;
  description?: string;
  coverImage?: string;
}

// Durum badge renkleri
const statusConfig: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Taslak",
    className: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  },
  published: {
    label: "Yayında",
    className: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  active: {
    label: "Aktif",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  completed: {
    label: "Tamamlandı",
    className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  },
  cancelled: {
    label: "İptal",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await eventsApi.getAll();
        setEvents(response.data || []);
      } catch (error) {
        console.error("Etkinlikler yüklenemedi:", error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Kalan gün hesaplama
  const getDaysRemaining = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil(
      (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  };

  // Filtreleme
  const filteredEvents = events.filter((event) => {
    const matchesSearch = event.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Gelecek ve geçmiş etkinlikleri ayır
  const now = new Date();
  const upcomingEvents = filteredEvents.filter(
    (e) => new Date(e.eventDate) >= now
  );
  const pastEvents = filteredEvents.filter((e) => new Date(e.eventDate) < now);

  // Etkinlik kartı bileşeni
  const EventCard = ({ event, isPast }: { event: Event; isPast?: boolean }) => {
    const daysRemaining = getDaysRemaining(event.eventDate);
    const fillRate =
      event.totalCapacity > 0
        ? ((event.reservedCount || 0) / event.totalCapacity) * 100
        : 0;
    const status = statusConfig[event.status] || statusConfig.draft;

    return (
      <Card
        className={`bg-slate-800 border-slate-700 overflow-hidden transition-all ${
          isPast ? "opacity-70" : ""
        }`}
      >
        {/* Üst Renk Bandı */}
        <div
          className={`h-1 ${
            isPast
              ? "bg-slate-600"
              : daysRemaining <= 3
              ? "bg-red-500"
              : daysRemaining <= 7
              ? "bg-amber-500"
              : "bg-blue-500"
          }`}
        />

        <CardContent className="p-5">
          {/* Başlık ve Menü */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <Link
                href={`/events/${event.id}`}
                className="text-lg font-semibold text-white line-clamp-1"
              >
                {event.name}
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={status.className}>
                  {status.label}
                </Badge>
                {!isPast && daysRemaining >= 0 && (
                  <span
                    className={`text-xs ${
                      daysRemaining <= 3
                        ? "text-red-400"
                        : daysRemaining <= 7
                        ? "text-amber-400"
                        : "text-slate-400"
                    }`}
                  >
                    <Clock className="w-3 h-3 inline mr-1" />
                    {daysRemaining === 0
                      ? "Bugün"
                      : daysRemaining === 1
                      ? "Yarın"
                      : `${daysRemaining} gün`}
                  </span>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-slate-800 border-slate-700"
              >
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href={`/events/${event.id}`}>
                    <Eye className="w-4 h-4 mr-2" />
                    Görüntüle
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href={`/events/${event.id}`}>
                    <Edit className="w-4 h-4 mr-2" />
                    Düzenle
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer text-red-400 focus:text-red-400">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Sil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Tarih */}
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
            <Calendar className="w-4 h-4" />
            {new Date(event.eventDate).toLocaleDateString("tr-TR", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>

          {/* Kapasite */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 flex items-center gap-1">
                <Users className="w-4 h-4" />
                Kapasite
              </span>
              <span className="text-white font-medium">
                {event.reservedCount || 0} / {event.totalCapacity}
              </span>
            </div>
            <Progress value={fillRate} className="h-2" />
          </div>

          {/* Alt Bilgi - Geçmiş etkinlikler için */}
          {isPast && (
            <div className="mt-4 pt-3 border-t border-slate-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Tamamlandı</span>
                <span className="text-slate-400">
                  {new Date(event.eventDate).toLocaleDateString("tr-TR")}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48 bg-slate-700" />
            <Skeleton className="h-10 w-36 bg-slate-700" />
          </div>
          <CardGrid columns={3}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="bg-slate-800 border-slate-700">
                <CardContent className="p-4 sm:p-5">
                  <Skeleton className="h-6 w-3/4 mb-3 bg-slate-700" />
                  <Skeleton className="h-4 w-1/2 mb-4 bg-slate-700" />
                  <Skeleton className="h-2 w-full bg-slate-700" />
                </CardContent>
              </Card>
            ))}
          </CardGrid>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Başlık */}
        <PageHeader
          title="Etkinlikler"
          description="Tüm etkinliklerinizi yönetin ve takip edin"
          icon={<Calendar className="w-6 h-6 text-blue-400" />}
          actions={
            <Button asChild className="bg-blue-600 w-full sm:w-auto">
              <Link href="/events/new">
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Yeni Etkinlik Oluştur</span>
                <span className="sm:hidden">Yeni Etkinlik</span>
              </Link>
            </Button>
          }
        />

        {/* Filtreler */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Etkinlik ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-slate-800 border-slate-700">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="draft">Taslak</SelectItem>
              <SelectItem value="published">Yayında</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="completed">Tamamlandı</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="bg-slate-800 border border-slate-700 w-full sm:w-auto flex">
            <TabsTrigger
              value="upcoming"
              className="data-[state=active]:bg-blue-600 flex-1 sm:flex-none text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Gelecek Etkinlikler</span>
              <span className="sm:hidden">Gelecek</span>
              <span className="ml-1">({upcomingEvents.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="past"
              className="data-[state=active]:bg-blue-600 flex-1 sm:flex-none text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Geçmiş Etkinlikler</span>
              <span className="sm:hidden">Geçmiş</span>
              <span className="ml-1">({pastEvents.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4 sm:mt-6">
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400 mb-4 text-sm sm:text-base">
                  {searchQuery || statusFilter !== "all"
                    ? "Filtrelere uygun etkinlik bulunamadı"
                    : "Henüz etkinlik oluşturulmamış"}
                </p>
                <Button asChild className="bg-blue-600">
                  <Link href="/events/new">
                    <Plus className="w-4 h-4 mr-2" />
                    İlk Etkinliği Oluştur
                  </Link>
                </Button>
              </div>
            ) : (
              <CardGrid columns={3}>
                {upcomingEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </CardGrid>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-4 sm:mt-6">
            {pastEvents.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Clock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-slate-600 mb-4" />
                <p className="text-slate-400 text-sm sm:text-base">
                  Geçmiş etkinlik bulunmuyor
                </p>
              </div>
            ) : (
              <CardGrid columns={3}>
                {pastEvents.map((event) => (
                  <EventCard key={event.id} event={event} isPast />
                ))}
              </CardGrid>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
