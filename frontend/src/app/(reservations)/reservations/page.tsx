"use client";

import { useEffect, useState, memo, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  Timer,
  ArrowRight,
  Sparkles,
  Ticket,
  Search,
  MapPin,
  UserCheck,
  AlertCircle,
  CalendarDays,
} from "lucide-react";
import { eventsApi, reservationsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/PageContainer";
import { formatDate } from "@/lib/utils";

interface Event {
  id: string;
  name: string;
  eventDate: string;
  status: string;
  venueLayout?: {
    tables?: any[];
  };
  reservationCount?: number;
  checkedInCount?: number;
}

interface DashboardStats {
  totalEvents: number;
  upcomingEvents: number;
  todayEvents: number;
  totalReservations: number;
  totalCheckedIn: number;
}

// Geri Sayım Component
const CountdownDisplay = memo(function CountdownDisplay({
  eventDate,
}: {
  eventDate: string;
}) {
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const eventTime = new Date(eventDate).getTime();
      const diff = eventTime - now;

      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [eventDate]);

  return (
    <div className="flex items-center gap-1.5 bg-slate-800/50 rounded-lg px-3 py-1.5">
      <div className="text-center">
        <span className="text-lg font-bold text-purple-400 tabular-nums">
          {String(countdown.days).padStart(2, "0")}
        </span>
        <span className="text-[9px] text-slate-500 block">GÜN</span>
      </div>
      <span className="text-purple-500 font-bold">:</span>
      <div className="text-center">
        <span className="text-lg font-bold text-purple-400 tabular-nums">
          {String(countdown.hours).padStart(2, "0")}
        </span>
        <span className="text-[9px] text-slate-500 block">SAAT</span>
      </div>
      <span className="text-purple-500 font-bold">:</span>
      <div className="text-center">
        <span className="text-lg font-bold text-purple-400 tabular-nums">
          {String(countdown.minutes).padStart(2, "0")}
        </span>
        <span className="text-[9px] text-slate-500 block">DK</span>
      </div>
      <span className="text-purple-500 font-bold">:</span>
      <div className="text-center">
        <span className="text-lg font-bold text-purple-400 tabular-nums">
          {String(countdown.seconds).padStart(2, "0")}
        </span>
        <span className="text-[9px] text-slate-500 block">SN</span>
      </div>
    </div>
  );
});

export default function ReservationsDashboardPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const eventsRes = await eventsApi.getAll();
        // API response formatı: { items: [], meta: {} } veya doğrudan array
        const data = eventsRes.data;
        const allEvents = Array.isArray(data) ? data : data?.items || [];

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Sadece bugün ve gelecekteki etkinlikler
        const upcomingEvents = allEvents
          .filter((e: Event) => {
            const eventDate = new Date(e.eventDate);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate >= now && e.status !== "cancelled";
          })
          .sort(
            (a: Event, b: Event) =>
              new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
          );

        // Bugünkü etkinlikler
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayEvents = upcomingEvents.filter((e: Event) => {
          const eventDate = new Date(e.eventDate);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate >= today && eventDate < tomorrow;
        });

        setEvents(upcomingEvents);
        setStats({
          totalEvents: allEvents.length,
          upcomingEvents: upcomingEvents.length,
          todayEvents: todayEvents.length,
          totalReservations: 0,
          totalCheckedIn: 0,
        });
      } catch (error) {
        console.error("Veriler yüklenemedi:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filtrelenmiş etkinlikler
  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    const query = searchQuery.toLowerCase();
    return events.filter((e) => e.name.toLowerCase().includes(query));
  }, [events, searchQuery]);

  // En yakın etkinlik
  const nextEvent = events[0];

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center py-4">
          <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
            <Ticket className="w-6 h-6 text-purple-400" />
            Rezervasyon Yönetimi
          </h1>
          <p className="text-slate-400 mt-1">
            Etkinlik seçin ve rezervasyonları yönetin
          </p>
        </div>

        {/* Yaklaşan Etkinlik - Geri Sayım */}
        {nextEvent && (
          <Card className="bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-rose-600/10 border-purple-500/30">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Timer className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {nextEvent.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {formatDate(nextEvent.eventDate)}
                    </p>
                  </div>
                </div>

                <CountdownDisplay eventDate={nextEvent.eventDate} />

                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 h-8"
                  onClick={() => router.push(`/reservations/${nextEvent.id}`)}
                >
                  Rezervasyonlar
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Calendar className="w-5 h-5" />}
            label="Toplam Etkinlik"
            value={stats?.totalEvents || 0}
            color="blue"
          />
          <StatCard
            icon={<CalendarDays className="w-5 h-5" />}
            label="Yaklaşan"
            value={stats?.upcomingEvents || 0}
            color="purple"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="Bugün"
            value={stats?.todayEvents || 0}
            color="amber"
            highlight
          />
          <StatCard
            icon={<UserCheck className="w-5 h-5" />}
            label="Check-in"
            value={stats?.totalCheckedIn || 0}
            color="green"
          />
        </div>

        {/* Arama */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Etkinlik ara..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Etkinlik Listesi */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            Etkinlikler
            <Badge variant="secondary" className="ml-2">
              {filteredEvents.length}
            </Badge>
          </h2>

          {filteredEvents.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">
                  {searchQuery
                    ? "Arama kriterlerine uygun etkinlik bulunamadı"
                    : "Yaklaşan etkinlik bulunmuyor"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

// Etkinlik Kartı
function EventCard({ event }: { event: Event }) {
  const router = useRouter();
  const eventDate = new Date(event.eventDate);
  const now = new Date();
  const isToday = eventDate.toDateString() === now.toDateString();
  const isPast = eventDate < now;

  const tableCount = event.venueLayout?.tables?.length || 0;

  return (
    <Card
      className={`bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-all cursor-pointer ${
        isToday ? "ring-2 ring-purple-500/50" : ""
      }`}
      onClick={() => router.push(`/reservations/${event.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isToday
                  ? "bg-purple-500/20"
                  : isPast
                  ? "bg-slate-600/20"
                  : "bg-blue-500/20"
              }`}
            >
              <Calendar
                className={`w-6 h-6 ${
                  isToday
                    ? "text-purple-400"
                    : isPast
                    ? "text-slate-400"
                    : "text-blue-400"
                }`}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white truncate">
                  {event.name}
                </h3>
                {isToday && (
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                    Bugün
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-400">
                {formatDate(event.eventDate)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="flex items-center gap-1 text-slate-400 text-sm">
                <MapPin className="w-4 h-4" />
                <span>{tableCount} masa</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 text-sm">
                <Users className="w-4 h-4" />
                <span>{event.reservationCount || 0} rezervasyon</span>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// İstatistik Kartı
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "green" | "amber" | "purple";
  highlight?: boolean;
}

const statColors = {
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    icon: "bg-blue-500/20",
  },
  green: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    text: "text-green-400",
    icon: "bg-green-500/20",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    icon: "bg-amber-500/20",
  },
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-400",
    icon: "bg-purple-500/20",
  },
};

const StatCard = memo(function StatCard({
  icon,
  label,
  value,
  color,
  highlight,
}: StatCardProps) {
  const colors = statColors[color];
  return (
    <Card
      className={`${highlight ? colors.bg : "bg-slate-800/50"} ${
        colors.border
      } border`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg ${colors.icon} flex items-center justify-center ${colors.text}`}
          >
            {icon}
          </div>
          <div>
            <p
              className={`text-2xl font-bold ${
                highlight ? colors.text : "text-white"
              }`}
            >
              {value}
            </p>
            <p className="text-xs text-slate-400">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

// Skeleton
function DashboardSkeleton() {
  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="text-center py-4">
          <Skeleton className="h-8 w-64 mx-auto mb-2 bg-slate-700" />
          <Skeleton className="h-4 w-48 mx-auto bg-slate-700" />
        </div>
        <Skeleton className="h-20 w-full bg-slate-700 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 bg-slate-700 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-12 w-full bg-slate-700 rounded-xl" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 bg-slate-700 rounded-xl" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
